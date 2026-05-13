use crate::semantic_cache::SemanticCacheConfig;
use crate::types::Profile;
use serde::Deserialize;
use std::collections::HashMap;
use std::env;
use std::path::Path;
use thiserror::Error;

use defaults::*;
mod defaults;
mod parsing;

pub use defaults::RoutingProfileConfig;
pub use defaults::routing_profile_defaults;

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

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    #[serde(default = "default_max_chars")]
    pub max_chars: usize,
    #[serde(default = "default_min_chars")]
    pub min_chars: usize,
    #[serde(default = "default_exa_results")]
    pub exa_results: usize,
    #[serde(default = "default_tavily_results")]
    pub tavily_results: usize,
    #[serde(default = "default_output_limit")]
    pub output_limit: usize,
    #[serde(default)]
    pub log_level: String,
    #[serde(default)]
    pub skip_providers: Vec<String>,
    #[serde(default)]
    pub providers_order: Vec<String>,
    #[serde(default)]
    pub semantic_cache: SemanticCacheConfig,
    #[serde(default)]
    pub cache: CacheConfig,
    #[serde(default)]
    pub routing: RoutingConfig,
    #[serde(default)]
    pub profile: Profile,
    pub quality_threshold: Option<f32>,
    pub max_provider_attempts: Option<usize>,
    pub max_paid_attempts: Option<usize>,
    pub max_total_latency_ms: Option<u64>,
    #[serde(default)]
    pub disable_routing_memory: bool,
    #[serde(default = "default_negative_cache_ttl")]
    pub negative_cache_ttl_secs: u64,
    #[serde(default = "default_error_cache_ttl")]
    pub error_cache_ttl_secs: u64,
    #[serde(default = "default_circuit_breaker_threshold")]
    pub circuit_breaker_threshold: u32,
    #[serde(default = "default_circuit_breaker_cooldown")]
    pub circuit_breaker_cooldown_secs: u64,
    #[serde(default = "default_max_links")]
    pub max_links: usize,
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

#[derive(Debug, Clone, Deserialize, Default)]
pub struct RoutingConfig {
    pub min_free_quality_to_skip_paid: Option<f32>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct CacheConfig {
    #[serde(default)]
    pub synthesis: SynthesisCacheConfig,
    #[serde(default)]
    pub ttl: CacheTtlConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SynthesisCacheConfig {
    #[serde(default = "default_synthesis_cache_enabled")]
    pub enabled: bool,
    #[serde(default = "default_synthesis_cache_ttl")]
    pub ttl: u64,
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
    pub fn from_file(path: impl AsRef<Path>) -> Result<Self, ConfigError> {
        let content = std::fs::read_to_string(path.as_ref())?;
        let file_config: Config = toml::from_str(&content)?;
        let mut config = Config::default();
        config.merge(file_config);
        Ok(config)
    }

    pub fn merge(&mut self, other: Config) {
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

    pub fn load() -> Self {
        let mut config = Config::default();
        parsing::apply_env_overrides(&mut config);
        config
    }

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

    pub fn is_skipped(&self, provider: &str) -> bool {
        self.skip_providers.iter().any(|p| p == provider)
    }

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
