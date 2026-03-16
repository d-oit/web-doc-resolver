//! Direct HTTP fetch provider.
//!
//! Basic content extraction from HTML.

use crate::error::{ResolverError, detect_error_type};
use crate::types::ResolvedResult;
use async_trait::async_trait;
use std::result::Result;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

/// Direct HTTP fetch provider
pub struct DirectFetchProvider {
    client: reqwest::Client,
    rate_limited: Arc<AtomicBool>,
}

impl DirectFetchProvider {
    /// Create a new direct fetch provider
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

impl Default for DirectFetchProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl crate::providers::UrlProvider for DirectFetchProvider {
    fn name(&self) -> &str {
        "direct_fetch"
    }

    fn is_available(&self) -> bool {
        !self.is_rate_limited()
    }

    async fn extract(&self, url: &str) -> Result<ResolvedResult, ResolverError> {
        if self.is_rate_limited() {
            return Err(ResolverError::RateLimitError(
                "Direct fetch is rate limited".to_string(),
            ));
        }

        let response = self
            .client
            .get(url)
            .header("User-Agent", "WDR/1.0 (LLM documentation resolver)")
            .header("Accept", "text/html,application/xhtml+xml")
            .send()
            .await
            .map_err(|e| ResolverError::NetworkError(e.to_string()))?;

        if response.status() == 429 {
            self.set_rate_limited(true);
            return Err(ResolverError::RateLimitError(
                "Rate limit exceeded".to_string(),
            ));
        }

        if response.status() == 404 {
            return Err(ResolverError::NotFoundError("URL not found".to_string()));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(detect_error_type(&error_text));
        }

        let html = response
            .text()
            .await
            .map_err(|e| ResolverError::ParseError(e.to_string()))?;

        // Simple HTML to text conversion
        let content = strip_html(&html);

        Ok(ResolvedResult::new(
            url,
            Some(content),
            "direct_fetch",
            0.5,
        ))
    }
}

/// Strip HTML tags and convert to plain text
fn strip_html(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    let mut in_script = false;
    let mut in_style = false;

    for line in html.lines() {
        let line_lower = line.to_lowercase();

        // Check for script/style tags
        if line_lower.contains("<script") {
            in_script = true;
        }
        if line_lower.contains("</script>") {
            in_script = false;
            continue;
        }
        if line_lower.contains("<style") {
            in_style = true;
        }
        if line_lower.contains("</style>") {
            in_style = false;
            continue;
        }

        if in_script || in_style {
            continue;
        }

        for ch in line.chars() {
            match ch {
                '<' => in_tag = true,
                '>' => in_tag = false,
                _ if !in_tag => result.push(ch),
                _ => {}
            }
        }
        result.push(' ');
    }

    // Clean up whitespace
    result.split_whitespace().collect::<Vec<_>>().join("\n\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::UrlProvider;

    #[test]
    fn test_provider_name() {
        let provider = DirectFetchProvider::new();
        assert_eq!(provider.name(), "direct_fetch");
    }

    #[test]
    fn test_strip_html() {
        let html = "<p>Hello <b>world</b></p>";
        let result = strip_html(html);
        assert!(result.contains("Hello"));
        assert!(result.contains("world"));
    }
}
