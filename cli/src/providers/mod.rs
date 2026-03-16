//! Provider modules for the Web Documentation Resolver.
//!
//! Each provider is in its own module.

pub mod direct_fetch;
pub mod docling;
pub mod duckduckgo;
pub mod exa_mcp;
pub mod exa_sdk;
pub mod firecrawl;
pub mod jina;
pub mod llms_txt;
pub mod mistral_browser;
pub mod mistral_websearch;
pub mod ocr;
pub mod serper;
pub mod tavily;

pub use self::direct_fetch::DirectFetchProvider;
pub use self::duckduckgo::DuckDuckGoProvider;
pub use self::exa_mcp::ExaMcpProvider;
pub use self::exa_sdk::ExaSdkProvider;
pub use self::firecrawl::FirecrawlProvider;
pub use self::jina::JinaProvider;
pub use self::llms_txt::LlmsTxtProvider;
pub use self::mistral_browser::MistralBrowserProvider;
pub use self::mistral_websearch::MistralWebSearchProvider;
pub use self::serper::SerperProvider;
pub use self::tavily::TavilyProvider;
pub use docling::DoclingProvider;
pub use ocr::OcrProvider;

use crate::error::ResolverError;
use crate::types::ResolvedResult;
use async_trait::async_trait;

/// Provider trait for query resolution
#[async_trait]
pub trait QueryProvider: Send + Sync {
    /// Provider name - kept for API consistency and future logging use
    #[allow(dead_code)]
    fn name(&self) -> &str;

    /// Check if provider is available (API key set, etc.)
    fn is_available(&self) -> bool;

    /// Search for query
    async fn search(&self, query: &str, limit: usize)
    -> Result<Vec<ResolvedResult>, ResolverError>;
}

/// Provider trait for URL resolution
#[async_trait]
pub trait UrlProvider: Send + Sync {
    /// Provider name - kept for API consistency and future logging use
    #[allow(dead_code)]
    fn name(&self) -> &str;

    /// Check if provider is available
    fn is_available(&self) -> bool;

    /// Extract content from URL
    async fn extract(&self, url: &str) -> Result<ResolvedResult, ResolverError>;
}
