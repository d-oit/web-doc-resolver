//! Cascade helper utilities.
//!
//! Shared functions used by both URL and query resolution.

use crate::error::ResolverError;
use std::time::Duration;

/// Check if input is a URL
pub fn is_url(input: &str) -> bool {
    let url_patterns = ["http://", "https://", "ftp://", "ftps://"];
    url_patterns.iter().any(|p| input.starts_with(p))
}

/// Extract domain from URL or return empty string
pub fn extract_domain_or_default(target: &str) -> String {
    url::Url::parse(target)
        .ok()
        .and_then(|u| u.host_str().map(|s| s.to_string()))
        .unwrap_or_default()
}

/// Classify error type for routing decisions
pub fn classify_error(err: &ResolverError) -> String {
    let s = err.to_string().to_lowercase();
    if s.contains("timeout") {
        "timeout".into()
    } else if s.contains("rate limit") || s.contains("429") {
        "rate_limited".into()
    } else if s.contains("500") || s.contains("502") || s.contains("503") || s.contains("504") {
        "provider_5xx".into()
    } else if s.contains("auth") || s.contains("api key") {
        "auth_required".into()
    } else {
        "provider_error".into()
    }
}

/// Default TTL for negative cache entries on failure
pub const NEGATIVE_CACHE_FAILURE_TTL: Duration = Duration::from_secs(600);

/// Default TTL for negative cache entries on thin content
pub const NEGATIVE_CACHE_THIN_TTL: Duration = Duration::from_secs(1800);

/// Default TTL for circuit breaker recovery
pub const CIRCUIT_BREAKER_RECOVERY_TTL: Duration = Duration::from_secs(300);

/// Default failure threshold for circuit breaker
pub const CIRCUIT_BREAKER_FAILURE_THRESHOLD: usize = 3;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_url() {
        assert!(is_url("https://example.com"));
        assert!(is_url("http://example.com"));
        assert!(is_url("ftp://ftp.example.com"));
        assert!(!is_url("not a url"));
        assert!(!is_url("just some text"));
    }

    #[test]
    fn test_extract_domain() {
        assert_eq!(
            extract_domain_or_default("https://example.com/path"),
            "example.com"
        );
        assert_eq!(extract_domain_or_default("not a url"), "");
    }

    #[test]
    fn test_classify_error() {
        let timeout_err = ResolverError::Network("timeout".to_string());
        assert_eq!(classify_error(&timeout_err), "timeout");

        let rate_limit_err = ResolverError::RateLimit("429 too many requests".to_string());
        assert_eq!(classify_error(&rate_limit_err), "rate_limited");

        let server_err = ResolverError::Network("500 internal server error".to_string());
        assert_eq!(classify_error(&server_err), "provider_5xx");

        let auth_err = ResolverError::Auth("api key invalid".to_string());
        assert_eq!(classify_error(&auth_err), "auth_required");

        let other_err = ResolverError::Network("connection refused".to_string());
        assert_eq!(classify_error(&other_err), "provider_error");
    }
}
