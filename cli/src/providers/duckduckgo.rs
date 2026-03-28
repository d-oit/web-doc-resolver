//! DuckDuckGo search provider.
//!
//! Free search - no API key required.
//! Uses Jina Reader to bypass CAPTCHA protection.

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

        // Use Jina Reader as proxy to bypass CAPTCHA
        // DDG HTML endpoint returns CAPTCHA for automated requests
        // Jina Reader fetches and converts to markdown
        let ddg_url = format!(
            "https://html.duckduckgo.com/html/?q={}",
            urlencoding::encode(query)
        );
        let jina_url = format!("https://r.jina.ai/{}", ddg_url);

        let response = self
            .client
            .get(&jina_url)
            .header("Accept", "text/markdown")
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

        let markdown = response
            .text()
            .await
            .map_err(|e| ResolverError::ParseError(e.to_string()))?;

        // Parse markdown results from Jina Reader output
        let results = parse_ddg_markdown(&markdown, limit)?;

        Ok(results)
    }
}

/// Parse DuckDuckGo results from Jina Reader markdown output
fn parse_ddg_markdown(markdown: &str, limit: usize) -> Result<Vec<ResolvedResult>, ResolverError> {
    let mut results = Vec::new();

    // Jina Reader output format:
    // ## [Title](URL)
    // [domain.com/path](URL)
    // Snippet text...
    //
    // URLs are DDG redirect format: https://duckduckgo.com/l/?uddg=ENCODED_URL&rut=...

    let lines: Vec<&str> = markdown.lines().collect();
    let mut i = 0;

    while i < lines.len() && results.len() < limit {
        let line = lines[i];

        // Look for result headings: ## [Title](URL)
        if line.starts_with("## [") {
            // Extract title and URL from heading
            if let Some((title, url)) = extract_heading_info(line) {
                // Look for snippet in next few lines - collect multiple lines for better content
                let mut snippet_lines: Vec<&str> = Vec::new();
                for next_line in lines.iter().skip(i + 1).take(15) {
                    let next_line = next_line.trim();
                    // Skip empty lines and domain links
                    if next_line.is_empty() || next_line.starts_with('[') {
                        continue;
                    }
                    // Stop at next heading or feedback
                    if next_line.starts_with('#') || next_line.contains("Feedback") {
                        break;
                    }
                    // This is snippet content - collect multiple lines
                    snippet_lines.push(next_line);
                }

                // Join collected lines, limiting total snippet length
                let snippet: String = snippet_lines.join(" ").chars().take(800).collect();

                let content = if snippet.is_empty() {
                    Some(title.clone())
                } else {
                    Some(snippet)
                };

                // Improved base score for better content
                let base_score = if content.as_ref().map_or(0, |c| c.len()) >= 500 {
                    0.75
                } else {
                    0.60
                };
                results.push(ResolvedResult::new(url, content, "duckduckgo", base_score));
            }
        }

        i += 1;
    }

    Ok(results)
}

/// Extract title and URL from markdown heading like: ## [Title](URL)
fn extract_heading_info(line: &str) -> Option<(String, String)> {
    // Format: ## [Title](URL)
    let line = line.trim_start_matches('#').trim();

    // Find [Title](URL) pattern
    if !line.starts_with('[') {
        return None;
    }

    // Find closing bracket for title
    let title_end = line.find(']')?;
    let title = line[1..title_end].to_string();

    // Find URL in parentheses
    let url_start = line.find("](")?;
    let url_end = line[url_start + 2..].find(')')?;
    let raw_url = &line[url_start + 2..url_start + 2 + url_end];

    // Decode DDG redirect URL if needed
    let url = decode_ddg_url(raw_url)?;

    Some((title, url))
}

/// Decode DuckDuckGo redirect URL
/// Format: https://duckduckgo.com/l/?uddg=ENCODED_URL&rut=...
fn decode_ddg_url(url: &str) -> Option<String> {
    // Check if it's a DDG redirect URL
    if url.contains("duckduckgo.com/l/?") && url.contains("uddg=") {
        // Extract the uddg parameter
        if let Some(start) = url.find("uddg=") {
            let start = start + 5;
            let end = url[start..].find('&').unwrap_or_else(|| url[start..].len());

            let encoded = &url[start..start + end];
            if let Ok(decoded) = urlencoding::decode(encoded) {
                let decoded_url = decoded.to_string();
                if decoded_url.starts_with("http://") || decoded_url.starts_with("https://") {
                    return Some(decoded_url);
                }
            }
        }
        None
    } else if url.starts_with("http://") || url.starts_with("https://") {
        // Direct URL, return as-is
        Some(url.to_string())
    } else {
        None
    }
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
    fn test_extract_heading_info() {
        let line = "## [Rust Programming Language](https://duckduckgo.com/l/?uddg=https%3A%2F%2Frust-lang.org&rut=abc)";
        let result = extract_heading_info(line);
        assert!(result.is_some());
        let (title, url) = result.unwrap();
        assert_eq!(title, "Rust Programming Language");
        assert_eq!(url, "https://rust-lang.org");
    }

    #[test]
    fn test_decode_ddg_url() {
        let url = "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com&rut=abc";
        let decoded = decode_ddg_url(url);
        assert_eq!(decoded, Some("https://example.com".to_string()));
    }

    #[test]
    fn test_parse_ddg_markdown() {
        let markdown = r#"# rust programming language at DuckDuckGo

## [Rust Programming Language](https://duckduckgo.com/l/?uddg=https%3A%2F%2Frust-lang.org&rut=abc)

[rust-lang.org](https://duckduckgo.com/l/?uddg=https%3A%2F%2Frust-lang.org&rut=abc)

Rust is a fast, reliable, and productive programming language.

## [Rust (programming language) - Wikipedia](https://duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FRust&rut=def)

Rust is a general-purpose programming language.
"#;
        let results = parse_ddg_markdown(markdown, 5).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].url, "https://rust-lang.org");
    }
}
