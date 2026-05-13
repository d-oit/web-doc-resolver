use std::env;

use super::Config;

pub fn apply_env_overrides(config: &mut Config) {
    if let Ok(config_path) = env::var("DO_WDR_CONFIG") {
        if let Ok(file_config) = Config::from_file(&config_path) {
            config.merge(file_config);
        }
    } else {
        for path in ["./config.toml", "./do-wdr.toml", "./do-wdr.conf"] {
            if let Ok(file_config) = Config::from_file(path) {
                config.merge(file_config);
                break;
            }
        }
    }

    if let Ok(val) = env::var("DO_WDR_MAX_CHARS") {
        if let Ok(v) = val.parse() {
            config.max_chars = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_MIN_CHARS") {
        if let Ok(v) = val.parse() {
            config.min_chars = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_EXA_RESULTS") {
        if let Ok(v) = val.parse() {
            config.exa_results = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_TAVILY_RESULTS") {
        if let Ok(v) = val.parse() {
            config.tavily_results = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_OUTPUT_LIMIT") {
        if let Ok(v) = val.parse() {
            config.output_limit = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_LOG_LEVEL") {
        config.log_level = val;
    }
    if let Ok(val) = env::var("DO_WDR_SKIP_PROVIDERS") {
        config.skip_providers = val.split(',').map(|s| s.trim().to_string()).collect();
    }
    if let Ok(val) = env::var("DO_WDR_PROVIDERS_ORDER") {
        config.providers_order = val.split(',').map(|s| s.trim().to_string()).collect();
    }
    if let Ok(val) = env::var("DO_WDR_PROFILE") {
        if let Ok(p) = val.parse() {
            config.profile = p;
        }
    }
    if let Ok(val) = env::var("DO_WDR_QUALITY_THRESHOLD") {
        if let Ok(v) = val.parse() {
            config.quality_threshold = Some(v);
        }
    }
    if let Ok(val) = env::var("DO_WDR_MIN_FREE_QUALITY_TO_SKIP_PAID") {
        if let Ok(v) = val.parse() {
            config.routing.min_free_quality_to_skip_paid = Some(v);
        }
    }
    if let Ok(val) = env::var("DO_WDR_MAX_PROVIDER_ATTEMPTS") {
        if let Ok(v) = val.parse() {
            config.max_provider_attempts = Some(v);
        }
    }
    if let Ok(val) = env::var("DO_WDR_MAX_PAID_ATTEMPTS") {
        if let Ok(v) = val.parse() {
            config.max_paid_attempts = Some(v);
        }
    }
    if let Ok(val) = env::var("DO_WDR_MAX_TOTAL_LATENCY_MS") {
        if let Ok(v) = val.parse() {
            config.max_total_latency_ms = Some(v);
        }
    }
    if let Ok(val) = env::var("DO_WDR_DISABLE_ROUTING_MEMORY") {
        if let Ok(v) = val.parse() {
            config.disable_routing_memory = v;
        }
    }

    if let Ok(val) = env::var("DO_WDR_CACHE_TTL_FIRECRAWL") {
        if let Ok(v) = val.parse() {
            config.cache.ttl.firecrawl = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_CACHE_TTL_EXA") {
        if let Ok(v) = val.parse() {
            config.cache.ttl.exa = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_CACHE_TTL_TAVILY") {
        if let Ok(v) = val.parse() {
            config.cache.ttl.tavily = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_CACHE_TTL_SERPER") {
        if let Ok(v) = val.parse() {
            config.cache.ttl.serper = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_CACHE_TTL_JINA") {
        if let Ok(v) = val.parse() {
            config.cache.ttl.jina = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_CACHE_TTL_MISTRAL") {
        if let Ok(v) = val.parse() {
            config.cache.ttl.mistral = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_CACHE_TTL_DUCKDUCKGO") {
        if let Ok(v) = val.parse() {
            config.cache.ttl.duckduckgo = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_CACHE_TTL_LLMS_TXT") {
        if let Ok(v) = val.parse() {
            config.cache.ttl.llms_txt = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_CACHE_TTL_SYNTHESIS") {
        if let Ok(v) = val.parse() {
            config.cache.ttl.synthesis = v;
        }
    }
    if let Ok(val) = env::var("DO_WDR_CACHE_TTL_DEFAULT") {
        if let Ok(v) = val.parse() {
            config.cache.ttl.default = v;
        }
    }

    if let Ok(val) = env::var("DO_WDR_SEMANTIC_CACHE__ENABLED") {
        config.semantic_cache.enabled = val.parse().unwrap_or(false);
    }
    if let Ok(val) = env::var("DO_WDR_SEMANTIC_CACHE__PATH") {
        config.semantic_cache.path = val;
    }
    if let Ok(val) = env::var("DO_WDR_SEMANTIC_CACHE__THRESHOLD") {
        config.semantic_cache.threshold = val.parse().unwrap_or(0.85);
    }
    if let Ok(val) = env::var("DO_WDR_SEMANTIC_CACHE__MAX_ENTRIES") {
        config.semantic_cache.max_entries = val.parse().unwrap_or(10000);
    }
}
