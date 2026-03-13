//! Error types for the Web Documentation Resolver CLI.
//!
//! Provides typed ResolverError variants with thiserror.

use thiserror::Error;

/// Main error type for the resolver
#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum ResolverError {
    /// Network-related errors
    #[error("Network error: {0}")]
    Network(String),

    /// Rate limit exceeded
    #[error("Rate limit exceeded: {0}")]
    RateLimit(String),

    /// Authentication/authorization errors
    #[error("Authentication error: {0}")]
    Auth(String),

    /// Quota/credit exhaustion
    #[error("Quota exhausted: {0}")]
    Quota(String),

    /// Resource not found (404)
    #[error("Not found: {0}")]
    NotFound(String),

    /// Parse/format errors
    #[error("Parse error: {0}")]
    Parse(String),

    /// Configuration errors
    #[error("Configuration error: {0}")]
    Config(String),

    /// Cache errors
    #[error("Cache error: {0}")]
    Cache(String),

    /// Provider-specific errors
    #[error("Provider error: {0}")]
    Provider(String),

    /// Unknown/internal errors
    #[error("Unknown error: {0}")]
    Unknown(String),

    /// Rate limit error (for detect_error_type function)
    #[error("Rate limit error: {0}")]
    RateLimitError(String),

    /// Auth error (for detect_error_type function)
    #[error("Auth error: {0}")]
    AuthError(String),

    /// Quota error (for detect_error_type function)
    #[error("Quota error: {0}")]
    QuotaError(String),

    /// Not found error (for detect_error_type function)
    #[error("Not found error: {0}")]
    NotFoundError(String),

    /// Network error (for detect_error_type function)
    #[error("Network error: {0}")]
    NetworkError(String),

    /// Unknown error (for detect_error_type function)
    #[error("Unknown error: {0}")]
    UnknownError(String),

    /// Parse error (for provider code)
    #[error("Parse error: {0}")]
    ParseError(String),
}

impl ResolverError {
    /// Create a new error with context
    #[allow(dead_code)]
    pub fn with_context<E: std::fmt::Display>(error: E, context: &str) -> Self {
        ResolverError::Unknown(format!("{}: {}", context, error))
    }

    /// Check if this is a rate limit error
    #[allow(dead_code)]
    pub fn is_rate_limit(&self) -> bool {
        matches!(
            self,
            ResolverError::RateLimit(_) | ResolverError::RateLimitError(_)
        )
    }

    /// Check if this is an auth error
    #[allow(dead_code)]
    pub fn is_auth(&self) -> bool {
        matches!(self, ResolverError::Auth(_) | ResolverError::AuthError(_))
    }

    /// Check if this is a quota error
    #[allow(dead_code)]
    pub fn is_quota(&self) -> bool {
        matches!(self, ResolverError::Quota(_) | ResolverError::QuotaError(_))
    }

    /// Check if this is a not found error
    #[allow(dead_code)]
    pub fn is_not_found(&self) -> bool {
        matches!(
            self,
            ResolverError::NotFound(_) | ResolverError::NotFoundError(_)
        )
    }
}

// Note: We don't define a Result type alias here to avoid conflicts
// Use std::result::Result<T, ResolverError> directly in provider code

/// Detect error type from error message
pub fn detect_error_type(error: &str) -> ResolverError {
    let error_lower = error.to_lowercase();

    if error_lower.contains("429")
        || error_lower.contains("rate limit")
        || error_lower.contains("too many requests")
    {
        return ResolverError::RateLimitError(error.to_string());
    }

    if error_lower.contains("401")
        || error_lower.contains("403")
        || error_lower.contains("unauthorized")
        || error_lower.contains("forbidden")
        || error_lower.contains("invalid api key")
    {
        return ResolverError::AuthError(error.to_string());
    }

    if error_lower.contains("402")
        || error_lower.contains("quota")
        || error_lower.contains("credits")
        || error_lower.contains("insufficient")
        || error_lower.contains("payment required")
    {
        return ResolverError::QuotaError(error.to_string());
    }

    if error_lower.contains("404") || error_lower.contains("not found") {
        return ResolverError::NotFoundError(error.to_string());
    }

    if error_lower.contains("network")
        || error_lower.contains("connection")
        || error_lower.contains("timeout")
    {
        return ResolverError::NetworkError(error.to_string());
    }

    ResolverError::UnknownError(error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limit_detection() {
        let err = detect_error_type("429 rate limit exceeded");
        assert!(err.is_rate_limit());

        let err = detect_error_type("Too many requests");
        assert!(err.is_rate_limit());
    }

    #[test]
    fn test_auth_detection() {
        let err = detect_error_type("401 unauthorized");
        assert!(err.is_auth());

        let err = detect_error_type("403 forbidden");
        assert!(err.is_auth());
    }

    #[test]
    fn test_quota_detection() {
        let err = detect_error_type("402 payment required");
        assert!(err.is_quota());

        let err = detect_error_type("Insufficient credits");
        assert!(err.is_quota());
    }

    #[test]
    fn test_not_found_detection() {
        let err = detect_error_type("404 not found");
        assert!(err.is_not_found());
    }

    #[test]
    fn test_network_detection() {
        let err = detect_error_type("Network connection error");
        assert!(matches!(err, ResolverError::NetworkError(_)));
    }
}
