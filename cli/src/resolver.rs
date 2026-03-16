//! Resolver module - cascade orchestrator.
//!
//! Orchestrates the provider cascade for query and URL resolution.

use crate::compaction::compact_content;
use crate::bias_scorer::score_result;
use crate::link_validator::validate_links;
use crate::config::Config;
use crate::error::ResolverError;
use crate::semantic_cache::SemanticCache;
use crate::synthesis::synthesize_results;
use crate::metrics::ResolveMetrics;
use crate::providers::{
    DuckDuckGoProvider, ExaMcpProvider, ExaSdkProvider, FirecrawlProvider, JinaProvider,
    LlmsTxtProvider, MistralBrowserProvider, MistralWebSearchProvider, QueryProvider,
    SerperProvider, UrlProvider,
};
use crate::types::{ProviderType, ResolvedResult};
use std::result::Result;
use std::sync::OnceLock;
use std::time::Instant;

static LINK_REGEX: OnceLock<regex::Regex> = OnceLock::new();

/// Main resolver struct
pub struct Resolver {
    config: Config,
    // Query providers
    exa_mcp: ExaMcpProvider,
    exa_sdk: ExaSdkProvider,
    tavily: crate::providers::TavilyProvider,
    serper: SerperProvider,
    duckduckgo: DuckDuckGoProvider,
    mistral_ws: MistralWebSearchProvider,
    // URL providers
    llms_txt: LlmsTxtProvider,
    jina: JinaProvider,
    docling: crate::providers::DoclingProvider,
    ocr: crate::providers::OcrProvider,
    firecrawl: FirecrawlProvider,
    direct_fetch: crate::providers::DirectFetchProvider,
    mistral_browser: MistralBrowserProvider,
    // Cache
    cache: Option<SemanticCache>,
}

impl Resolver {
    /// Create a new resolver with default config
    pub fn new() -> Self {
        Self::with_config(Config::default())
    }

    /// Create a new resolver with custom config
    pub fn with_config(config: Config) -> Self {
        let cache = SemanticCache::new(&config).ok().flatten();
        Self {
            config,
            cache,
            exa_mcp: ExaMcpProvider::new(),
            exa_sdk: ExaSdkProvider::new(),
            tavily: crate::providers::TavilyProvider::new(),
            serper: SerperProvider::new(),
            duckduckgo: DuckDuckGoProvider::new(),
            mistral_ws: MistralWebSearchProvider::new(),
            llms_txt: LlmsTxtProvider::new(),
            jina: JinaProvider::new(),
            docling: crate::providers::DoclingProvider::new(),
            ocr: crate::providers::OcrProvider::new(),
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
        let mut metrics = ResolveMetrics::new();

        if let Some(cache) = &self.cache {
            if let Ok(Some(res)) = cache.query(url).await {
                let mut res = res.into_iter().next().unwrap();
                metrics.cache_hit = true;
                res.metrics = Some(metrics);
                return Ok(res);
            }
        }
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

        let mut hops = 0;
        let max_hops = self.config.profile.max_hops();

        // Parallel fast-path probes for llms.txt and jina
        if self.config.providers_order.is_empty() && self.config.profile.is_provider_allowed(ProviderType::LlmsTxt) && self.config.profile.is_provider_allowed(ProviderType::Jina) {
            let llms_fut = self.extract_with_provider(url, ProviderType::LlmsTxt);
            let jina_fut = self.extract_with_provider(url, ProviderType::Jina);

            let parallel_result = tokio::select! {
                res = llms_fut => res.map(|r| (r, ProviderType::LlmsTxt)),
                res = jina_fut => res.map(|r| (r, ProviderType::Jina)),
            };

            if let Ok((mut res, pt)) = parallel_result {
                if res.is_valid(self.config.min_chars) {
                    metrics.record_provider(pt, 0, true);
                    if let Some(content) = &res.content {
                        let links = extract_links(content);
                        res.validated_links = validate_links(&links).await;
                        res.score = score_result(&res.url, content);
                        res.content = Some(compact_content(content, self.config.max_chars));
                    }
                    res.metrics = Some(metrics);
                    return Ok(res);
                }
            }
        }

        for provider_type in providers_order {
            if self.config.is_skipped(provider_type.name()) {
                continue;
            }

            if !self.config.profile.is_provider_allowed(provider_type) {
                tracing::debug!("Provider {} skipped by profile {:?}", provider_type, self.config.profile);
                continue;
            }

            if hops >= max_hops {
                tracing::warn!("Max cascade hops ({}) reached for profile {:?}", max_hops, self.config.profile);
                break;
            }

            hops += 1;
            metrics.cascade_depth = hops;
            let start = Instant::now();
            let result = self.extract_with_provider(url, provider_type).await;
            let latency = start.elapsed().as_millis() as u64;

            if let Ok(mut res) = result {
                metrics.record_provider(provider_type, latency, true);
                if res.is_valid(self.config.min_chars) {
                    if let Some(content) = &res.content {
                        let links = extract_links(content);
                        res.validated_links = validate_links(&links).await;
                        res.score = score_result(&res.url, content);
                        res.content = Some(compact_content(content, self.config.max_chars));
                    }
                    res.metrics = Some(metrics);
                    if let Some(cache) = &self.cache {
                        let _ = cache.store(url, &[res.clone()], &res.source).await;
                    }
                    return Ok(res);
                }
            } else {
                metrics.record_provider(provider_type, latency, false);
            }
        }

        Err(ResolverError::Provider(
            "No URL resolution method available".to_string(),
        ))
    }

    /// Resolve a query using the query cascade
    pub async fn resolve_query(&self, query: &str) -> Result<ResolvedResult, ResolverError> {
        let mut metrics = ResolveMetrics::new();

        if let Some(cache) = &self.cache {
            if let Ok(Some(results)) = cache.query(query).await {
                if !results.is_empty() {
                    let mut first = results[0].clone();
                    metrics.cache_hit = true;
                    first.metrics = Some(metrics);
                    return Ok(first);
                }
            }
        }
        // Default query cascade order
        let providers_order: Vec<ProviderType> = if self.config.providers_order.is_empty() {
            vec![
                ProviderType::ExaMcp,
                ProviderType::Exa,
                ProviderType::Tavily,
                ProviderType::Serper,
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

        let mut hops = 0;
        let max_hops = self.config.profile.max_hops();

        for provider_type in providers_order {
            if self.config.is_skipped(provider_type.name()) {
                continue;
            }

            if !self.config.profile.is_provider_allowed(provider_type) {
                tracing::debug!("Provider {} skipped by profile {:?}", provider_type, self.config.profile);
                continue;
            }

            if hops >= max_hops {
                tracing::warn!("Max cascade hops ({}) reached for profile {:?}", max_hops, self.config.profile);
                break;
            }

            hops += 1;
            metrics.cascade_depth = hops;
            let start = Instant::now();
            let results = self.search_with_provider(query, provider_type).await;
            let latency = start.elapsed().as_millis() as u64;

            if let Ok(results) = results {
                metrics.record_provider(provider_type, latency, true);
                if !results.is_empty() {
                    let mut first = results.clone().into_iter().next().unwrap();
                    if let Some(content) = &first.content {
                        let links = extract_links(content);
                        first.validated_links = validate_links(&links).await;
                        first.score = score_result(&first.url, content);
                        first.content = Some(compact_content(content, self.config.max_chars));
                    }
                    first.metrics = Some(metrics);
                    if let Some(cache) = &self.cache {
                        let _ = cache.store(query, &results, &first.source).await;
                    }
                    return Ok(first);
                }
            } else {
                metrics.record_provider(provider_type, latency, false);
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
            _ if url.ends_with(".pdf") || url.ends_with(".docx") => {
                if self.docling.is_available() {
                    self.docling.extract(url).await
                } else {
                    Err(ResolverError::Provider("docling unavailable".to_string()))
                }
            }
            _ if url.ends_with(".png") || url.ends_with(".jpg") || url.ends_with(".jpeg") => {
                if self.ocr.is_available() {
                    self.ocr.extract(url).await
                } else {
                    Err(ResolverError::Provider("ocr unavailable".to_string()))
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
            ProviderType::Serper => {
                if self.serper.is_available() {
                    self.serper.search(query, limit).await
                } else {
                    Err(ResolverError::Provider("serper unavailable".to_string()))
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

    /// Resolve and aggregate multiple results
    pub async fn resolve_aggregated(&self, input: &str) -> Result<ResolvedResult, ResolverError> {
        let mut metrics = ResolveMetrics::new();
        let query = input; // For now assume query

        let results = if is_url(input) {
            vec![self.resolve_url(input).await?]
        } else {
            // Aggregation logic for queries
            let providers = if self.config.providers_order.is_empty() {
                vec![
                    ProviderType::ExaMcp,
                    ProviderType::Exa,
                    ProviderType::Tavily,
                ]
            } else {
                self.config.providers_order.iter()
                    .filter_map(|p| p.parse::<ProviderType>().ok())
                    .filter(|pt| pt.is_query_provider())
                    .collect()
            };

            let mut all_results = Vec::new();
            for pt in providers {
                if self.config.is_skipped(pt.name()) { continue; }
                if let Ok(res) = self.search_with_provider(query, pt).await {
                    all_results.extend(res);
                }
                if all_results.len() >= self.config.output_limit { break; }
            }
            all_results
        };

        if results.is_empty() {
            return Err(ResolverError::Provider("No results to aggregate".to_string()));
        }

        // Synthesize if MISTRAL_API_KEY is available
        if let Some(api_key) = self.config.api_key("mistral") {
            let model = std::env::var("WDR_SYNTHESIS_MODEL")
                .unwrap_or_else(|_| "mistral-large-latest".to_string());
            let synthesized = synthesize_results(query, &results, &api_key, &model).await?;
            let mut res = ResolvedResult::new(
                results[0].url.clone(),
                Some(synthesized),
                "synthesis",
                1.0
            );
            metrics.record_provider(ProviderType::MistralWebSearch, 0, true); // Dummy record for synthesis
            res.metrics = Some(metrics);
            return Ok(res);
        }

        // Fallback to concatenated results
        let mut content = String::new();
        for res in &results {
            if let Some(c) = &res.content {
                content.push_str(&format!("\nSource: {}\n{}\n---\n", res.url, c));
            }
        }

        let mut final_res = ResolvedResult::new(
            results[0].url.clone(),
            Some(content),
            "aggregated",
            1.0
        );
        final_res.metrics = Some(metrics);
        Ok(final_res)
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

fn extract_links(content: &str) -> Vec<String> {
    let re = LINK_REGEX.get_or_init(|| {
        regex::Regex::new(r"https?://[^\s\)\>\]]+").unwrap()
    });
    re.find_iter(content)
        .map(|m| m.as_str().to_string())
        .take(10)
        .collect()
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
