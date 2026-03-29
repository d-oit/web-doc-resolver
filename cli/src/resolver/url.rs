//! URL resolution logic.
//!
//! Handles the cascade for URL-based inputs.

use crate::bias_scorer::score_result;
use crate::circuit_breaker::CircuitBreakerRegistry;
use crate::compaction::compact_content;
use crate::config::{RoutingProfileConfig, routing_profile_defaults};
use crate::error::ResolverError;
use crate::link_validator::validate_links;
use crate::metrics::ResolveMetrics;
use crate::negative_cache::NegativeCache;
use crate::providers::{DirectFetchProvider, DoclingProvider, MistralBrowserProvider, OcrProvider};
use crate::providers::{FirecrawlProvider, JinaProvider, LlmsTxtProvider, UrlProvider};
use crate::quality::score_content;
use crate::routing::{ResolutionBudget, plan_provider_order};
use crate::routing_memory::RoutingMemory;
use crate::semantic_cache::SemanticCache;
use crate::types::{ProviderType, ResolvedResult, RoutingDecision};
use std::collections::HashMap;
use std::result::Result;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use super::cascade::{
    CIRCUIT_BREAKER_FAILURE_THRESHOLD, CIRCUIT_BREAKER_RECOVERY_TTL, NEGATIVE_CACHE_FAILURE_TTL,
    NEGATIVE_CACHE_THIN_TTL, classify_error, extract_domain_or_default,
};

/// URL cascade resolver
pub struct UrlCascade {
    llms_txt: LlmsTxtProvider,
    jina: JinaProvider,
    docling: DoclingProvider,
    ocr: OcrProvider,
    firecrawl: FirecrawlProvider,
    direct_fetch: DirectFetchProvider,
    mistral_browser: MistralBrowserProvider,
}

impl UrlCascade {
    /// Create new URL cascade
    pub fn new() -> Self {
        Self {
            llms_txt: LlmsTxtProvider::new(),
            jina: JinaProvider::new(),
            docling: DoclingProvider::new(),
            ocr: OcrProvider::new(),
            firecrawl: FirecrawlProvider::new(),
            direct_fetch: DirectFetchProvider::new(),
            mistral_browser: MistralBrowserProvider::new(),
        }
    }

    /// Check for document or image format and return provider type
    pub fn check_format(url: &str) -> Option<ProviderType> {
        if url.ends_with(".pdf") || url.ends_with(".docx") || url.ends_with(".pptx") {
            Some(ProviderType::Docling)
        } else if url.ends_with(".png") || url.ends_with(".jpg") || url.ends_with(".jpeg") {
            Some(ProviderType::Ocr)
        } else {
            None
        }
    }

    /// Extract content using a specific provider
    pub async fn extract_with_provider(
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

    /// Resolve a URL using the cascade
    #[allow(clippy::too_many_arguments)]
    pub async fn resolve(
        &self,
        url: &str,
        cache: Option<&SemanticCache>,
        config: &crate::config::Config,
        negative_cache: Arc<Mutex<NegativeCache>>,
        circuit_breakers: Arc<Mutex<CircuitBreakerRegistry>>,
        routing_memory: Arc<Mutex<RoutingMemory>>,
        max_chars: usize,
        min_chars: usize,
    ) -> Result<ResolvedResult, ResolverError> {
        let mut metrics = ResolveMetrics::new();

        // Check for document or image format first
        if let Some(provider_type) = Self::check_format(url) {
            return self.extract_with_provider(url, provider_type).await;
        }

        // Check semantic cache
        if let Some(cache) = cache {
            if let Ok(Some(res)) = cache.query(url).await {
                if let Some(mut res) = res.into_iter().next() {
                    metrics.cache_hit = true;
                    res.metrics = Some(metrics);
                    return Ok(res);
                }
            }
        }

        let profile_name = format!("{:?}", config.profile).to_lowercase();
        let profile_defaults = routing_profile_defaults(&profile_name);
        let mut budget = build_budget(config, &profile_defaults);
        let mut routing_decisions = Vec::new();

        let planned = {
            let routing_memory = routing_memory.lock().unwrap();
            plan_provider_order(
                url,
                true,
                if config.providers_order.is_empty() {
                    None
                } else {
                    Some(&config.providers_order)
                },
                &config.skip_providers,
                if config.disable_routing_memory {
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

            // Check negative cache
            {
                let nc = negative_cache.lock().unwrap();
                if nc.should_skip(url, &provider.name) {
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

            // Check circuit breaker
            {
                let cb = circuit_breakers.lock().unwrap();
                if cb.is_open(&provider.name) {
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
                    let links = super::extract_links(content_str);
                    let threshold = config
                        .quality_threshold
                        .unwrap_or(profile_defaults.quality_threshold);
                    let quality = score_content(content_str, &links, threshold);

                    let acceptable = quality.acceptable && res.is_valid(min_chars);

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
                        res.content = Some(compact_content(content_str, max_chars));
                        res.metrics = Some(metrics);
                        res.routing_decisions = routing_decisions;

                        // Record success
                        {
                            let mut cb = circuit_breakers.lock().unwrap();
                            cb.record_success(&provider.name);
                        }
                        if !config.disable_routing_memory {
                            let mut rm = routing_memory.lock().unwrap();
                            rm.record(
                                &extract_domain_or_default(url),
                                &provider.name,
                                true,
                                latency,
                                quality.score,
                            );
                        }
                        if let Some(cache) = cache {
                            let _ = cache.store(url, &[res.clone()], &res.source).await;
                        }
                        return Ok(res);
                    } else {
                        // Record thin content
                        {
                            let mut nc = negative_cache.lock().unwrap();
                            nc.insert(
                                url,
                                &provider.name,
                                "thin_content",
                                NEGATIVE_CACHE_THIN_TTL,
                                HashMap::new(),
                            );
                        }
                        if !config.disable_routing_memory {
                            let mut rm = routing_memory.lock().unwrap();
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
                        let mut cb = circuit_breakers.lock().unwrap();
                        cb.record_failure(
                            &provider.name,
                            CIRCUIT_BREAKER_FAILURE_THRESHOLD,
                            CIRCUIT_BREAKER_RECOVERY_TTL,
                        );
                    }

                    {
                        let mut nc = negative_cache.lock().unwrap();
                        nc.insert(
                            url,
                            &provider.name,
                            reason,
                            NEGATIVE_CACHE_FAILURE_TTL,
                            HashMap::new(),
                        );
                    }
                }
            }
        }

        Err(ResolverError::Provider(
            "No URL resolution method available".to_string(),
        ))
    }
}

impl Default for UrlCascade {
    fn default() -> Self {
        Self::new()
    }
}

/// Build resolution budget from config
fn build_budget(
    config: &crate::config::Config,
    profile_defaults: &RoutingProfileConfig,
) -> ResolutionBudget {
    ResolutionBudget {
        max_provider_attempts: config
            .max_provider_attempts
            .unwrap_or(profile_defaults.max_provider_attempts),
        max_paid_attempts: config
            .max_paid_attempts
            .unwrap_or(profile_defaults.max_paid_attempts),
        max_total_latency_ms: config
            .max_total_latency_ms
            .unwrap_or(profile_defaults.max_total_latency_ms),
        allow_paid: profile_defaults.allow_paid,
        attempts: 0,
        paid_attempts: 0,
        elapsed_ms: 0,
        stop_reason: None,
    }
}
