//! Direct HTTP fetch provider.
//!
//! Basic content extraction from HTML.

use crate::error::{ResolverError, detect_error_type};
use crate::types::ResolvedResult;
use async_trait::async_trait;
use std::collections::HashSet;
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
            return Err(ResolverError::RateLimit(
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
            .map_err(|e| ResolverError::Network(e.to_string()))?;

        if response.status() == 429 {
            self.set_rate_limited(true);
            return Err(ResolverError::RateLimit("Rate limit exceeded".to_string()));
        }

        if response.status() == 404 {
            return Err(ResolverError::NotFound("URL not found".to_string()));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(detect_error_type(&error_text));
        }

        let html = response
            .text()
            .await
            .map_err(|e| ResolverError::Parse(e.to_string()))?;

        // Simple HTML to text conversion
        let content = strip_html(&html);

        Ok(ResolvedResult::new(url, Some(content), "direct_fetch", 0.5))
    }
}

/// Decode basic HTML entities
fn decode_entities(text: &str) -> String {
    text.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#x27;", "'")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
        .replace("&copy;", "©")
        .replace("&reg;", "®")
        .replace("&trade;", "™")
        .replace("&ndash;", "–")
        .replace("&mdash;", "—")
        .replace("&lsquo;", "‘")
        .replace("&rsquo;", "’")
        .replace("&ldquo;", "“")
        .replace("&rdquo;", "”")
        .replace("&#8288;", "") // word joiner
        .replace("&amp;", "&") // Ampersand last to avoid double-unescaping
        .replace("\u{2060}", "") // Remove word joiner
}

/// Get an attribute value from a tag string
fn get_attribute(tag_content: &str, attr_name: &str) -> Option<String> {
    let lower = tag_content.to_lowercase();
    let pattern = format!("{}=", attr_name);
    if let Some(start) = lower.find(&pattern) {
        let value_part = &tag_content[start + pattern.len()..];
        if let Some(stripped) = value_part.strip_prefix('"') {
            if let Some(end) = stripped.find('"') {
                return Some(stripped[..end].to_string());
            }
        } else if let Some(stripped) = value_part.strip_prefix('\'') {
            if let Some(end) = stripped.find('\'') {
                return Some(stripped[..end].to_string());
            }
        } else {
            // Unquoted attribute
            let end = value_part
                .find(|c: char| c.is_whitespace() || c == '/' || c == '>')
                .unwrap_or(value_part.len());
            return Some(value_part[..end].to_string());
        }
    }
    None
}

/// Parse language hint from class attribute
fn parse_language_hint(class_attr: &str) -> Option<String> {
    for part in class_attr.split_whitespace() {
        if let Some(lang) = part.strip_prefix("language-") {
            return Some(lang.to_string());
        }
        if let Some(lang) = part.strip_prefix("lang-") {
            return Some(lang.to_string());
        }
        if part == "rust" {
            return Some("rust".to_string());
        }
    }
    None
}

/// Strip HTML tags and convert to plain text with basic formatting
fn strip_html(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    let mut current_tag = String::new();
    let mut skip_content_depth: usize = 0;
    let mut in_pre = false;
    let mut current_pre_lang = String::new();

    let block_tags: HashSet<&str> = [
        "p",
        "div",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "li",
        "tr",
        "pre",
        "br",
        "article",
        "section",
        "header",
        "footer",
        "nav",
        "aside",
        "main",
        "figure",
        "figcaption",
    ]
    .iter()
    .cloned()
    .collect();

    for ch in html.chars() {
        if ch == '<' {
            in_tag = true;
            current_tag.clear();
        } else if ch == '>' {
            in_tag = false;
            let tag_lower = current_tag.to_lowercase();
            let is_closing = tag_lower.starts_with('/');
            let tag_name = tag_lower
                .trim_start_matches('/')
                .split_whitespace()
                .next()
                .unwrap_or("");

            if tag_name == "script" || tag_name == "style" {
                if is_closing {
                    skip_content_depth = skip_content_depth.saturating_sub(1);
                } else if !tag_lower.trim().ends_with('/') {
                    skip_content_depth += 1;
                }
            } else if skip_content_depth == 0 {
                if !is_closing {
                    // Opening tags
                    if block_tags.contains(tag_name)
                        && !result.is_empty()
                        && !result.ends_with('\n')
                    {
                        result.push('\n');
                    }
                    if tag_name == "code" {
                        if !in_pre {
                            result.push('`');
                        } else if current_pre_lang.is_empty() {
                            // If we're in a <pre> block but haven't found a language hint yet, check the <code> tag
                            if let Some(lang) = get_attribute(&current_tag, "class")
                                .and_then(|c| parse_language_hint(&c))
                            {
                                // Backtrack to inject the language hint if the current block is empty of content
                                if result.ends_with("\n```\n") {
                                    result.truncate(result.len() - 1); // Remove trailing newline
                                    result.push_str(&lang);
                                    result.push('\n');
                                    current_pre_lang = lang;
                                }
                            }
                        }
                    } else if tag_name == "pre" {
                        in_pre = true;
                        current_pre_lang = get_attribute(&current_tag, "class")
                            .and_then(|c| parse_language_hint(&c))
                            .unwrap_or_default();
                        result.push_str("\n```");
                        result.push_str(&current_pre_lang);
                        result.push('\n');
                    } else if tag_name == "img" {
                        if let Some(alt) = get_attribute(&current_tag, "alt") {
                            if !alt.is_empty() {
                                result.push(' ');
                                result.push_str(&alt);
                                result.push(' ');
                            }
                        }
                    }
                } else {
                    // Closing tags
                    if tag_name == "code" {
                        if !in_pre {
                            result.push('`');
                        }
                    } else if tag_name == "pre" {
                        in_pre = false;
                        if !result.ends_with('\n') {
                            result.push('\n');
                        }
                        result.push_str("```\n");
                    } else if block_tags.contains(tag_name)
                        && !result.is_empty()
                        && !result.ends_with('\n')
                    {
                        result.push('\n');
                    }
                }
            }
        } else if in_tag {
            current_tag.push(ch);
        } else if skip_content_depth == 0 {
            result.push(ch);
        }
    }

    let decoded = decode_entities(&result);

    // Clean up whitespace
    let mut final_result = String::new();
    let mut last_was_empty = false;

    for line in decoded.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if !last_was_empty && !final_result.is_empty() {
                final_result.push_str("\n\n");
                last_was_empty = true;
            }
        } else {
            final_result.push_str(trimmed);
            final_result.push('\n');
            last_was_empty = false;
        }
    }

    final_result.trim().to_string()
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
        let html = "<html><body><h1>Title</h1><p>Hello <b>world</b> &amp; others</p><script>alert(1)</script></body></html>";
        let result = strip_html(html);
        assert!(result.contains("Title"));
        assert!(result.contains("Hello world & others"));
        assert!(!result.contains("alert(1)"));
    }

    #[test]
    fn test_code_blocks() {
        let html = "<p>Use <code>fn main()</code></p><pre>println!(\"Hi\");</pre>";
        let result = strip_html(html);
        assert!(result.contains("`fn main()`"));
        assert!(result.contains("```"));
        assert!(result.contains("println!(\"Hi\");"));
    }

    #[test]
    fn test_code_blocks_with_lang() {
        let html = "<pre class=\"language-rust\"><code>fn main() {}</code></pre>";
        let result = strip_html(html);
        assert!(result.contains("```rust"));
        assert!(!result.contains("`` ` ``")); // Ensure no double backticks
    }

    #[test]
    fn test_code_blocks_nested_lang() {
        let html = "<pre><code class=\"language-python\">print(1)</code></pre>";
        let result = strip_html(html);
        assert!(result.contains("```python"));
    }

    #[test]
    fn test_img_alt() {
        let html = "<img src=\"math.svg\" alt=\"x^2 + y^2 = z^2\">";
        let result = strip_html(html);
        assert!(result.contains("x^2 + y^2 = z^2"));
    }

    #[test]
    fn test_extended_entities() {
        let html = "<p>Copyright &copy; 2026 &mdash; All rights &reg; reserved &trade;.</p>";
        let result = strip_html(html);
        assert!(result.contains("Copyright © 2026 — All rights ® reserved ™."));
    }
}
