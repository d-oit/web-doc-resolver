//! Mistral browser provider.
//!
//! Uses Mistral agent with web search tool to extract URL content.
//! Requires two-step process: create agent with web_search tool, then start conversation.

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
            .ok_or_else(|| ResolverError::Auth("MISTRAL_API_KEY not set".to_string()))?;

        if self.is_rate_limited() {
            return Err(ResolverError::RateLimit(
                "Mistral is rate limited".to_string(),
            ));
        }

        // Step 1: Create an agent with web_search tool
        let create_response = self
            .client
            .post("https://api.mistral.ai/v1/agents")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&CreateAgentRequest {
                model: "mistral-small-latest",
                name: "url-extractor",
                instructions: "Extract and summarize content from web pages. Return clean markdown.",
                tools: vec![AgentTool { tool_type: "web_search" }],
            })
            .send()
            .await
            .map_err(|e| ResolverError::Network(e.to_string()))?;

        if create_response.status() == 429 {
            self.set_rate_limited(true);
            return Err(ResolverError::RateLimit(
                "Mistral rate limit exceeded".to_string(),
            ));
        }

        if create_response.status() == 401 {
            return Err(ResolverError::Auth(
                "Mistral authentication failed".to_string(),
            ));
        }

        if !create_response.status().is_success() {
            let error_text = create_response.text().await.unwrap_or_default();
            return Err(detect_error_type(&error_text));
        }

        let agent: AgentResponse = create_response
            .json()
            .await
            .map_err(|e| ResolverError::Parse(e.to_string()))?;

        let agent_id = agent.id;

        // Step 2: Start a conversation to extract the URL
        let conv_response = self
            .client
            .post("https://api.mistral.ai/v1/conversations")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&StartConversationRequest {
                agent_id: agent_id.clone(),
                inputs: format!(
                    "Extract the main content from this URL and return it as markdown: {}",
                    url
                ),
            })
            .send()
            .await
            .map_err(|e| ResolverError::Network(e.to_string()))?;

        let content = if conv_response.status().is_success() {
            let conv: ConversationResponse = conv_response
                .json()
                .await
                .map_err(|e| ResolverError::Parse(e.to_string()))?;

            // Extract text from message.output entries
            conv.outputs
                .into_iter()
                .filter(|o| o.entry_type.as_deref() == Some("message.output"))
                .filter_map(|o| o.content)
                .flatten()
                .filter_map(|part| {
                    if part.part_type.as_deref() == Some("text") {
                        part.text
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("\n")
        } else {
            // Cleanup on failure
            let _ = self.delete_agent(&agent_id, api_key).await;
            let error_text = conv_response.text().await.unwrap_or_default();
            return Err(detect_error_type(&error_text));
        };

        // Step 3: Cleanup - delete the agent
        let _ = self.delete_agent(&agent_id, api_key).await;

        Ok(ResolvedResult::new(
            url,
            Some(content),
            "mistral_browser",
            0.85,
        ))
    }
}

impl MistralBrowserProvider {
    async fn delete_agent(&self, agent_id: &str, api_key: &str) -> Result<(), ResolverError> {
        self.client
            .delete(format!("https://api.mistral.ai/v1/agents/{}", agent_id))
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
            .map(|_| ())
            .map_err(|e| ResolverError::Network(e.to_string()))
    }
}

#[derive(Debug, Serialize)]
struct CreateAgentRequest {
    model: &'static str,
    name: &'static str,
    instructions: &'static str,
    tools: Vec<AgentTool>,
}

#[derive(Debug, Serialize)]
struct AgentTool {
    #[serde(rename = "type")]
    tool_type: &'static str,
}

#[derive(Debug, Deserialize)]
struct AgentResponse {
    id: String,
}

#[derive(Debug, Serialize)]
struct StartConversationRequest {
    #[serde(rename = "agent_id")]
    agent_id: String,
    inputs: String,
}

#[derive(Debug, Deserialize)]
struct ConversationResponse {
    #[serde(default)]
    outputs: Vec<ConversationOutput>,
}

#[derive(Debug, Deserialize)]
struct ConversationOutput {
    #[serde(rename = "type")]
    entry_type: Option<String>,
    content: Option<Vec<ContentPart>>,
}

#[derive(Debug, Deserialize)]
struct ContentPart {
    #[serde(rename = "type")]
    part_type: Option<String>,
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
