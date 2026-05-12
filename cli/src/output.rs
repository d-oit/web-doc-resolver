//! Output formatting module.
//!
//! Handles stdout/stderr formatting for the CLI.

use crate::types::ResolvedResult;
use serde::Serialize;

/// JSON output wrapper
#[derive(Serialize)]
pub struct JsonOutput<'a> {
    pub source: &'a str,
    pub url: &'a str,
    pub content: Option<&'a str>,
    pub score: f64,
}

impl<'a> JsonOutput<'a> {
    /// Create from resolved result
    pub fn from_result(result: &'a ResolvedResult) -> Self {
        Self {
            source: &result.source,
            url: &result.url,
            content: result.content.as_deref(),
            score: result.score,
        }
    }

    /// Create error output
    #[allow(dead_code)]
    pub fn error(_msg: &'a str) -> Self {
        Self {
            source: "none",
            url: "",
            content: None,
            score: 0.0,
        }
    }

    /// Print to stdout
    pub fn print(&self) {
        if let Ok(json) = serde_json::to_string_pretty(self) {
            println!("{}", json);
        }
    }
}

/// Plain text output
pub struct TextOutput;

impl TextOutput {
    /// Print resolved result to stdout
    pub fn print_result(result: &ResolvedResult) {
        if let Some(content) = &result.content {
            println!("{}", content);
        } else {
            eprintln!("No content returned");
        }
    }

    /// Print error to stderr
    pub fn print_error(error: &str) {
        eprintln!("Error: {}", error);
    }

    /// Print info message to stderr
    pub fn print_info(msg: &str) {
        eprintln!("Info: {}", msg);
    }

    /// Print success message to stdout
    pub fn print_success(msg: &str) {
        println!("{}", msg);
    }
}

/// Provider list output
pub struct ProviderList;

impl ProviderList {
    /// Print available providers
    pub fn print() {
        println!("Available providers:");
        println!();
        println!("Query providers:");
        println!("  - exa_mcp: Exa MCP (free, no API key required)");
        println!("  - exa: Exa SDK (requires EXA_API_KEY)");
        println!("  - tavily: Tavily search (requires TAVILY_API_KEY)");
        println!("  - duckduckgo: DuckDuckGo (free, no API key required)");
        println!("  - mistral_websearch: Mistral web search (requires MISTRAL_API_KEY)");
        println!();
        println!("URL providers:");
        println!("  - llms_txt: Check for llms.txt (free)");
        println!("  - jina: Jina Reader (free)");
        println!("  - firecrawl: Firecrawl extraction (requires FIRECRAWL_API_KEY)");
        println!("  - direct_fetch: Direct HTTP fetch (free)");
        println!("  - mistral_browser: Mistral browser (requires MISTRAL_API_KEY)");
    }
}

/// Config output
pub struct ConfigOutput;

impl ConfigOutput {
    /// Print configuration
    pub fn print(config: &crate::Config) {
        println!("Current configuration:");
        println!("  max_chars: {}", config.max_chars);
        println!("  min_chars: {}", config.min_chars);
        println!("  exa_results: {}", config.exa_results);
        println!("  tavily_results: {}", config.tavily_results);
        println!("  output_limit: {}", config.output_limit);
        println!("  log_level: {}", config.log_level);
        println!("  skip_providers: {:?}", config.skip_providers);
        println!("  providers_order: {:?}", config.providers_order);
        println!(
            "  semantic_cache.enabled: {}",
            config.semantic_cache.enabled
        );
        println!("  semantic_cache.path: {}", config.semantic_cache.path);
        println!(
            "  semantic_cache.threshold: {}",
            config.semantic_cache.threshold
        );
    }
}

/// Cache stats output
pub struct CacheStatsOutput;

impl CacheStatsOutput {
    /// Print cache statistics
    pub fn print(stats: &crate::semantic_cache::CacheStats) {
        println!("Cache statistics:");
        println!("  entries: {}", stats.entries);
        println!("  hit_rate: {:.2}", stats.hit_rate);
        println!("  path: {}", stats.path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_json_output_from_result() {
        let result = ResolvedResult::new(
            "https://example.com",
            Some("Test content".to_string()),
            "jina",
            0.95,
        );
        let json = JsonOutput::from_result(&result);
        assert_eq!(json.source, "jina");
        assert_eq!(json.score, 0.95);
    }

    #[test]
    fn test_json_output_error() {
        let json = JsonOutput::error("Test error");
        assert_eq!(json.source, "none");
    }
}
