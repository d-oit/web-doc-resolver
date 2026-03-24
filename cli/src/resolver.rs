//! Resolver module - cascade orchestrator.
//!
//! Orchestrates the provider cascade for query and URL resolution.

use crate::bias_scorer::score_result;
use crate::circuit_breaker::CircuitBreakerRegistry;
use crate::compaction::compact_content;
use crate::config::{Config, RoutingProfileConfig, routing_profile_defaults};
use crate::error::ResolverError;
use crate::link_validator::validate_links;
use crate::metrics::ResolveMetrics;
use crate::negative_cache::NegativeCache;
use crate::providers::{
    DuckDuckGoProvider, ExaMcpProvider, ExaSdkProvider, FirecrawlProvider, JinaProvider,
    LlmsTxtProvider, MistralBrowserProvider, MistralWebSearchProvider, QueryProvider,
    SerperProvider, UrlProvider,
};
use crate::quality::score_content;
use crate::routing::{ResolutionBudget, plan_provider_order};
use crate::routing_memory::RoutingMemory;
use crate::semantic_cache::SemanticCache;
use crate::synthesis::synthesize_results;
use crate::types::{ProviderType, ResolvedResult, RoutingDecision};
use std::result::Result;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

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
    // Routing components
    negative_cache: Arc<Mutex<NegativeCache>>,
    circuit_breakers: Arc<Mutex<CircuitBreakerRegistry>>,
    routing_memory: Arc<Mutex<RoutingMemory>>,
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
        let mut metrics = ResolveMetrics::new();

        // Check for document or image format first
        if url.ends_with(".pdf") || url.ends_with(".docx") || url.ends_with(".pptx") {
            return self.resolve_direct(url, ProviderType::Docling).await;
        }
        if url.ends_with(".png") || url.ends_with(".jpg") || url.ends_with(".jpeg") {
            return self.resolve_direct(url, ProviderType::Ocr).await;
        }

        if let Some(cache) = &self.cache {
            if let Ok(Some(res)) = cache.query(url).await {
                if let Some(mut res) = res.into_iter().next() {
                    metrics.cache_hit = true;
                    res.metrics = Some(metrics);
                    return Ok(res);
                }
            }
        }

        let profile_name = format!("{:?}", self.config.profile).to_lowercase();
        let profile_defaults = routing_profile_defaults(&profile_name);
        let mut budget = self.build_budget(&profile_defaults);
        let mut routing_decisions = Vec::new();

        let planned = {
            let routing_memory = self.routing_memory.lock().unwrap();
            plan_provider_order(
                url,
                true,
                if self.config.providers_order.is_empty() {
                    None
                } else {
                    Some(&self.config.providers_order)
                },
                &self.config.skip_providers,
                if self.config.disable_routing_memory {
                    None
                } else {
                    Some(&routing_memory)
                },
            )
        };

        for (idx, provider) in planned.iter().enumerate() {
            if !budget.can_try(provider.is_paid) {
                if matches!(
                    budget.stop_reason.as_deref(),
                    Some("paid_disabled") | Some("max_paid_attempts")
                ) {
                    continue;
                }
                break;
            }

            let provider_type: ProviderType = provider
                .name
                .parse()
                .map_err(|e| ResolverError::Provider(format!("Invalid provider name: {}", e)))?;

            {
                let negative_cache = self.negative_cache.lock().unwrap();
                if negative_cache.should_skip(url, &provider.name) {
                    metrics.record_provider_detailed(
                        provider_type,
                        0,
                        false,
                        idx,
                        None,
                        false,
                        Some("negative_cache".into()),
                        budget.stop_reason.clone(),
                        true,
                        false,
                    );
                    routing_decisions.push(RoutingDecision {
                        provider: provider.name.clone(),
                        attempt_index: idx,
                        quality_score: None,
                        accepted: false,
                        skip_reason: Some("negative_cache".into()),
                        stop_reason: budget.stop_reason.clone(),
                        negative_cache_hit: true,
                        circuit_open: false,
                        paid_provider: provider.is_paid,
                    });
                    continue;
                }
            }

            {
                let circuit_breakers = self.circuit_breakers.lock().unwrap();
                if circuit_breakers.is_open(&provider.name) {
                    metrics.record_provider_detailed(
                        provider_type,
                        0,
                        false,
                        idx,
                        None,
                        false,
                        Some("circuit_open".into()),
                        budget.stop_reason.clone(),
                        false,
                        true,
                    );
                    routing_decisions.push(RoutingDecision {
                        provider: provider.name.clone(),
                        attempt_index: idx,
                        quality_score: None,
                        accepted: false,
                        skip_reason: Some("circuit_open".into()),
                        stop_reason: budget.stop_reason.clone(),
                        negative_cache_hit: false,
                        circuit_open: true,
                        paid_provider: provider.is_paid,
                    });
                    continue;
                }
            }

            let started = Instant::now();
            let result = self.extract_with_provider(url, provider_type).await;
            let latency = started.elapsed().as_millis() as u64;
            budget.record_attempt(provider.is_paid, latency);
            metrics.budget_elapsed_ms = budget.elapsed_ms;
            metrics.cascade_depth = idx + 1;

            match result {
                Ok(mut res) => {
                    let content_str = res.content.as_deref().unwrap_or("");
                    let links = extract_links(content_str);
                    let threshold = self
                        .config
                        .quality_threshold
                        .unwrap_or(profile_defaults.quality_threshold);
                    let quality = score_content(content_str, &links, threshold);

                    let acceptable = quality.acceptable && res.is_valid(self.config.min_chars);

                    metrics.record_provider_detailed(
                        provider_type,
                        latency,
                        true,
                        idx,
                        Some(quality.score),
                        acceptable,
                        None,
                        budget.stop_reason.clone(),
                        false,
                        false,
                    );
                    routing_decisions.push(RoutingDecision {
                        provider: provider.name.clone(),
                        attempt_index: idx,
                        quality_score: Some(quality.score),
                        accepted: acceptable,
                        skip_reason: None,
                        stop_reason: budget.stop_reason.clone(),
                        negative_cache_hit: false,
                        circuit_open: false,
                        paid_provider: provider.is_paid,
                    });

                    if acceptable {
                        res.validated_links = validate_links(&links).await;
                        res.score = score_result(&res.url, content_str);
                        res.content = Some(compact_content(content_str, self.config.max_chars));
                        res.metrics = Some(metrics);
                        res.routing_decisions = routing_decisions;

                        {
                            let mut cb = self.circuit_breakers.lock().unwrap();
                            cb.record_success(&provider.name);
                        }
                        if !self.config.disable_routing_memory {
                            let mut rm = self.routing_memory.lock().unwrap();
                            rm.record(
                                &extract_domain_or_default(url),
                                &provider.name,
                                true,
                                latency,
                                quality.score,
                            );
                        }
                        if let Some(cache) = &self.cache {
                            let _ = cache.store(url, &[res.clone()], &res.source).await;
                        }
                        return Ok(res);
                    } else {
                        {
                            let mut nc = self.negative_cache.lock().unwrap();
                            nc.insert(
                                url,
                                &provider.name,
                                "thin_content",
                                Duration::from_secs(1800),
                                std::collections::HashMap::new(),
                            );
                        }
                        if !self.config.disable_routing_memory {
                            let mut rm = self.routing_memory.lock().unwrap();
                            rm.record(
                                &extract_domain_or_default(url),
                                &provider.name,
                                false,
                                latency,
                                quality.score,
                            );
                        }
                    }
                }
                Err(err) => {
                    let reason = classify_error(&err);
                    metrics.record_provider_detailed(
                        provider_type,
                        latency,
                        false,
                        idx,
                        None,
                        false,
                        Some(reason.clone()),
                        budget.stop_reason.clone(),
                        false,
                        false,
                    );
                    routing_decisions.push(RoutingDecision {
                        provider: provider.name.clone(),
                        attempt_index: idx,
                        quality_score: None,
                        accepted: false,
                        skip_reason: Some(reason.clone()),
                        stop_reason: budget.stop_reason.clone(),
                        negative_cache_hit: false,
                        circuit_open: false,
                        paid_provider: provider.is_paid,
                    });

                    if matches!(reason.as_str(), "timeout" | "provider_5xx" | "rate_limited") {
                        let mut cb = self.circuit_breakers.lock().unwrap();
                        cb.record_failure(&provider.name, 3, Duration::from_secs(300));
                    }

                    {
                        let mut nc = self.negative_cache.lock().unwrap();
                        nc.insert(
                            url,
                            &provider.name,
                            reason,
                            Duration::from_secs(600),
                            std::collections::HashMap::new(),
                        );
                    }
                }
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

        let profile_name = format!("{:?}", self.config.profile).to_lowercase();
        let profile_defaults = routing_profile_defaults(&profile_name);
        let mut budget = self.build_budget(&profile_defaults);
        let mut routing_decisions = Vec::new();

        let planned = {
            let routing_memory = self.routing_memory.lock().unwrap();
            plan_provider_order(
                query,
                false,
                if self.config.providers_order.is_empty() {
                    None
                } else {
                    Some(&self.config.providers_order)
                },
                &self.config.skip_providers,
                if self.config.disable_routing_memory {
                    None
                } else {
                    Some(&routing_memory)
                },
            )
        };

        for (idx, provider) in planned.iter().enumerate() {
            if !budget.can_try(provider.is_paid) {
                if matches!(
                    budget.stop_reason.as_deref(),
                    Some("paid_disabled") | Some("max_paid_attempts")
                ) {
                    continue;
                }
                break;
            }

            let provider_type: ProviderType = provider
                .name
                .parse()
                .map_err(|e| ResolverError::Provider(format!("Invalid provider name: {}", e)))?;

            {
                let negative_cache = self.negative_cache.lock().unwrap();
                if negative_cache.should_skip(query, &provider.name) {
                    metrics.record_provider_detailed(
                        provider_type,
                        0,
                        false,
                        idx,
                        None,
                        false,
                        Some("negative_cache".into()),
                        budget.stop_reason.clone(),
                        true,
                        false,
                    );
                    routing_decisions.push(RoutingDecision {
                        provider: provider.name.clone(),
                        attempt_index: idx,
                        quality_score: None,
                        accepted: false,
                        skip_reason: Some("negative_cache".into()),
                        stop_reason: budget.stop_reason.clone(),
                        negative_cache_hit: true,
                        circuit_open: false,
                        paid_provider: provider.is_paid,
                    });
                    continue;
                }
            }

            {
                let circuit_breakers = self.circuit_breakers.lock().unwrap();
                if circuit_breakers.is_open(&provider.name) {
                    metrics.record_provider_detailed(
                        provider_type,
                        0,
                        false,
                        idx,
                        None,
                        false,
                        Some("circuit_open".into()),
                        budget.stop_reason.clone(),
                        false,
                        true,
                    );
                    routing_decisions.push(RoutingDecision {
                        provider: provider.name.clone(),
                        attempt_index: idx,
                        quality_score: None,
                        accepted: false,
                        skip_reason: Some("circuit_open".into()),
                        stop_reason: budget.stop_reason.clone(),
                        negative_cache_hit: false,
                        circuit_open: true,
                        paid_provider: provider.is_paid,
                    });
                    continue;
                }
            }

            let started = Instant::now();
            let results = self.search_with_provider(query, provider_type).await;
            let latency = started.elapsed().as_millis() as u64;
            budget.record_attempt(provider.is_paid, latency);
            metrics.budget_elapsed_ms = budget.elapsed_ms;
            metrics.cascade_depth = idx + 1;

            match results {
                Ok(results) if !results.is_empty() => {
                    let mut first = results[0].clone();
                    let content_str = first.content.as_deref().unwrap_or("");
                    let links = extract_links(content_str);
                    let threshold = self
                        .config
                        .quality_threshold
                        .unwrap_or(profile_defaults.quality_threshold);
                    let quality = score_content(content_str, &links, threshold);

                    let acceptable = quality.acceptable && first.is_valid(self.config.min_chars);

                    metrics.record_provider_detailed(
                        provider_type,
                        latency,
                        true,
                        idx,
                        Some(quality.score),
                        acceptable,
                        None,
                        budget.stop_reason.clone(),
                        false,
                        false,
                    );
                    routing_decisions.push(RoutingDecision {
                        provider: provider.name.clone(),
                        attempt_index: idx,
                        quality_score: Some(quality.score),
                        accepted: acceptable,
                        skip_reason: None,
                        stop_reason: budget.stop_reason.clone(),
                        negative_cache_hit: false,
                        circuit_open: false,
                        paid_provider: provider.is_paid,
                    });

                    if acceptable {
                        first.validated_links = validate_links(&links).await;
                        first.score = score_result(&first.url, content_str);
                        first.content = Some(compact_content(content_str, self.config.max_chars));
                        first.metrics = Some(metrics);
                        first.routing_decisions = routing_decisions;

                        {
                            let mut cb = self.circuit_breakers.lock().unwrap();
                            cb.record_success(&provider.name);
                        }
                        if !self.config.disable_routing_memory {
                            let mut rm = self.routing_memory.lock().unwrap();
                            rm.record("", &provider.name, true, latency, quality.score);
                        }
                        if let Some(cache) = &self.cache {
                            let _ = cache.store(query, &results, &first.source).await;
                        }
                        return Ok(first);
                    } else {
                        {
                            let mut nc = self.negative_cache.lock().unwrap();
                            nc.insert(
                                query,
                                &provider.name,
                                "thin_content",
                                Duration::from_secs(1800),
                                std::collections::HashMap::new(),
                            );
                        }
                        if !self.config.disable_routing_memory {
                            let mut rm = self.routing_memory.lock().unwrap();
                            rm.record("", &provider.name, false, latency, quality.score);
                        }
                    }
                }
                Ok(_) => {
                    metrics.record_provider_detailed(
                        provider_type,
                        latency,
                        false,
                        idx,
                        None,
                        false,
                        Some("no_results".into()),
                        budget.stop_reason.clone(),
                        false,
                        false,
                    );
                    routing_decisions.push(RoutingDecision {
                        provider: provider.name.clone(),
                        attempt_index: idx,
                        quality_score: None,
                        accepted: false,
                        skip_reason: Some("no_results".into()),
                        stop_reason: budget.stop_reason.clone(),
                        negative_cache_hit: false,
                        circuit_open: false,
                        paid_provider: provider.is_paid,
                    });
                }
                Err(err) => {
                    let reason = classify_error(&err);
                    metrics.record_provider_detailed(
                        provider_type,
                        latency,
                        false,
                        idx,
                        None,
                        false,
                        Some(reason.clone()),
                        budget.stop_reason.clone(),
                        false,
                        false,
                    );
                    routing_decisions.push(RoutingDecision {
                        provider: provider.name.clone(),
                        attempt_index: idx,
                        quality_score: None,
                        accepted: false,
                        skip_reason: Some(reason.clone()),
                        stop_reason: budget.stop_reason.clone(),
                        negative_cache_hit: false,
                        circuit_open: false,
                        paid_provider: provider.is_paid,
                    });

                    if matches!(reason.as_str(), "timeout" | "provider_5xx" | "rate_limited") {
                        let mut cb = self.circuit_breakers.lock().unwrap();
                        cb.record_failure(&provider.name, 3, Duration::from_secs(300));
                    }

                    {
                        let mut nc = self.negative_cache.lock().unwrap();
                        nc.insert(
                            query,
                            &provider.name,
                            reason,
                            Duration::from_secs(600),
                            std::collections::HashMap::new(),
                        );
                    }
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
            ProviderType::Docling => {
                if self.docling.is_available() {
                    self.docling.extract(url).await
                } else {
                    Err(ResolverError::Provider("docling unavailable".to_string()))
                }
            }
            ProviderType::Ocr => {
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
                if let Ok(res) = self.search_with_provider(query, pt).await {
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

    fn build_budget(&self, profile_defaults: &RoutingProfileConfig) -> ResolutionBudget {
        ResolutionBudget {
            max_provider_attempts: self
                .config
                .max_provider_attempts
                .unwrap_or(profile_defaults.max_provider_attempts),
            max_paid_attempts: self
                .config
                .max_paid_attempts
                .unwrap_or(profile_defaults.max_paid_attempts),
            max_total_latency_ms: self
                .config
                .max_total_latency_ms
                .unwrap_or(profile_defaults.max_total_latency_ms),
            allow_paid: profile_defaults.allow_paid,
            attempts: 0,
            paid_attempts: 0,
            elapsed_ms: 0,
            stop_reason: None,
        }
    }
}

impl Default for Resolver {
    fn default() -> Self {
        Self::new()
    }
}

fn extract_links(content: &str) -> Vec<String> {
    let re = LINK_REGEX.get_or_init(|| regex::Regex::new(r"https?://[^\s)>\]]+").unwrap());
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

fn extract_domain_or_default(target: &str) -> String {
    url::Url::parse(target)
        .ok()
        .and_then(|u| u.host_str().map(|s| s.to_string()))
        .unwrap_or_default()
}

fn classify_error(err: &ResolverError) -> String {
    let s = err.to_string().to_lowercase();
    if s.contains("timeout") {
        "timeout".into()
    } else if s.contains("rate limit") || s.contains("429") {
        "rate_limited".into()
    } else if s.contains("500") || s.contains("502") || s.contains("503") || s.contains("504") {
        "provider_5xx".into()
    } else if s.contains("auth") || s.contains("api key") {
        "auth_required".into()
    } else {
        "provider_error".into()
    }
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
