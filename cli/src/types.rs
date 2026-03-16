//! Types for the Web Documentation Resolver.

use serde::{Deserialize, Serialize};
use crate::metrics::ResolveMetrics;

/// Result from resolving a URL or query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedResult {
    /// The URL of the result
    pub url: String,
    /// The content in markdown format
    pub content: Option<String>,
    /// Source provider
    pub source: String,
    /// Relevance score (0.0 - 1.0)
    pub score: f64,
    /// Telemetry and metrics
    pub metrics: Option<ResolveMetrics>,
    /// Validated links found in content
    pub validated_links: Vec<String>,
}

impl ResolvedResult {
    /// Create a new resolved result
    #[allow(dead_code)]
    pub fn new(
        url: impl Into<String>,
        content: Option<String>,
        source: impl Into<String>,
        score: f64,
    ) -> Self {
        Self {
            url: url.into(),
            content,
            source: source.into(),
            score,
            metrics: None,
            validated_links: Vec::new(),
        }
    }

    /// Check if result has valid content
    pub fn is_valid(&self, min_chars: usize) -> bool {
        self.content
            .as_ref()
            .map(|c| c.len() >= min_chars)
            .unwrap_or(false)
    }
}

/// Execution profiles for resource management
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum Profile {
    /// Use only free providers
    Free,
    /// Balance cost and quality (default)
    #[default]
    Balanced,
    /// Prioritize speed, skip slow providers
    Fast,
    /// Prioritize quality, use best (even paid) providers
    Quality,
}

impl std::str::FromStr for Profile {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "free" => Ok(Profile::Free),
            "balanced" => Ok(Profile::Balanced),
            "fast" => Ok(Profile::Fast),
            "quality" => Ok(Profile::Quality),
            _ => Err(format!("Unknown profile: {}", s)),
        }
    }
}

impl Profile {
    /// Get allowed provider types for this profile
    pub fn is_provider_allowed(&self, provider: ProviderType) -> bool {
        match self {
            Profile::Free => !provider.is_paid(),
            Profile::Fast => provider.is_fast(),
            Profile::Balanced => true,
            Profile::Quality => true,
        }
    }

    /// Get max hops/cascade depth for this profile
    pub fn max_hops(&self) -> usize {
        match self {
            Profile::Free => 3,
            Profile::Fast => 2,
            Profile::Balanced => 5,
            Profile::Quality => 8,
        }
    }
}

/// Provider types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderType {
    /// Exa MCP (free)
    ExaMcp,
    /// Exa SDK (requires API key)
    Exa,
    /// Tavily (requires API key)
    Tavily,
    /// Serper Google Search (requires API key, 2500 free credits)
    Serper,
    /// DuckDuckGo (free)
    DuckDuckGo,
    /// Mistral web search (requires API key)
    MistralWebSearch,
    /// llms.txt (free)
    LlmsTxt,
    /// Jina Reader (free)
    Jina,
    /// Firecrawl (requires API key)
    Firecrawl,
    /// Direct HTTP fetch (free)
    DirectFetch,
    /// Mistral browser (requires API key)
    MistralBrowser,
}

impl ProviderType {
    /// Get provider name as string
    pub fn name(&self) -> &'static str {
        match self {
            ProviderType::ExaMcp => "exa_mcp",
            ProviderType::Exa => "exa",
            ProviderType::Tavily => "tavily",
            ProviderType::Serper => "serper",
            ProviderType::DuckDuckGo => "duckduckgo",
            ProviderType::MistralWebSearch => "mistral_websearch",
            ProviderType::LlmsTxt => "llms_txt",
            ProviderType::Jina => "jina",
            ProviderType::Firecrawl => "firecrawl",
            ProviderType::DirectFetch => "direct_fetch",
            ProviderType::MistralBrowser => "mistral_browser",
        }
    }

    /// Check if this is a query provider
    pub fn is_query_provider(&self) -> bool {
        matches!(
            self,
            ProviderType::ExaMcp
                | ProviderType::Exa
                | ProviderType::Tavily
                | ProviderType::Serper
                | ProviderType::DuckDuckGo
                | ProviderType::MistralWebSearch
        )
    }

    /// Check if this is a URL provider
    pub fn is_url_provider(&self) -> bool {
        matches!(
            self,
            ProviderType::LlmsTxt
                | ProviderType::Jina
                | ProviderType::Firecrawl
                | ProviderType::DirectFetch
                | ProviderType::MistralBrowser
        )
    }

    /// Check if this is a paid provider
    pub fn is_paid(&self) -> bool {
        matches!(
            self,
            ProviderType::Exa | ProviderType::Tavily | ProviderType::Firecrawl | ProviderType::MistralWebSearch
        )
    }

    /// Check if this is a fast provider
    pub fn is_fast(&self) -> bool {
        matches!(
            self,
            ProviderType::ExaMcp | ProviderType::DuckDuckGo | ProviderType::LlmsTxt | ProviderType::Jina
        )
    }
}

impl std::fmt::Display for ProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name())
    }
}

impl std::str::FromStr for ProviderType {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s {
            "exa_mcp" => Ok(ProviderType::ExaMcp),
            "exa" => Ok(ProviderType::Exa),
            "tavily" => Ok(ProviderType::Tavily),
            "serper" => Ok(ProviderType::Serper),
            "duckduckgo" => Ok(ProviderType::DuckDuckGo),
            "mistral_websearch" => Ok(ProviderType::MistralWebSearch),
            "llms_txt" => Ok(ProviderType::LlmsTxt),
            "jina" => Ok(ProviderType::Jina),
            "firecrawl" => Ok(ProviderType::Firecrawl),
            "direct_fetch" => Ok(ProviderType::DirectFetch),
            "mistral_browser" => Ok(ProviderType::MistralBrowser),
            _ => Err(format!("Unknown provider: {}", s)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolved_result_valid() {
        let result = ResolvedResult::new(
            "https://example.com",
            Some("content".to_string()),
            "test",
            1.0,
        );
        assert!(result.is_valid(5));
        assert!(!result.is_valid(100));
    }

    #[test]
    fn test_provider_type_names() {
        assert_eq!(ProviderType::ExaMcp.name(), "exa_mcp");
        assert_eq!(ProviderType::Tavily.name(), "tavily");
    }

    #[test]
    fn test_provider_type_query() {
        assert!(ProviderType::ExaMcp.is_query_provider());
        assert!(!ProviderType::ExaMcp.is_url_provider());
        assert!(ProviderType::LlmsTxt.is_url_provider());
        assert!(!ProviderType::LlmsTxt.is_query_provider());
    }
}
