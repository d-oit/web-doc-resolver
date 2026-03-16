//! Exa MCP (Model Context Protocol) provider.
//!
//! Free search via Model Context Protocol - no API key required.

use crate::error::{ResolverError, detect_error_type};
use crate::types::ResolvedResult;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::result::Result;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

/// Exa MCP provider - free search via MCP
pub struct ExaMcpProvider {
    client: reqwest::Client,
    rate_limited: Arc<AtomicBool>,
}

impl ExaMcpProvider {
    /// Create a new Exa MCP provider
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

impl Default for ExaMcpProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl crate::providers::QueryProvider for ExaMcpProvider {
    fn name(&self) -> &str {
        "exa_mcp"
    }

    fn is_available(&self) -> bool {
        // Exa MCP is always available - no API key required
        !self.is_rate_limited()
    }

    async fn search(
        &self,
        query: &str,
        limit: usize,
    ) -> Result<Vec<ResolvedResult>, ResolverError> {
        if self.is_rate_limited() {
            return Err(ResolverError::RateLimitError(
                "Exa MCP is rate limited".to_string(),
            ));
        }

        let mcp_request = ExaMcpRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "exa.search".to_string(),
            params: Some(ExaMcpParams {
                query: query.to_string(),
                num_results: limit,
                highlights: true,
            }),
        };

        let response = self
            .client
            .post("https://mcp.exa.ai/mcp")
            .json(&mcp_request)
            .send()
            .await
            .map_err(|e| ResolverError::NetworkError(e.to_string()))?;

        if response.status() == 429 {
            self.set_rate_limited(true);
            return Err(ResolverError::RateLimitError(
                "Exa MCP rate limit exceeded".to_string(),
            ));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(detect_error_type(&error_text));
        }

        let mcp_response: ExaMcpResponse = response
            .json()
            .await
            .map_err(|e| ResolverError::ParseError(e.to_string()))?;

        let results = mcp_response
            .results
            .unwrap_or_default()
            .into_iter()
            .map(|r| ResolvedResult::new(r.url, r.highlight.or(r.text), "exa_mcp", r.score))
            .collect();

        Ok(results)
    }
}

#[derive(Debug, Serialize)]
struct ExaMcpRequest {
    jsonrpc: String,
    id: i32,
    method: String,
    params: Option<ExaMcpParams>,
}

#[derive(Debug, Serialize)]
struct ExaMcpParams {
    query: String,
    num_results: usize,
    highlights: bool,
}

#[derive(Debug, Deserialize)]
struct ExaMcpResponse {
    #[serde(default)]
    results: Option<Vec<ExaMcpResult>>,
}

#[derive(Debug, Deserialize)]
struct ExaMcpResult {
    url: String,
    #[serde(default)]
    text: Option<String>,
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
        let provider = ExaMcpProvider::new();
        assert_eq!(provider.name(), "exa_mcp");
    }

    #[test]
    fn test_provider_availability() {
        let provider = ExaMcpProvider::new();
        assert!(provider.is_available());
    }
}
