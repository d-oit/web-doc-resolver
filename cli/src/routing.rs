use crate::routing_memory::RoutingMemory;

#[derive(Debug, Clone)]
pub struct ResolutionBudget {
    pub max_provider_attempts: usize,
    pub max_paid_attempts: usize,
    pub max_total_latency_ms: u64,
    pub allow_paid: bool,
    pub attempts: usize,
    pub paid_attempts: usize,
    pub elapsed_ms: u64,
    pub stop_reason: Option<String>,
}

impl ResolutionBudget {
    pub fn can_try(&mut self, is_paid: bool) -> bool {
        if self.attempts >= self.max_provider_attempts {
            self.stop_reason = Some("max_provider_attempts".into());
            return false;
        }
        if is_paid && !self.allow_paid {
            self.stop_reason = Some("paid_disabled".into());
            return false;
        }
        if is_paid && self.paid_attempts >= self.max_paid_attempts {
            self.stop_reason = Some("max_paid_attempts".into());
            return false;
        }
        if self.elapsed_ms >= self.max_total_latency_ms {
            self.stop_reason = Some("max_total_latency_ms".into());
            return false;
        }
        true
    }

    pub fn record_attempt(&mut self, is_paid: bool, latency_ms: u64) {
        self.attempts += 1;
        self.elapsed_ms += latency_ms;
        if is_paid {
            self.paid_attempts += 1;
        }
    }
}

#[derive(Debug, Clone)]
pub struct PlannedProvider {
    pub name: String,
    pub is_paid: bool,
    pub skip_reason: Option<String>,
}

/// Check if a provider should be skipped based on budget or performance
pub fn should_skip_provider(
    provider_name: &str,
    is_paid: bool,
    best_quality: f32,
    config: &crate::config::Config,
    routing_memory: &crate::routing_memory::RoutingMemory,
) -> Option<String> {
    let threshold = config.routing.min_free_quality_to_skip_paid();
    if best_quality < threshold || threshold.is_nan() {
        return None;
    }

    // Quality gate: Skip paid providers
    if is_paid {
        return Some("quality_gate".into());
    }

    // Exa MCP budget guard
    if provider_name == "exa_mcp" {
        let usage = routing_memory.exa_monthly_usage();
        let exa_fraction = usage as f32 / config.routing.exa.monthly_free_quota as f32;
        if exa_fraction > config.routing.exa.budget_warn_threshold {
            return Some("quota_budget_guard".into());
        }
    }

    // Low win-rate skip
    let win_rate = routing_memory.domain_win_rate("query", provider_name);
    if win_rate < config.routing.provider_skip_win_rate_threshold() {
        return Some("low_win_rate".into());
    }

    None
}

#[allow(clippy::too_many_arguments)]
pub fn plan_provider_order(
    target: &str,
    is_url: bool,
    custom_order: Option<&[String]>,
    skip_providers: &[String],
    routing_memory: Option<&RoutingMemory>,
) -> Vec<PlannedProvider> {
    let mut base: Vec<String> = if let Some(custom) = custom_order {
        custom
            .iter()
            .filter(|p| {
                if let Ok(pt) = p.parse::<crate::types::ProviderType>() {
                    if is_url {
                        pt.is_url_provider()
                    } else {
                        pt.is_query_provider()
                    }
                } else {
                    false
                }
            })
            .cloned()
            .collect()
    } else if is_url {
        vec![
            "llms_txt".into(),
            "jina".into(),
            "firecrawl".into(),
            "direct_fetch".into(),
            "mistral_browser".into(),
            "duckduckgo".into(),
        ]
    } else {
        // DuckDuckGo deprioritized due to instability (Alert 2026-04-20)
        vec![
            "exa_mcp".into(),
            "exa".into(),
            "tavily".into(),
            "mistral_websearch".into(),
            "duckduckgo".into(),
        ]
    };

    if let Some(memory) = routing_memory {
        if is_url {
            base = memory.rank_for_target(target, &base);
        }
    }

    base.into_iter()
        .filter(|p| !skip_providers.contains(p))
        .map(|name| PlannedProvider {
            is_paid: matches!(
                name.as_str(),
                "exa" | "tavily" | "firecrawl" | "mistral_browser" | "mistral_websearch" | "serper"
            ),
            name,
            skip_reason: None,
        })
        .collect()
}
