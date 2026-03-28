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

        // Use correct MCP protocol: tools/call with nested arguments
        let mcp_request = ExaMcpRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "tools/call".to_string(),
            params: ExaMcpParams {
                name: "web_search_exa".to_string(),
                arguments: ExaMcpArguments {
                    query: query.to_string(),
                    num_results: limit,
                },
            },
        };

        let response = self
            .client
            .post("https://mcp.exa.ai/mcp")
            .header("Content-Type", "application/json")
            // Required: accept both JSON and SSE
            .header("Accept", "application/json, text/event-stream")
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

        // Response is SSE format: "event: message\ndata: {...}\n\n"
        let text = response
            .text()
            .await
            .map_err(|e| ResolverError::ParseError(e.to_string()))?;

        // Extract JSON from SSE data line
        let json_str = text
            .lines()
            .find(|l| l.starts_with("data: "))
            .map(|l| &l[6..])
            .unwrap_or("");

        let mcp_response: ExaMcpResponse = serde_json::from_str(json_str).map_err(|e| {
            ResolverError::ParseError(format!("Failed to parse MCP response: {}", e))
        })?;

        // Parse the formatted text content into results
        let results = parse_exa_mcp_text(&mcp_response);

        Ok(results)
    }
}

/// Parse Exa MCP formatted text response into results
fn parse_exa_mcp_text(response: &ExaMcpResponse) -> Vec<ResolvedResult> {
    let mut results = Vec::new();

    for content in &response.result.content {
        if content.type_name == "text" {
            // Parse formatted text: Title: ... URL: ... Published: ... Highlights: ...
            let text = &content.text;
            let lines: Vec<&str> = text.lines().collect();
            let mut i = 0;

            while i < lines.len() {
                let line = lines[i];

                if let Some(title) = line.strip_prefix("Title: ") {
                    let mut url: Option<String> = None;
                    let mut highlights = String::new();
                    let mut description = String::new();

                    // Look for URL, Highlights, and other fields in next lines
                    for j in (i + 1)..std::cmp::min(i + 25, lines.len()) {
                        if lines[j].starts_with("Title: ") {
                            // Next result starts, stop looking
                            break;
                        }
                        if let Some(url_str) = lines[j].strip_prefix("URL: ") {
                            url = Some(url_str.to_string());
                        } else if lines[j].starts_with("Highlights:") {
                            // Collect highlight lines until --- or next Title
                            // Increased from 30 to 100 for more content
                            for highlight_line in lines.iter().skip(j + 1).take(100) {
                                if highlight_line.starts_with("---")
                                    || highlight_line.starts_with("Title: ")
                                {
                                    break;
                                }
                                if !highlight_line.is_empty() {
                                    if !highlights.is_empty() {
                                        highlights.push(' ');
                                    }
                                    highlights.push_str(highlight_line.trim());
                                }
                            }
                        } else if let Some(desc) = lines[j].strip_prefix("Description: ") {
                            description = desc.to_string();
                        } else if lines[j].starts_with("---") {
                            break;
                        }
                    }

                    if let Some(url) = url {
                        // Use highlights first, then description as fallback
                        let content = if !highlights.is_empty() {
                            Some(highlights)
                        } else if !description.is_empty() {
                            Some(description)
                        } else {
                            Some(title.to_string())
                        };

                        // Improved base score based on content length
                        let base_score = match content.as_ref().map_or(0, |c| c.len()) {
                            l if l >= 500 => 0.80,
                            l if l >= 300 => 0.75,
                            l if l >= 150 => 0.70,
                            _ => 0.65,
                        };
                        results.push(ResolvedResult::new(url, content, "exa_mcp", base_score));
                    }
                }

                i += 1;
            }
        }
    }

    results
}

#[derive(Debug, Serialize)]
struct ExaMcpRequest {
    jsonrpc: String,
    id: i32,
    method: String,
    params: ExaMcpParams,
}

#[derive(Debug, Serialize)]
struct ExaMcpParams {
    name: String,
    arguments: ExaMcpArguments,
}

#[derive(Debug, Serialize)]
struct ExaMcpArguments {
    query: String,
    #[serde(rename = "numResults")]
    num_results: usize,
}

#[derive(Debug, Deserialize)]
struct ExaMcpResponse {
    result: ExaMcpResult,
}

#[derive(Debug, Deserialize)]
struct ExaMcpResult {
    content: Vec<ExaMcpContent>,
}

#[derive(Debug, Deserialize)]
struct ExaMcpContent {
    #[serde(rename = "type")]
    type_name: String,
    text: String,
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

    #[test]
    fn test_parse_exa_mcp_text() {
        let text = r#"Title: Test Result
URL: https://example.com
Published: 2025-01-01
Author: Test

Highlights:
This is a test highlight.
Another line of highlight.

---

Title: Second Result
URL: https://example2.com
"#;
        let response = ExaMcpResponse {
            result: ExaMcpResult {
                content: vec![ExaMcpContent {
                    type_name: "text".to_string(),
                    text: text.to_string(),
                }],
            },
        };
        let results = parse_exa_mcp_text(&response);
        assert!(!results.is_empty());
        assert_eq!(results[0].url, "https://example.com");
    }
}
