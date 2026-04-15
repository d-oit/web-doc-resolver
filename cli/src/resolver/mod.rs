//! Resolver module - cascade orchestrator.
//!
//! Orchestrates the provider cascade for query and URL resolution.
//!
//! ## Module Structure
//!
//! - `cascade`: Shared utilities (URL detection, error classification)
//! - `url`: URL resolution cascade
//! - `query`: Query resolution cascade

pub mod cascade;
mod query;
mod url;

pub use cascade::is_url;

use crate::circuit_breaker::CircuitBreakerRegistry;
use crate::config::Config;
use crate::error::ResolverError;
use crate::metrics::ResolveMetrics;
use crate::negative_cache::NegativeCache;
use crate::routing_memory::RoutingMemory;
use crate::semantic_cache::SemanticCache;
use crate::synthesis::synthesize_results;
use crate::types::{ProviderType, ResolvedResult};
use std::result::Result;
use std::sync::{Arc, Mutex, OnceLock};

static LINK_REGEX: OnceLock<regex::Regex> = OnceLock::new();

/// Extract links from content
fn extract_links(content: &str) -> Vec<String> {
    let re = LINK_REGEX.get_or_init(|| regex::Regex::new(r"https?://[^\s)>\]]+").unwrap());
    re.find_iter(content)
        .map(|m| m.as_str().to_string())
        .take(10)
        .collect()
}

/// Main resolver struct
pub struct Resolver {
    config: Config,
    // Cascade handlers
    url_cascade: url::UrlCascade,
    query_cascade: query::QueryCascade,
    // Cache
    cache: Option<SemanticCache>,
    // Routing components
    negative_cache: Arc<Mutex<NegativeCache>>,
    circuit_breakers: Arc<Mutex<CircuitBreakerRegistry>>,
    routing_memory: Arc<Mutex<RoutingMemory>>,
}

impl Resolver {
    /// Create a new resolver with default config (async for semantic cache init)
    pub async fn new() -> Self {
        Self::with_config(Config::default()).await
    }

    /// Create a new resolver with custom config (async for semantic cache init)
    pub async fn with_config(config: Config) -> Self {
        #[cfg(feature = "semantic-cache")]
        let cache = SemanticCache::new(&config).await.ok().flatten();
        #[cfg(not(feature = "semantic-cache"))]
        let cache: Option<SemanticCache> = None;
        Self {
            config,
            cache,
            url_cascade: url::UrlCascade::new(),
            query_cascade: query::QueryCascade::new(),
            negative_cache: Arc::new(Mutex::new(NegativeCache::default())),
            circuit_breakers: Arc::new(Mutex::new(CircuitBreakerRegistry::default())),
            routing_memory: Arc::new(Mutex::new(RoutingMemory::default())),
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
        self.url_cascade
            .resolve(
                url,
                self.cache.as_ref(),
                &self.config,
                self.negative_cache.clone(),
                self.circuit_breakers.clone(),
                self.routing_memory.clone(),
                self.config.max_chars,
                self.config.min_chars,
            )
            .await
    }

    /// Resolve a query using the query cascade
    pub async fn resolve_query(&self, query: &str) -> Result<ResolvedResult, ResolverError> {
        self.query_cascade
            .resolve(
                query,
                self.cache.as_ref(),
                &self.config,
                self.negative_cache.clone(),
                self.circuit_breakers.clone(),
                self.routing_memory.clone(),
                self.config.max_chars,
                self.config.min_chars,
            )
            .await
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
                self.config
                    .providers_order
                    .iter()
                    .filter_map(|p| p.parse::<ProviderType>().ok())
                    .filter(|pt| pt.is_query_provider())
                    .collect()
            };

            let mut all_results = Vec::new();
            for pt in providers {
                if self.config.is_skipped(pt.name()) {
                    continue;
                }
                if let Ok(res) = self
                    .query_cascade
                    .search_with_provider(
                        query,
                        pt,
                        self.config.exa_results,
                        self.config.tavily_results,
                    )
                    .await
                {
                    all_results.extend(res);
                }
                if all_results.len() >= self.config.output_limit {
                    break;
                }
            }
            all_results
        };

        if results.is_empty() {
            return Err(ResolverError::Provider(
                "No results to aggregate".to_string(),
            ));
        }

        // Synthesize if MISTRAL_API_KEY is available
        if let Some(api_key) = self.config.api_key("mistral") {
            let model = std::env::var("DO_WDR_SYNTHESIS_MODEL")
                .unwrap_or_else(|_| "mistral-small-latest".to_string());
            let synthesized = synthesize_results(query, &results, &api_key, &model).await?;
            let mut res =
                ResolvedResult::new(results[0].url.clone(), Some(synthesized), "synthesis", 1.0);
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

        let mut final_res =
            ResolvedResult::new(results[0].url.clone(), Some(content), "aggregated", 1.0);
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
            self.url_cascade
                .extract_with_provider(input, provider)
                .await
        } else {
            let results = self
                .query_cascade
                .search_with_provider(
                    input,
                    provider,
                    self.config.exa_results,
                    self.config.tavily_results,
                )
                .await?;
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

// Note: Default trait removed because Resolver::new() is now async

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

    #[tokio::test]
    async fn test_resolver_creation() {
        let resolver = Resolver::new().await;
        assert!(resolver.config.max_chars > 0);
    }
}
