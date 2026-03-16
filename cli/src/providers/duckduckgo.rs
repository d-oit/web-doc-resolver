//! DuckDuckGo search provider.
//!
//! Free search - no API key required.

use crate::error::{ResolverError, detect_error_type};
use crate::types::ResolvedResult;
use async_trait::async_trait;
use std::result::Result;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

/// DuckDuckGo search provider
pub struct DuckDuckGoProvider {
    client: reqwest::Client,
    rate_limited: Arc<AtomicBool>,
}

impl DuckDuckGoProvider {
    /// Create a new DuckDuckGo provider
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

impl Default for DuckDuckGoProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl crate::providers::QueryProvider for DuckDuckGoProvider {
    fn name(&self) -> &str {
        "duckduckgo"
    }

    fn is_available(&self) -> bool {
        !self.is_rate_limited()
    }

    async fn search(
        &self,
        query: &str,
        limit: usize,
    ) -> Result<Vec<ResolvedResult>, ResolverError> {
        if self.is_rate_limited() {
            return Err(ResolverError::RateLimitError(
                "DuckDuckGo is rate limited".to_string(),
            ));
        }

        // Use HTML endpoint for better results
        let url = format!(
            "https://html.duckduckgo.com/html/?q={}&b={}",
            urlencoding::encode(query),
            limit
        );

        let response = self
            .client
            .get(&url)
            .header("User-Agent", "Mozilla/5.0 (compatible; WDR/1.0)")
            .send()
            .await
            .map_err(|e| ResolverError::NetworkError(e.to_string()))?;

        if response.status() == 429 {
            self.set_rate_limited(true);
            return Err(ResolverError::RateLimitError(
                "DuckDuckGo rate limit exceeded".to_string(),
            ));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(detect_error_type(&error_text));
        }

        let html = response
            .text()
            .await
            .map_err(|e| ResolverError::ParseError(e.to_string()))?;

        // Parse HTML results
        let results = parse_ddg_results(&html, limit)?;

        Ok(results)
    }
}

/// Parse DuckDuckGo HTML results
fn parse_ddg_results(html: &str, limit: usize) -> Result<Vec<ResolvedResult>, ResolverError> {
    let mut results = Vec::new();
    let mut count = 0;

    // Simple regex-free parsing
    for line in html.lines() {
        if count >= limit {
            break;
        }

        if line.contains("result__url") || line.contains("result__snippet") {
            // Extract URL and snippet
            if let Some(url) = extract_ddg_url(line) {
                let content = extract_ddg_snippet(line);
                results.push(ResolvedResult::new(url, content, "duckduckgo", 0.5));
                count += 1;
            }
        }
    }

    Ok(results)
}

fn extract_ddg_url(line: &str) -> Option<String> {
    // Simple extraction - look for href
    if let Some(start) = line.find("href=\"") {
        let start = start + 6;
        if let Some(end) = line[start..].find('"') {
            let url = &line[start..start + end];
            if url.starts_with("http") {
                return Some(url.to_string());
            }
        }
    }
    None
}

fn extract_ddg_snippet(line: &str) -> Option<String> {
    // Simple extraction - look for snippet content
    if let Some(start) = line.find("result__snippet\">") {
        let start = start + 18;
        if let Some(end) = line[start..].find('<') {
            let snippet = &line[start..start + end];
            return Some(snippet.trim().to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::QueryProvider;

    #[test]
    fn test_provider_name() {
        let provider = DuckDuckGoProvider::new();
        assert_eq!(provider.name(), "duckduckgo");
    }

    #[test]
    fn test_provider_availability() {
        let provider = DuckDuckGoProvider::new();
        assert!(provider.is_available());
    }
}
