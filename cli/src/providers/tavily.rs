//! Tavily search provider.
//!
//! Comprehensive search API.

use crate::error::{ResolverError, detect_error_type};
use crate::types::ResolvedResult;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::env;
use std::result::Result;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

/// Tavily search provider
pub struct TavilyProvider {
    client: reqwest::Client,
    api_key: Option<String>,
    rate_limited: Arc<AtomicBool>,
}

impl TavilyProvider {
    /// Create a new Tavily provider
    pub fn new() -> Self {
        let api_key = env::var("TAVILY_API_KEY").ok();
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

impl Default for TavilyProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl crate::providers::QueryProvider for TavilyProvider {
    fn name(&self) -> &str {
        "tavily"
    }

    fn is_available(&self) -> bool {
        self.api_key.is_some() && !self.is_rate_limited()
    }

    async fn search(
        &self,
        query: &str,
        limit: usize,
    ) -> Result<Vec<ResolvedResult>, ResolverError> {
        let api_key = self
            .api_key
            .as_ref()
            .ok_or_else(|| ResolverError::AuthError("TAVILY_API_KEY not set".to_string()))?;

        if self.is_rate_limited() {
            return Err(ResolverError::RateLimitError(
                "Tavily is rate limited".to_string(),
            ));
        }

        let response = self
            .client
            .post("https://api.tavily.com/search")
            .json(&TavilyRequest {
                api_key: api_key.clone(),
                query: query.to_string(),
                max_results: limit,
                include_answer: true,
                include_raw_content: false,
                include_images: false,
            })
            .send()
            .await
            .map_err(|e| ResolverError::NetworkError(e.to_string()))?;

        if response.status() == 429 {
            self.set_rate_limited(true);
            return Err(ResolverError::RateLimitError(
                "Tavily rate limit exceeded".to_string(),
            ));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(detect_error_type(&error_text));
        }

        let tavily_response: TavilyResponse = response
            .json()
            .await
            .map_err(|e| ResolverError::ParseError(e.to_string()))?;

        let results = tavily_response
            .results
            .unwrap_or_default()
            .into_iter()
            .map(|r| ResolvedResult::new(r.url, Some(r.content), "tavily", r.score))
            .collect();

        Ok(results)
    }
}

#[derive(Debug, Serialize)]
struct TavilyRequest {
    #[serde(rename = "api_key")]
    api_key: String,
    query: String,
    #[serde(rename = "max_results")]
    max_results: usize,
    #[serde(rename = "include_answer")]
    include_answer: bool,
    #[serde(rename = "include_raw_content")]
    include_raw_content: bool,
    #[serde(rename = "include_images")]
    include_images: bool,
}

#[derive(Debug, Deserialize)]
struct TavilyResponse {
    #[serde(default)]
    results: Option<Vec<TavilyResult>>,
}

#[derive(Debug, Deserialize)]
struct TavilyResult {
    url: String,
    content: String,
    score: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::QueryProvider;

    #[test]
    fn test_provider_name() {
        let provider = TavilyProvider::new();
        assert_eq!(provider.name(), "tavily");
    }
}
