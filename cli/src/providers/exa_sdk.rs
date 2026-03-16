//! Exa SDK provider.
//!
//! Uses Exa API with highlights for token-efficient results.

use crate::error::{ResolverError, detect_error_type};
use crate::types::ResolvedResult;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::env;
use std::result::Result;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

/// Exa SDK provider
pub struct ExaSdkProvider {
    client: reqwest::Client,
    api_key: Option<String>,
    rate_limited: Arc<AtomicBool>,
}

impl ExaSdkProvider {
    /// Create a new Exa SDK provider
    pub fn new() -> Self {
        let api_key = env::var("EXA_API_KEY").ok();
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

impl Default for ExaSdkProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl crate::providers::QueryProvider for ExaSdkProvider {
    fn name(&self) -> &str {
        "exa"
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
            .ok_or_else(|| ResolverError::AuthError("EXA_API_KEY not set".to_string()))?;

        if self.is_rate_limited() {
            return Err(ResolverError::RateLimitError(
                "Exa SDK is rate limited".to_string(),
            ));
        }

        let response = self
            .client
            .post("https://api.exa.ai/search")
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&ExaSearchRequest {
                query: query.to_string(),
                num_results: limit,
                highlights: true,
                highlights_per_result: 3,
            })
            .send()
            .await
            .map_err(|e| ResolverError::NetworkError(e.to_string()))?;

        if response.status() == 429 {
            self.set_rate_limited(true);
            return Err(ResolverError::RateLimitError(
                "Exa SDK rate limit exceeded".to_string(),
            ));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(detect_error_type(&error_text));
        }

        let search_response: ExaSearchResponse = response
            .json()
            .await
            .map_err(|e| ResolverError::ParseError(e.to_string()))?;

        let results = search_response
            .results
            .unwrap_or_default()
            .into_iter()
            .map(|r| ResolvedResult::new(
                r.url,
                r.highlight,
                "exa",
                r.score,
            ))
            .collect();

        Ok(results)
    }
}

#[derive(Debug, Serialize)]
struct ExaSearchRequest {
    query: String,
    num_results: usize,
    highlights: bool,
    #[serde(default)]
    highlights_per_result: usize,
}

#[derive(Debug, Deserialize)]
struct ExaSearchResponse {
    #[serde(default)]
    results: Option<Vec<ExaSearchResult>>,
}

#[derive(Debug, Deserialize)]
struct ExaSearchResult {
    url: String,
    #[serde(default)]
    highlight: Option<String>,
    #[serde(default)]
    score: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::QueryProvider;

    #[test]
    fn test_provider_name() {
        let provider = ExaSdkProvider::new();
        assert_eq!(provider.name(), "exa");
    }
}
