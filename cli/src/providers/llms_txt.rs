//! llms.txt provider.
//!
//! Checks for site-provided structured documentation.

use crate::error::{ResolverError, detect_error_type};
use crate::types::ResolvedResult;
use async_trait::async_trait;
use std::result::Result;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use url::Url;

/// llms.txt provider - checks for structured LLM documentation
pub struct LlmsTxtProvider {
    client: reqwest::Client,
    rate_limited: Arc<AtomicBool>,
}

impl LlmsTxtProvider {
    /// Create a new llms.txt provider
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            rate_limited: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Check if rate limited
    pub fn is_rate_limited(&self) -> bool {
        self.rate_limited.load(Ordering::SeqCst)
    }

    /// Set rate limit
    pub fn set_rate_limited(&self, limited: bool) {
        self.rate_limited.store(limited, Ordering::SeqCst);
    }
}

impl Default for LlmsTxtProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl crate::providers::UrlProvider for LlmsTxtProvider {
    fn name(&self) -> &str {
        "llms_txt"
    }

    fn is_available(&self) -> bool {
        !self.is_rate_limited()
    }

    async fn extract(&self, url: &str) -> Result<ResolvedResult, ResolverError> {
        if self.is_rate_limited() {
            return Err(ResolverError::RateLimitError(
                "llms.txt provider is rate limited".to_string(),
            ));
        }

        // Parse the URL and construct llms.txt URL
        let parsed_url = Url::parse(url)
            .map_err(|e| ResolverError::ParseError(format!("Invalid URL: {}", e)))?;

        let llms_txt_url = format!(
            "{}://{}/llms.txt",
            parsed_url.scheme(),
            parsed_url.host_str().unwrap_or("")
        );

        let response = self
            .client
            .get(&llms_txt_url)
            .header("User-Agent", "WDR/1.0 (LLM documentation resolver)")
            .send()
            .await
            .map_err(|e| ResolverError::NetworkError(e.to_string()))?;

        if response.status() == 404 {
            return Err(ResolverError::NotFoundError(
                "llms.txt not found".to_string(),
            ));
        }

        if response.status() == 429 {
            self.set_rate_limited(true);
            return Err(ResolverError::RateLimitError(
                "Rate limit exceeded".to_string(),
            ));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(detect_error_type(&error_text));
        }

        let content = response
            .text()
            .await
            .map_err(|e| ResolverError::ParseError(e.to_string()))?;

        Ok(ResolvedResult::new(
            llms_txt_url,
            Some(content),
            "llms_txt",
            1.0,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::UrlProvider;

    #[test]
    fn test_provider_name() {
        let provider = LlmsTxtProvider::new();
        assert_eq!(provider.name(), "llms_txt");
    }
}
