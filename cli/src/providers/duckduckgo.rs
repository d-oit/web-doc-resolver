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
            "https://html.duckduckgo.com/html/?q={}",
            urlencoding::encode(query)
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
    let mut current_url: Option<String> = None;
    let mut current_snippet: Option<String> = None;
    let mut count = 0;

    // Process HTML looking for result elements
    for line in html.lines() {
        if count >= limit {
            break;
        }

        // Extract URL from DuckDuckGo redirect link
        // Format: //duckduckgo.com/l/?uddg=ENCODED_URL&rut=...
        if line.contains("result__url") || line.contains("result__a") {
            if let Some(url) = extract_ddg_url(line) {
                current_url = Some(url);
            }
        }

        // Extract snippet (may be on different line)
        if line.contains("result__snippet") {
            current_snippet = extract_ddg_snippet(line);
        }

        // Combine when we have both URL and snippet
        if let (Some(url), Some(snippet)) = (&current_url, &current_snippet) {
            results.push(ResolvedResult::new(
                url.clone(),
                Some(snippet.clone()),
                "duckduckgo",
                0.5,
            ));
            current_url = None;
            current_snippet = None;
            count += 1;
        }
    }

    // Also try to extract from the combined URL+title links (result__a class)
    // These often appear without explicit snippets
    if results.len() < limit {
        for line in html.lines() {
            if results.len() >= limit {
                break;
            }
            if line.contains("result__a") && line.contains("uddg=") {
                if let Some(url) = extract_ddg_url(line) {
                    // Check if we already have this URL
                    if !results.iter().any(|r| r.url == url) {
                        // Try to extract title as snippet
                        let snippet = extract_ddg_title(line);
                        results.push(ResolvedResult::new(url, snippet, "duckduckgo", 0.4));
                    }
                }
            }
        }
    }

    Ok(results)
}

/// Extract URL from DuckDuckGo redirect link
/// Format: //duckduckgo.com/l/?uddg=ENCODED_URL&rut=...
fn extract_ddg_url(line: &str) -> Option<String> {
    // Look for the uddg parameter which contains the actual URL
    if let Some(start) = line.find("uddg=") {
        let start = start + 5; // Skip "uddg="
        // Find the end of the URL (next & or " or end of attribute)
        let end = line[start..]
            .find('&')
            .or_else(|| line[start..].find('"'))
            .or_else(|| line[start..].find('\''))
            .unwrap_or_else(|| line[start..].len().min(500)); // Cap at reasonable length

        let encoded = &line[start..start + end];
        if let Ok(decoded) = urlencoding::decode(encoded) {
            let url = decoded.to_string();
            // Validate it's actually a URL
            if url.starts_with("http://") || url.starts_with("https://") {
                return Some(url);
            }
        }
    }
    None
}

/// Extract snippet from result__snippet element
fn extract_ddg_snippet(line: &str) -> Option<String> {
    // Look for snippet content after result__snippet">
    if let Some(start) = line.find("result__snippet\">") {
        let start = start + 17; // Skip "result__snippet">
        // Find end tag
        if let Some(end) = line[start..].find('<') {
            let snippet = &line[start..start + end];
            // Clean up HTML entities and trim
            let cleaned = snippet
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#x27;", "'")
                .trim()
                .to_string();
            if !cleaned.is_empty() {
                return Some(cleaned);
            }
        }
    }
    None
}

/// Extract title from result__a link (as fallback snippet)
fn extract_ddg_title(line: &str) -> Option<String> {
    // Look for link text between > and <
    if let Some(start) = line.find("result__a") {
        if let Some(gt) = line[start..].find('>') {
            let start = start + gt + 1;
            if let Some(end) = line[start..].find('<') {
                let title = &line[start..start + end];
                let cleaned = title
                    .replace("&amp;", "&")
                    .replace("&lt;", "<")
                    .replace("&gt;", ">")
                    .replace("&quot;", "\"")
                    .trim()
                    .to_string();
                if !cleaned.is_empty() && cleaned.len() > 3 {
                    return Some(cleaned);
                }
            }
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

    #[test]
    fn test_extract_ddg_url() {
        let line = r#"<a class="result__url" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com&amp;rut=abc">"#;
        let url = extract_ddg_url(line);
        assert_eq!(url, Some("https://example.com".to_string()));
    }

    #[test]
    fn test_extract_ddg_snippet() {
        let line = r#"<a class="result__snippet">This is a test snippet</a>"#;
        let snippet = extract_ddg_snippet(line);
        assert_eq!(snippet, Some("This is a test snippet".to_string()));
    }
}
