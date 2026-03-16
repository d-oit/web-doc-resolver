//! Mistral browser provider.
//!
//! Uses Mistral agent with web browsing capability.

use crate::error::{ResolverError, detect_error_type};
use crate::types::ResolvedResult;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::env;
use std::result::Result;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

/// Mistral browser provider
pub struct MistralBrowserProvider {
    client: reqwest::Client,
    api_key: Option<String>,
    rate_limited: Arc<AtomicBool>,
}

impl MistralBrowserProvider {
    /// Create a new Mistral browser provider
    pub fn new() -> Self {
        let api_key = env::var("MISTRAL_API_KEY").ok();
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

impl Default for MistralBrowserProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl crate::providers::UrlProvider for MistralBrowserProvider {
    fn name(&self) -> &str {
        "mistral_browser"
    }

    fn is_available(&self) -> bool {
        self.api_key.is_some() && !self.is_rate_limited()
    }

    async fn extract(&self, url: &str) -> Result<ResolvedResult, ResolverError> {
        let api_key = self
            .api_key
            .as_ref()
            .ok_or_else(|| ResolverError::AuthError("MISTRAL_API_KEY not set".to_string()))?;

        if self.is_rate_limited() {
            return Err(ResolverError::RateLimitError(
                "Mistral is rate limited".to_string(),
            ));
        }

        // Use Mistral agents API with web browsing
        let response = self
            .client
            .post("https://api.mistral.ai/v1/agents/execute")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&MistralBrowserRequest {
                agent_id: "browser".to_string(),
                inputs: MistralInputs {
                    url: url.to_string(),
                    task: "Extract all text content from this webpage in markdown format"
                        .to_string(),
                },
            })
            .send()
            .await
            .map_err(|e| ResolverError::NetworkError(e.to_string()))?;

        if response.status() == 429 {
            self.set_rate_limited(true);
            return Err(ResolverError::RateLimitError(
                "Mistral rate limit exceeded".to_string(),
            ));
        }

        if response.status() == 401 {
            return Err(ResolverError::AuthError(
                "Mistral authentication failed".to_string(),
            ));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(detect_error_type(&error_text));
        }

        let browser_response: MistralBrowserResponse = response
            .json()
            .await
            .map_err(|e| ResolverError::ParseError(e.to_string()))?;

        let content = browser_response.output.and_then(|o| o.text);

        Ok(ResolvedResult::new(url, content, "mistral_browser", 0.85))
    }
}

#[derive(Debug, Serialize)]
struct MistralBrowserRequest {
    #[serde(rename = "agent_id")]
    agent_id: String,
    inputs: MistralInputs,
}

#[derive(Debug, Serialize)]
struct MistralInputs {
    url: String,
    task: String,
}

#[derive(Debug, Deserialize)]
struct MistralBrowserResponse {
    #[serde(default)]
    output: Option<MistralOutput>,
}

#[derive(Debug, Deserialize)]
struct MistralOutput {
    #[serde(default)]
    text: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::UrlProvider;

    #[test]
    fn test_provider_name() {
        let provider = MistralBrowserProvider::new();
        assert_eq!(provider.name(), "mistral_browser");
    }
}
