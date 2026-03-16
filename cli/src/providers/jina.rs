//! Jina Reader provider.
//!
//! Free content extraction via https://r.jina.ai/<url>

use crate::error::{ResolverError, detect_error_type};
use crate::types::ResolvedResult;
use async_trait::async_trait;
use std::result::Result;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

/// Jina Reader provider - free content extraction
pub struct JinaProvider {
    client: reqwest::Client,
    rate_limited: Arc<AtomicBool>,
}

impl JinaProvider {
    /// Create a new Jina provider
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

impl Default for JinaProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl crate::providers::UrlProvider for JinaProvider {
    fn name(&self) -> &str {
        "jina"
    }

    fn is_available(&self) -> bool {
        !self.is_rate_limited()
    }

    async fn extract(&self, url: &str) -> Result<ResolvedResult, ResolverError> {
        if self.is_rate_limited() {
            return Err(ResolverError::RateLimitError(
                "Jina is rate limited".to_string(),
            ));
        }

        // Use Jina Reader API
        let jina_url = format!("https://r.jina.ai/{}", url);

        let response = self
            .client
            .get(&jina_url)
            .header("User-Agent", "WDR/1.0 (LLM documentation resolver)")
            .send()
            .await
            .map_err(|e| ResolverError::NetworkError(e.to_string()))?;

        if response.status() == 429 {
            self.set_rate_limited(true);
            return Err(ResolverError::RateLimitError(
                "Jina rate limit exceeded".to_string(),
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

        Ok(ResolvedResult::new(url, Some(content), "jina", 0.9))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::UrlProvider;

    #[test]
    fn test_provider_name() {
        let provider = JinaProvider::new();
        assert_eq!(provider.name(), "jina");
    }
}
