pub struct RoutingProfileConfig {
    pub max_provider_attempts: usize,
    pub max_paid_attempts: usize,
    pub max_total_latency_ms: u64,
    pub quality_threshold: f32,
    pub min_free_quality_to_skip_paid: f32,
    pub allow_paid: bool,
}

pub fn routing_profile_defaults(name: &str) -> RoutingProfileConfig {
    match name {
        "free" => RoutingProfileConfig {
            max_provider_attempts: 3,
            max_paid_attempts: 0,
            max_total_latency_ms: 6_000,
            quality_threshold: 0.70,
            min_free_quality_to_skip_paid: 0.70,
            allow_paid: false,
        },
        "balanced" => RoutingProfileConfig {
            max_provider_attempts: 6,
            max_paid_attempts: 2,
            max_total_latency_ms: 12_000,
            quality_threshold: 0.70,
            min_free_quality_to_skip_paid: 0.70,
            allow_paid: true,
        },
        "fast" => RoutingProfileConfig {
            max_provider_attempts: 2,
            max_paid_attempts: 1,
            max_total_latency_ms: 4_000,
            quality_threshold: 0.70,
            min_free_quality_to_skip_paid: 0.70,
            allow_paid: true,
        },
        "quality" => RoutingProfileConfig {
            max_provider_attempts: 10,
            max_paid_attempts: 5,
            max_total_latency_ms: 20_000,
            quality_threshold: 0.75,
            min_free_quality_to_skip_paid: 0.75,
            allow_paid: true,
        },
        _ => RoutingProfileConfig {
            max_provider_attempts: 6,
            max_paid_attempts: 2,
            max_total_latency_ms: 12_000,
            quality_threshold: 0.70,
            min_free_quality_to_skip_paid: 0.70,
            allow_paid: true,
        },
    }
}

pub(crate) fn default_burst() -> f64 {
    1.0
}

pub(crate) fn default_synthesis_cache_enabled() -> bool {
    true
}

pub(crate) fn default_synthesis_cache_ttl() -> u64 {
    43200
}

pub(crate) fn default_max_chars() -> usize {
    8000
}

pub(crate) fn default_min_chars() -> usize {
    200
}

pub(crate) fn default_exa_results() -> usize {
    5
}

pub(crate) fn default_tavily_results() -> usize {
    3
}

pub(crate) fn default_output_limit() -> usize {
    10
}

pub(crate) fn default_negative_cache_ttl() -> u64 {
    1800
}

pub(crate) fn default_error_cache_ttl() -> u64 {
    600
}

pub(crate) fn default_circuit_breaker_threshold() -> u32 {
    3
}

pub(crate) fn default_circuit_breaker_cooldown() -> u64 {
    300
}

pub(crate) fn default_max_links() -> usize {
    10
}

pub(crate) fn default_ttl_firecrawl() -> u64 {
    21600
}

pub(crate) fn default_ttl_exa() -> u64 {
    14400
}

pub(crate) fn default_ttl_tavily() -> u64 {
    14400
}

pub(crate) fn default_ttl_serper() -> u64 {
    7200
}

pub(crate) fn default_ttl_jina() -> u64 {
    7200
}

pub(crate) fn default_ttl_mistral() -> u64 {
    28800
}

pub(crate) fn default_ttl_duckduckgo() -> u64 {
    3600
}

pub(crate) fn default_ttl_llms_txt() -> u64 {
    28800
}

pub(crate) fn default_ttl_synthesis() -> u64 {
    43200
}

pub(crate) fn default_ttl_default() -> u64 {
    3600
}
