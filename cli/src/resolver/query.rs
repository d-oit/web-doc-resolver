//! Query resolution logic.
//!
//! Handles the cascade for search-based queries.

use crate::bias_scorer::score_result;
use crate::circuit_breaker::CircuitBreakerRegistry;
use crate::compaction::compact_content;
use crate::config::{RoutingProfileConfig, routing_profile_defaults};
use crate::error::ResolverError;
use crate::link_validator::validate_links;
use crate::metrics::ResolveMetrics;
use crate::negative_cache::NegativeCache;
use crate::providers::MistralWebSearchProvider;
use crate::providers::{
    DuckDuckGoProvider, ExaMcpProvider, ExaSdkProvider, QueryProvider, SerperProvider,
};
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
    NEGATIVE_CACHE_THIN_TTL, classify_error,
};

/// Query cascade resolver
pub struct QueryCascade {
    exa_mcp: ExaMcpProvider,
    exa_sdk: ExaSdkProvider,
    tavily: crate::providers::TavilyProvider,
    serper: SerperProvider,
    duckduckgo: DuckDuckGoProvider,
    mistral_ws: MistralWebSearchProvider,
}

impl QueryCascade {
    /// Create new query cascade
    pub fn new() -> Self {
        Self {
            exa_mcp: ExaMcpProvider::new(),
            exa_sdk: ExaSdkProvider::new(),
            tavily: crate::providers::TavilyProvider::new(),
            serper: SerperProvider::new(),
            duckduckgo: DuckDuckGoProvider::new(),
            mistral_ws: MistralWebSearchProvider::new(),
        }
    }

    /// Search using a specific provider
    pub async fn search_with_provider(
        &self,
        query: &str,
        provider_type: ProviderType,
        exa_limit: usize,
        tavily_limit: usize,
    ) -> Result<Vec<ResolvedResult>, ResolverError> {
        match provider_type {
            ProviderType::ExaMcp => {
                if self.exa_mcp.is_available() {
                    self.exa_mcp.search(query, exa_limit).await
                } else {
                    Err(ResolverError::Provider("exa_mcp unavailable".to_string()))
                }
            }
            ProviderType::Exa => {
                if self.exa_sdk.is_available() {
                    self.exa_sdk.search(query, exa_limit).await
                } else {
                    Err(ResolverError::Provider("exa unavailable".to_string()))
                }
            }
            ProviderType::Tavily => {
                if self.tavily.is_available() {
                    self.tavily.search(query, tavily_limit).await
                } else {
                    Err(ResolverError::Provider("tavily unavailable".to_string()))
                }
            }
            ProviderType::Serper => {
                if self.serper.is_available() {
                    self.serper.search(query, exa_limit).await
                } else {
                    Err(ResolverError::Provider("serper unavailable".to_string()))
                }
            }
            ProviderType::DuckDuckGo => {
                if self.duckduckgo.is_available() {
                    self.duckduckgo.search(query, exa_limit).await
                } else {
                    Err(ResolverError::Provider(
                        "duckduckgo unavailable".to_string(),
                    ))
                }
            }
            ProviderType::MistralWebSearch => {
                if self.mistral_ws.is_available() {
                    self.mistral_ws.search(query, exa_limit).await
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

    /// Resolve a query using the cascade
    #[allow(clippy::too_many_arguments)]
    pub async fn resolve(
        &self,
        query: &str,
        cache: Option<&SemanticCache>,
        config: &crate::config::Config,
        negative_cache: Arc<Mutex<NegativeCache>>,
        circuit_breakers: Arc<Mutex<CircuitBreakerRegistry>>,
        routing_memory: Arc<Mutex<RoutingMemory>>,
        max_chars: usize,
        min_chars: usize,
    ) -> Result<ResolvedResult, ResolverError> {
        let mut metrics = ResolveMetrics::new();

        // Check semantic cache
        if let Some(cache) = cache {
            if let Ok(Some(results)) = cache.query(query).await {
                if !results.is_empty() {
                    let mut first = results[0].clone();
                    metrics.cache_hit = true;
                    first.metrics = Some(metrics);
                    return Ok(first);
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
                query,
                false,
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

        tracing::debug!(
            "Planned {} providers for query: {:?}",
            planned.len(),
            planned.iter().map(|p| &p.name).collect::<Vec<_>>()
        );

        for (idx, provider) in planned.iter().enumerate() {
            tracing::trace!(
                "Trying provider {}: {} (paid={})",
                idx,
                provider.name,
                provider.is_paid
            );

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
                if nc.should_skip(query, &provider.name) {
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
            let results = self
                .search_with_provider(
                    query,
                    provider_type,
                    config.exa_results,
                    config.tavily_results,
                )
                .await;
            let latency = started.elapsed().as_millis() as u64;
            budget.record_attempt(provider.is_paid, latency);
            metrics.budget_elapsed_ms = budget.elapsed_ms;
            metrics.cascade_depth = idx + 1;

            tracing::trace!(
                "Provider {} returned in {}ms: {}",
                provider.name,
                latency,
                match &results {
                    Ok(r) => format!("{} results", r.len()),
                    Err(e) => format!("error: {}", e),
                }
            );

            match results {
                Ok(results) if !results.is_empty() => {
                    // Concatenate all results for better quality scoring
                    let combined_content = results
                        .iter()
                        .filter_map(|r| r.content.as_deref())
                        .collect::<Vec<_>>()
                        .join("\n\n");

                    let mut first = results[0].clone();
                    first.content = Some(combined_content.clone());
                    let content_str = first.content.as_deref().unwrap_or("");
                    let links = super::extract_links(content_str);
                    let threshold = config
                        .quality_threshold
                        .unwrap_or(profile_defaults.quality_threshold);
                    let quality = score_content(content_str, &links, threshold);

                    let acceptable = quality.acceptable && first.is_valid(min_chars);

                    tracing::debug!(
                        "Provider {} quality: score={:.2}, acceptable={}, content_len={}",
                        provider.name,
                        quality.score,
                        acceptable,
                        content_str.len()
                    );

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
                        first.content = Some(compact_content(content_str, max_chars));
                        first.metrics = Some(metrics);
                        first.routing_decisions = routing_decisions;

                        // Record success
                        {
                            let mut cb = circuit_breakers.lock().unwrap();
                            cb.record_success(&provider.name);
                        }
                        if !config.disable_routing_memory {
                            let mut rm = routing_memory.lock().unwrap();
                            rm.record("", &provider.name, true, latency, quality.score);
                        }
                        if let Some(cache) = cache {
                            let _ = cache.store(query, &results, &first.source).await;
                        }
                        return Ok(first);
                    } else {
                        // Record thin content
                        {
                            let mut nc = negative_cache.lock().unwrap();
                            nc.insert(
                                query,
                                &provider.name,
                                "thin_content",
                                NEGATIVE_CACHE_THIN_TTL,
                                HashMap::new(),
                            );
                        }
                        if !config.disable_routing_memory {
                            let mut rm = routing_memory.lock().unwrap();
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
                            query,
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
            "No query resolution method available".to_string(),
        ))
    }
}

impl Default for QueryCascade {
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
