//! Resolver module - cascade orchestrator.
//!
//! Orchestrates the provider cascade for query and URL resolution.

use crate::config::Config;
use crate::error::ResolverError;
use crate::providers::{
    DuckDuckGoProvider, ExaMcpProvider, ExaSdkProvider, FirecrawlProvider, JinaProvider,
    LlmsTxtProvider, MistralBrowserProvider, MistralWebSearchProvider, QueryProvider, UrlProvider,
};
use crate::types::{ProviderType, ResolvedResult};
use std::result::Result;

/// Main resolver struct
pub struct Resolver {
    config: Config,
    // Query providers
    exa_mcp: ExaMcpProvider,
    exa_sdk: ExaSdkProvider,
    tavily: crate::providers::TavilyProvider,
    duckduckgo: DuckDuckGoProvider,
    mistral_ws: MistralWebSearchProvider,
    // URL providers
    llms_txt: LlmsTxtProvider,
    jina: JinaProvider,
    firecrawl: FirecrawlProvider,
    direct_fetch: crate::providers::DirectFetchProvider,
    mistral_browser: MistralBrowserProvider,
}

impl Resolver {
    /// Create a new resolver with default config
    pub fn new() -> Self {
        Self::with_config(Config::default())
    }

    /// Create a new resolver with custom config
    pub fn with_config(config: Config) -> Self {
        Self {
            config,
            exa_mcp: ExaMcpProvider::new(),
            exa_sdk: ExaSdkProvider::new(),
            tavily: crate::providers::TavilyProvider::new(),
            duckduckgo: DuckDuckGoProvider::new(),
            mistral_ws: MistralWebSearchProvider::new(),
            llms_txt: LlmsTxtProvider::new(),
            jina: JinaProvider::new(),
            firecrawl: FirecrawlProvider::new(),
            direct_fetch: crate::providers::DirectFetchProvider::new(),
            mistral_browser: MistralBrowserProvider::new(),
        }
    }

    /// Resolve a query or URL using the cascade
    pub async fn resolve(&self, input: &str) -> Result<ResolvedResult, ResolverError> {
        if is_url(input) {
            self.resolve_url(input).await
        } else {
            self.resolve_query(input).await
        }
    }

    /// Resolve a URL using the URL cascade
    pub async fn resolve_url(&self, url: &str) -> Result<ResolvedResult, ResolverError> {
        // Default URL cascade order
        let providers_order: Vec<ProviderType> = if self.config.providers_order.is_empty() {
            vec![
                ProviderType::LlmsTxt,
                ProviderType::Jina,
                ProviderType::Firecrawl,
                ProviderType::DirectFetch,
                ProviderType::MistralBrowser,
            ]
        } else {
            let mut result = Vec::new();
            for p in &self.config.providers_order {
                if let Ok(pt) = p.parse::<ProviderType>() {
                    if pt.is_url_provider() {
                        result.push(pt);
                    }
                }
            }
            result
        };

        for provider_type in providers_order {
            if self.config.is_skipped(provider_type.name()) {
                continue;
            }

            let result = self.extract_with_provider(url, provider_type).await;
            if let Ok(res) = result {
                if res.is_valid(self.config.min_chars) {
                    return Ok(res);
                }
            }
        }

        Err(ResolverError::Provider(
            "No URL resolution method available".to_string(),
        ))
    }

    /// Resolve a query using the query cascade
    pub async fn resolve_query(&self, query: &str) -> Result<ResolvedResult, ResolverError> {
        // Default query cascade order
        let providers_order: Vec<ProviderType> = if self.config.providers_order.is_empty() {
            vec![
                ProviderType::ExaMcp,
                ProviderType::Exa,
                ProviderType::Tavily,
                ProviderType::DuckDuckGo,
                ProviderType::MistralWebSearch,
            ]
        } else {
            let mut result = Vec::new();
            for p in &self.config.providers_order {
                if let Ok(pt) = p.parse::<ProviderType>() {
                    if pt.is_query_provider() {
                        result.push(pt);
                    }
                }
            }
            result
        };

        for provider_type in providers_order {
            if self.config.is_skipped(provider_type.name()) {
                continue;
            }

            let results = self.search_with_provider(query, provider_type).await;
            if let Ok(res) = results {
                if !res.is_empty() {
                    return Ok(res.into_iter().next().unwrap());
                }
            }
        }

        Err(ResolverError::Provider(
            "No query resolution method available".to_string(),
        ))
    }

    /// Extract content using a specific provider
    async fn extract_with_provider(
        &self,
        url: &str,
        provider_type: ProviderType,
    ) -> Result<ResolvedResult, ResolverError> {
        match provider_type {
            ProviderType::LlmsTxt => {
                if self.llms_txt.is_available() {
                    self.llms_txt.extract(url).await
                } else {
                    Err(ResolverError::Provider("llms_txt unavailable".to_string()))
                }
            }
            ProviderType::Jina => {
                if self.jina.is_available() {
                    self.jina.extract(url).await
                } else {
                    Err(ResolverError::Provider("jina unavailable".to_string()))
                }
            }
            ProviderType::Firecrawl => {
                if self.firecrawl.is_available() {
                    self.firecrawl.extract(url).await
                } else {
                    Err(ResolverError::Provider("firecrawl unavailable".to_string()))
                }
            }
            ProviderType::DirectFetch => {
                if self.direct_fetch.is_available() {
                    self.direct_fetch.extract(url).await
                } else {
                    Err(ResolverError::Provider(
                        "direct_fetch unavailable".to_string(),
                    ))
                }
            }
            ProviderType::MistralBrowser => {
                if self.mistral_browser.is_available() {
                    self.mistral_browser.extract(url).await
                } else {
                    Err(ResolverError::Provider(
                        "mistral_browser unavailable".to_string(),
                    ))
                }
            }
            _ => Err(ResolverError::Provider(format!(
                "Invalid URL provider: {}",
                provider_type
            ))),
        }
    }

    /// Search using a specific provider
    async fn search_with_provider(
        &self,
        query: &str,
        provider_type: ProviderType,
    ) -> Result<Vec<ResolvedResult>, ResolverError> {
        let limit = self.config.exa_results;

        match provider_type {
            ProviderType::ExaMcp => {
                if self.exa_mcp.is_available() {
                    self.exa_mcp.search(query, limit).await
                } else {
                    Err(ResolverError::Provider("exa_mcp unavailable".to_string()))
                }
            }
            ProviderType::Exa => {
                if self.exa_sdk.is_available() {
                    self.exa_sdk.search(query, limit).await
                } else {
                    Err(ResolverError::Provider("exa unavailable".to_string()))
                }
            }
            ProviderType::Tavily => {
                if self.tavily.is_available() {
                    self.tavily.search(query, self.config.tavily_results).await
                } else {
                    Err(ResolverError::Provider("tavily unavailable".to_string()))
                }
            }
            ProviderType::DuckDuckGo => {
                if self.duckduckgo.is_available() {
                    self.duckduckgo.search(query, limit).await
                } else {
                    Err(ResolverError::Provider(
                        "duckduckgo unavailable".to_string(),
                    ))
                }
            }
            ProviderType::MistralWebSearch => {
                if self.mistral_ws.is_available() {
                    self.mistral_ws.search(query, limit).await
                } else {
                    Err(ResolverError::Provider(
                        "mistral_websearch unavailable".to_string(),
                    ))
                }
            }
            _ => Err(ResolverError::Provider(format!(
                "Invalid query provider: {}",
                provider_type
            ))),
        }
    }

    /// Resolve directly with a specific provider
    pub async fn resolve_direct(
        &self,
        input: &str,
        provider: ProviderType,
    ) -> Result<ResolvedResult, ResolverError> {
        if is_url(input) {
            self.extract_with_provider(input, provider).await
        } else {
            let results = self.search_with_provider(input, provider).await?;
            results
                .into_iter()
                .next()
                .ok_or_else(|| ResolverError::Provider("No results from provider".to_string()))
        }
    }

    /// Resolve with custom provider order
    #[allow(dead_code)]
    pub async fn resolve_with_order(
        &self,
        input: &str,
        providers: &[ProviderType],
    ) -> Result<ResolvedResult, ResolverError> {
        for provider in providers {
            let result = self.resolve_direct(input, *provider).await;
            if let Ok(res) = result {
                if res.is_valid(self.config.min_chars) {
                    return Ok(res);
                }
            }
        }

        Err(ResolverError::Provider("No provider succeeded".to_string()))
    }
}

impl Default for Resolver {
    fn default() -> Self {
        Self::new()
    }
}

/// Check if input is a URL
pub fn is_url(input: &str) -> bool {
    let url_patterns = ["http://", "https://", "ftp://", "ftps://"];
    url_patterns.iter().any(|p| input.starts_with(p))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_url() {
        assert!(is_url("https://example.com"));
        assert!(is_url("http://example.com"));
        assert!(is_url("ftp://ftp.example.com"));
        assert!(!is_url("not a url"));
        assert!(!is_url("just some text"));
    }

    #[test]
    fn test_resolver_creation() {
        let resolver = Resolver::new();
        assert!(resolver.config.max_chars > 0);
    }
}
