//! Mistral web search provider.
//!
//! Uses Mistral API for web search.

use crate::error::{ResolverError, detect_error_type};
use crate::types::ResolvedResult;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::env;
use std::result::Result;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

/// Mistral web search provider
pub struct MistralWebSearchProvider {
    client: reqwest::Client,
    api_key: Option<String>,
    rate_limited: Arc<AtomicBool>,
}

impl MistralWebSearchProvider {
    /// Create a new Mistral web search provider
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

impl Default for MistralWebSearchProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl crate::providers::QueryProvider for MistralWebSearchProvider {
    fn name(&self) -> &str {
        "mistral_websearch"
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
            .ok_or_else(|| ResolverError::AuthError("MISTRAL_API_KEY not set".to_string()))?;

        if self.is_rate_limited() {
            return Err(ResolverError::RateLimitError(
                "Mistral is rate limited".to_string(),
            ));
        }

        let response = self
            .client
            .post("https://api.mistral.ai/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&MistralRequest {
                model: "mistral-small-latest".to_string(),
                messages: vec![MistralMessage {
                    role: "user".to_string(),
                    content: format!(
                        "Search the web for: {}. Provide {} results with URLs and brief descriptions. Return as markdown with clear headers and links.",
                        query, limit
                    ),
                }],
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

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(detect_error_type(&error_text));
        }

        let mistral_response: MistralResponse = response
            .json()
            .await
            .map_err(|e| ResolverError::ParseError(e.to_string()))?;

        // Extract text content from the response
        let content = mistral_response
            .choices
            .and_then(|c| c.into_iter().next())
            .and_then(|c| c.message)
            .and_then(|m| m.content)
            .unwrap_or_default();

        if content.is_empty() {
            return Ok(vec![]);
        }

        let url = format!("https://mistral.ai/search?q={}", urlencoding::encode(query));
        let results = vec![ResolvedResult::new(
            url,
            Some(content),
            "mistral-websearch",
            0.8,
        )];

        Ok(results)
    }
}

#[derive(Debug, Serialize)]
struct MistralRequest {
    model: String,
    messages: Vec<MistralMessage>,
}

#[derive(Debug, Serialize)]
struct MistralMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct MistralResponse {
    #[serde(default)]
    choices: Option<Vec<MistralChoice>>,
}

#[derive(Debug, Deserialize)]
struct MistralChoice {
    #[serde(default)]
    message: Option<MistralMessageResponse>,
}

#[derive(Debug, Deserialize)]
struct MistralMessageResponse {
    #[serde(default)]
    content: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::QueryProvider;

    #[test]
    fn test_provider_name() {
        let provider = MistralWebSearchProvider::new();
        assert_eq!(provider.name(), "mistral_websearch");
    }
}
