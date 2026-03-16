//! Firecrawl provider.
//!
//! Deep content extraction with markdown output.

use crate::error::{ResolverError, detect_error_type};
use crate::types::ResolvedResult;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::env;
use std::result::Result;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

/// Firecrawl provider
pub struct FirecrawlProvider {
    client: reqwest::Client,
    api_key: Option<String>,
    rate_limited: Arc<AtomicBool>,
}

impl FirecrawlProvider {
    /// Create a new Firecrawl provider
    pub fn new() -> Self {
        let api_key = env::var("FIRECRAWL_API_KEY").ok();
        Self {
            client: reqwest::Client::new(),
            api_key,
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

impl Default for FirecrawlProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl crate::providers::UrlProvider for FirecrawlProvider {
    fn name(&self) -> &str {
        "firecrawl"
    }

    fn is_available(&self) -> bool {
        self.api_key.is_some() && !self.is_rate_limited()
    }

    async fn extract(&self, url: &str) -> Result<ResolvedResult, ResolverError> {
        let api_key = self
            .api_key
            .as_ref()
            .ok_or_else(|| ResolverError::AuthError("FIRECRAWL_API_KEY not set".to_string()))?;

        if self.is_rate_limited() {
            return Err(ResolverError::RateLimitError(
                "Firecrawl is rate limited".to_string(),
            ));
        }

        let response = self
            .client
            .post("https://api.firecrawl.dev/v1/scrape")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&FirecrawlRequest {
                url: url.to_string(),
                formats: vec!["markdown".to_string()],
            })
            .send()
            .await
            .map_err(|e| ResolverError::NetworkError(e.to_string()))?;

        if response.status() == 429 {
            self.set_rate_limited(true);
            return Err(ResolverError::RateLimitError(
                "Firecrawl rate limit exceeded".to_string(),
            ));
        }

        if response.status() == 401 {
            return Err(ResolverError::AuthError(
                "Firecrawl authentication failed".to_string(),
            ));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(detect_error_type(&error_text));
        }

        let firecrawl_response: FirecrawlResponse = response
            .json()
            .await
            .map_err(|e| ResolverError::ParseError(e.to_string()))?;

        let content = firecrawl_response.data.and_then(|d| d.markdown);

        Ok(ResolvedResult::new(url, content, "firecrawl", 0.95))
    }
}

#[derive(Debug, Serialize)]
struct FirecrawlRequest {
    url: String,
    formats: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct FirecrawlResponse {
    #[serde(default)]
    data: Option<FirecrawlData>,
}

#[derive(Debug, Deserialize)]
struct FirecrawlData {
    #[serde(default)]
    markdown: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::UrlProvider;

    #[test]
    fn test_provider_name() {
        let provider = FirecrawlProvider::new();
        assert_eq!(provider.name(), "firecrawl");
    }
}
