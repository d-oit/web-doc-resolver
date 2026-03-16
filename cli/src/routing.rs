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

#[allow(clippy::too_many_arguments)]
pub fn plan_provider_order(
    target: &str,
    is_url: bool,
    custom_order: Option<&[String]>,
    skip_providers: &[String],
    routing_memory: Option<&RoutingMemory>,
) -> Vec<PlannedProvider> {
    let mut base: Vec<String> = if let Some(custom) = custom_order {
        custom.to_vec()
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
        vec![
            "exa_mcp".into(),
            "exa".into(),
            "tavily".into(),
            "duckduckgo".into(),
            "mistral_websearch".into(),
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
