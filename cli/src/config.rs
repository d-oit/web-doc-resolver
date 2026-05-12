//! Configuration module for the Web Documentation Resolver CLI.
//!
//! Provides layered config loading: config.toml + DO_WDR_* env vars + API key env vars.

use crate::semantic_cache::SemanticCacheConfig;
use crate::types::Profile;
use serde::Deserialize;
use std::collections::HashMap;
use std::env;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
#[allow(dead_code)]
pub enum ConfigError {
    #[error("Failed to read config file: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Failed to parse config file: {0}")]
    ParseError(#[from] toml::de::Error),
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
}

/// Main configuration struct
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    /// Maximum characters in output (default: 8000)
    #[serde(default = "default_max_chars")]
    pub max_chars: usize,
    /// Minimum characters for valid content (default: 200)
    #[serde(default = "default_min_chars")]
    pub min_chars: usize,
    /// Number of Exa results (default: 5)
    #[serde(default = "default_exa_results")]
    pub exa_results: usize,
    /// Number of Tavily results (default: 3)
    #[serde(default = "default_tavily_results")]
    pub tavily_results: usize,
    /// Maximum output results (default: 10)
    #[serde(default = "default_output_limit")]
    pub output_limit: usize,
    /// Log level (default: info)
    #[serde(default)]
    pub log_level: String,
    /// Skip specific providers
    #[serde(default)]
    pub skip_providers: Vec<String>,
    /// Provider order (custom cascade order)
    #[serde(default)]
    pub providers_order: Vec<String>,
    /// Semantic cache configuration
    #[serde(default)]
    pub semantic_cache: SemanticCacheConfig,
    /// Cache configuration
    #[serde(default)]
    pub cache: CacheConfig,
    /// Routing configuration
    #[serde(default)]
    pub routing: RoutingConfig,
    /// Execution profile (default: balanced)
    #[serde(default)]
    pub profile: Profile,
    /// Quality threshold (default: from profile)
    pub quality_threshold: Option<f32>,
    /// Max provider attempts (default: from profile)
    pub max_provider_attempts: Option<usize>,
    /// Max paid attempts (default: from profile)
    pub max_paid_attempts: Option<usize>,
    /// Max total latency (default: from profile)
    pub max_total_latency_ms: Option<u64>,
    /// Disable routing memory
    #[serde(default)]
    pub disable_routing_memory: bool,
    /// Negative cache TTL for thin content in seconds (default: 1800)
    #[serde(default = "default_negative_cache_ttl")]
    pub negative_cache_ttl_secs: u64,
    /// Negative cache TTL for errors in seconds (default: 600)
    #[serde(default = "default_error_cache_ttl")]
    pub error_cache_ttl_secs: u64,
    /// Circuit breaker failure threshold (default: 3)
    #[serde(default = "default_circuit_breaker_threshold")]
    pub circuit_breaker_threshold: u32,
    /// Circuit breaker cooldown in seconds (default: 300)
    #[serde(default = "default_circuit_breaker_cooldown")]
    pub circuit_breaker_cooldown_secs: u64,
    /// Max links to extract (default: 10)
    #[serde(default = "default_max_links")]
    pub max_links: usize,
    /// Provider-specific configurations
    #[serde(default)]
    pub providers: HashMap<String, ProviderConfig>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ProviderConfig {
    pub rate_limit: Option<RateLimitConfig>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct RateLimitConfig {
    pub requests_per_second: f64,
    #[serde(default = "default_burst")]
    pub burst: f64,
}

fn default_burst() -> f64 {
    1.0
}

/// Routing configuration
#[derive(Debug, Clone, Deserialize, Default)]
pub struct RoutingConfig {
    /// Quality threshold for free results to skip paid providers (default: 0.70)
    pub min_free_quality_to_skip_paid: Option<f32>,
}

/// Aggregated cache configuration
#[derive(Debug, Clone, Deserialize, Default)]
pub struct CacheConfig {
    /// Synthesis cache configuration
    #[serde(default)]
    pub synthesis: SynthesisCacheConfig,
    #[serde(default)]
    pub ttl: CacheTtlConfig,
}

/// Synthesis cache configuration
#[derive(Debug, Clone, Deserialize)]
pub struct SynthesisCacheConfig {
    /// Enable synthesis cache
    #[serde(default = "default_synthesis_cache_enabled")]
    pub enabled: bool,
    /// TTL for synthesis results in seconds (default: 43200 = 12h)
    #[serde(default = "default_synthesis_cache_ttl")]
    pub ttl: u64,
}

fn default_synthesis_cache_enabled() -> bool {
    true
}

fn default_synthesis_cache_ttl() -> u64 {
    43200
}

impl Default for SynthesisCacheConfig {
    fn default() -> Self {
        Self {
            enabled: default_synthesis_cache_enabled(),
            ttl: default_synthesis_cache_ttl(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct CacheTtlConfig {
    #[serde(default = "default_ttl_firecrawl")]
    pub firecrawl: u64,
    #[serde(default = "default_ttl_exa")]
    pub exa: u64,
    #[serde(default = "default_ttl_tavily")]
    pub tavily: u64,
    #[serde(default = "default_ttl_serper")]
    pub serper: u64,
    #[serde(default = "default_ttl_jina")]
    pub jina: u64,
    #[serde(default = "default_ttl_mistral")]
    pub mistral: u64,
    #[serde(default = "default_ttl_duckduckgo")]
    pub duckduckgo: u64,
    #[serde(default = "default_ttl_llms_txt")]
    pub llms_txt: u64,
    #[serde(default = "default_ttl_synthesis")]
    pub synthesis: u64,
    #[serde(default = "default_ttl_default")]
    pub default: u64,
}

impl Default for CacheTtlConfig {
    fn default() -> Self {
        Self {
            firecrawl: default_ttl_firecrawl(),
            exa: default_ttl_exa(),
            tavily: default_ttl_tavily(),
            serper: default_ttl_serper(),
            jina: default_ttl_jina(),
            mistral: default_ttl_mistral(),
            duckduckgo: default_ttl_duckduckgo(),
            llms_txt: default_ttl_llms_txt(),
            synthesis: default_ttl_synthesis(),
            default: default_ttl_default(),
        }
    }
}

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
        "fast" => RoutingProfileConfig {
            max_provider_attempts: 2,
            max_paid_attempts: 1,
            max_total_latency_ms: 4_000,
            quality_threshold: 0.60,
            min_free_quality_to_skip_paid: 0.70,
            allow_paid: true,
        },
        "quality" => RoutingProfileConfig {
            max_provider_attempts: 6,
            max_paid_attempts: 3,
            max_total_latency_ms: 15_000,
            quality_threshold: 0.55,
            min_free_quality_to_skip_paid: 0.75, // Higher threshold for quality profile
            allow_paid: true,
        },
        _ => RoutingProfileConfig {
            max_provider_attempts: 4,
            max_paid_attempts: 1,
            max_total_latency_ms: 9_000,
            quality_threshold: 0.65,
            min_free_quality_to_skip_paid: 0.70,
            allow_paid: true,
        },
    }
}

fn default_max_chars() -> usize {
    8000
}

fn default_min_chars() -> usize {
    200
}

fn default_exa_results() -> usize {
    5
}

fn default_tavily_results() -> usize {
    3
}

fn default_output_limit() -> usize {
    10
}

fn default_negative_cache_ttl() -> u64 {
    1800
}

fn default_error_cache_ttl() -> u64 {
    600
}

fn default_circuit_breaker_threshold() -> u32 {
    3
}

fn default_circuit_breaker_cooldown() -> u64 {
    300
}

fn default_max_links() -> usize {
    10
}

fn default_ttl_firecrawl() -> u64 {
    21600
}

fn default_ttl_exa() -> u64 {
    14400
}

fn default_ttl_tavily() -> u64 {
    14400
}

fn default_ttl_serper() -> u64 {
    7200
}

fn default_ttl_jina() -> u64 {
    7200
}

fn default_ttl_mistral() -> u64 {
    28800
}

fn default_ttl_duckduckgo() -> u64 {
    3600
}

fn default_ttl_llms_txt() -> u64 {
    28800
}

fn default_ttl_synthesis() -> u64 {
    43200
}

fn default_ttl_default() -> u64 {
    3600
}

impl Default for Config {
    fn default() -> Self {
        Self {
            max_chars: default_max_chars(),
            min_chars: default_min_chars(),
            exa_results: default_exa_results(),
            tavily_results: default_tavily_results(),
            output_limit: default_output_limit(),
            log_level: "info".to_string(),
            skip_providers: Vec::new(),
            providers_order: Vec::new(),
            semantic_cache: SemanticCacheConfig::default(),
            cache: CacheConfig::default(),
            routing: RoutingConfig::default(),
            profile: Profile::Balanced,
            quality_threshold: None,
            max_provider_attempts: None,
            max_paid_attempts: None,
            max_total_latency_ms: None,
            disable_routing_memory: false,
            negative_cache_ttl_secs: default_negative_cache_ttl(),
            error_cache_ttl_secs: default_error_cache_ttl(),
            circuit_breaker_threshold: default_circuit_breaker_threshold(),
            circuit_breaker_cooldown_secs: default_circuit_breaker_cooldown(),
            max_links: default_max_links(),
            providers: HashMap::new(),
        }
    }
}

impl Config {
    /// Load configuration from a TOML file and merge with defaults
    pub fn from_file(path: impl AsRef<Path>) -> Result<Self, ConfigError> {
        let content = std::fs::read_to_string(path.as_ref())?;
        let file_config: Config = toml::from_str(&content)?;
        // Merge file config with defaults - file values override defaults
        let mut config = Config::default();
        config.merge(file_config);
        Ok(config)
    }

    /// Merge another config into self, overriding only set values
    pub fn merge(&mut self, other: Config) {
        // Only override if the value differs from default
        if other.max_chars != default_max_chars() {
            self.max_chars = other.max_chars;
        }
        if other.min_chars != default_min_chars() {
            self.min_chars = other.min_chars;
        }
        if other.exa_results != default_exa_results() {
            self.exa_results = other.exa_results;
        }
        if other.tavily_results != default_tavily_results() {
            self.tavily_results = other.tavily_results;
        }
        if other.output_limit != default_output_limit() {
            self.output_limit = other.output_limit;
        }
        if other.log_level != "info" {
            self.log_level = other.log_level;
        }
        if !other.skip_providers.is_empty() {
            self.skip_providers = other.skip_providers;
        }
        if !other.providers_order.is_empty() {
            self.providers_order = other.providers_order;
        }
        if other.negative_cache_ttl_secs != default_negative_cache_ttl() {
            self.negative_cache_ttl_secs = other.negative_cache_ttl_secs;
        }
        if other.error_cache_ttl_secs != default_error_cache_ttl() {
            self.error_cache_ttl_secs = other.error_cache_ttl_secs;
        }
        if other.circuit_breaker_threshold != default_circuit_breaker_threshold() {
            self.circuit_breaker_threshold = other.circuit_breaker_threshold;
        }
        if other.circuit_breaker_cooldown_secs != default_circuit_breaker_cooldown() {
            self.circuit_breaker_cooldown_secs = other.circuit_breaker_cooldown_secs;
        }
        if other.max_links != default_max_links() {
            self.max_links = other.max_links;
        }
        // Merge cache TTLs
        if other.cache.ttl.firecrawl != default_ttl_firecrawl() {
            self.cache.ttl.firecrawl = other.cache.ttl.firecrawl;
        }
        if other.cache.ttl.exa != default_ttl_exa() {
            self.cache.ttl.exa = other.cache.ttl.exa;
        }
        if other.cache.ttl.tavily != default_ttl_tavily() {
            self.cache.ttl.tavily = other.cache.ttl.tavily;
        }
        if other.cache.ttl.serper != default_ttl_serper() {
            self.cache.ttl.serper = other.cache.ttl.serper;
        }
        if other.cache.ttl.jina != default_ttl_jina() {
            self.cache.ttl.jina = other.cache.ttl.jina;
        }
        if other.cache.ttl.mistral != default_ttl_mistral() {
            self.cache.ttl.mistral = other.cache.ttl.mistral;
        }
        if other.cache.ttl.duckduckgo != default_ttl_duckduckgo() {
            self.cache.ttl.duckduckgo = other.cache.ttl.duckduckgo;
        }
        if other.cache.ttl.llms_txt != default_ttl_llms_txt() {
            self.cache.ttl.llms_txt = other.cache.ttl.llms_txt;
        }
        if other.cache.ttl.synthesis != default_ttl_synthesis() {
            self.cache.ttl.synthesis = other.cache.ttl.synthesis;
        }
        if other.cache.ttl.default != default_ttl_default() {
            self.cache.ttl.default = other.cache.ttl.default;
        }

        if other.profile != Profile::Balanced {
            self.profile = other.profile;
        }
        if other.quality_threshold.is_some() {
            self.quality_threshold = other.quality_threshold;
        }
        if other.routing.min_free_quality_to_skip_paid.is_some() {
            self.routing.min_free_quality_to_skip_paid =
                other.routing.min_free_quality_to_skip_paid;
        }
        if other.max_provider_attempts.is_some() {
            self.max_provider_attempts = other.max_provider_attempts;
        }
        if other.max_paid_attempts.is_some() {
            self.max_paid_attempts = other.max_paid_attempts;
        }
        if other.max_total_latency_ms.is_some() {
            self.max_total_latency_ms = other.max_total_latency_ms;
        }
        if other.disable_routing_memory {
            self.disable_routing_memory = other.disable_routing_memory;
        }
        if !other.providers.is_empty() {
            for (name, provider_config) in other.providers {
                self.providers.insert(name, provider_config);
            }
        }
    }

    /// Load configuration with environment variable overrides
    pub fn load() -> Self {
        // Start with defaults
        let mut config = Config::default();

        // Try to load from config.toml and merge
        if let Ok(config_path) = env::var("DO_WDR_CONFIG") {
            if let Ok(file_config) = Config::from_file(&config_path) {
                config.merge(file_config);
            }
        } else {
            // Try default locations
            for path in ["./config.toml", "./do-wdr.toml", "./do-wdr.conf"] {
                if let Ok(file_config) = Config::from_file(path) {
                    config.merge(file_config);
                    break;
                }
            }
        }

        // Override with environment variables
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

        // Cache TTL overrides from environment variables
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

        // Semantic cache config from env vars
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

        config
    }

    /// Get API key for a provider
    #[allow(dead_code)]
    pub fn api_key(&self, provider: &str) -> Option<String> {
        let key_name = match provider {
            "exa" | "exa_mcp" => "EXA_API_KEY",
            "tavily" => "TAVILY_API_KEY",
            "serper" => "SERPER_API_KEY",
            "firecrawl" => "FIRECRAWL_API_KEY",
            "mistral" | "mistral_browser" | "mistral_websearch" => "MISTRAL_API_KEY",
            _ => return None,
        };
        env::var(key_name).ok()
    }

    /// Check if a provider should be skipped
    pub fn is_skipped(&self, provider: &str) -> bool {
        self.skip_providers.iter().any(|p| p == provider)
    }

    /// Get the TTL for a given provider
    pub fn get_ttl(&self, provider: &str) -> u64 {
        match provider {
            "firecrawl" => self.cache.ttl.firecrawl,
            "exa" | "exa_mcp" => self.cache.ttl.exa,
            "tavily" => self.cache.ttl.tavily,
            "serper" => self.cache.ttl.serper,
            "jina" => self.cache.ttl.jina,
            "mistral" | "mistral_browser" | "mistral_websearch" => self.cache.ttl.mistral,
            "duckduckgo" => self.cache.ttl.duckduckgo,
            "llms_txt" => self.cache.ttl.llms_txt,
            "synthesis" => self.cache.ttl.synthesis,
            _ => self.cache.ttl.default,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert_eq!(config.max_chars, 8000);
        assert_eq!(config.min_chars, 200);
        assert_eq!(config.exa_results, 5);
        assert_eq!(config.tavily_results, 3);
        assert_eq!(config.output_limit, 10);
    }

    #[test]
    fn test_api_key_lookup() {
        // Note: This test may fail if env vars are set
        let config = Config::default();
        assert!(config.api_key("unknown").is_none());
    }

    #[test]
    fn test_skip_providers() {
        let config = Config {
            skip_providers: vec!["exa".to_string(), "tavily".to_string()],
            ..Default::default()
        };

        assert!(config.is_skipped("exa"));
        assert!(config.is_skipped("tavily"));
        assert!(!config.is_skipped("firecrawl"));
    }

    #[test]
    fn test_get_ttl() {
        let config = Config::default();
        assert_eq!(config.get_ttl("firecrawl"), 21600);
        assert_eq!(config.get_ttl("exa"), 14400);
        assert_eq!(config.get_ttl("exa_mcp"), 14400);
        assert_eq!(config.get_ttl("tavily"), 14400);
        assert_eq!(config.get_ttl("serper"), 7200);
        assert_eq!(config.get_ttl("jina"), 7200);
        assert_eq!(config.get_ttl("mistral"), 28800);
        assert_eq!(config.get_ttl("mistral_browser"), 28800);
        assert_eq!(config.get_ttl("mistral_websearch"), 28800);
        assert_eq!(config.get_ttl("duckduckgo"), 3600);
        assert_eq!(config.get_ttl("llms_txt"), 28800);
        assert_eq!(config.get_ttl("synthesis"), 43200);
        assert_eq!(config.get_ttl("unknown"), 3600);
    }
}
