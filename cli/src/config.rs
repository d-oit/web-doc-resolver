//! Configuration module for the Web Documentation Resolver CLI.
//!
//! Provides layered config loading: config.toml + WDR_* env vars + API key env vars.

use crate::semantic_cache::SemanticCacheConfig;
use crate::types::Profile;
use serde::Deserialize;
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
}

pub struct RoutingProfileConfig {
    pub max_provider_attempts: usize,
    pub max_paid_attempts: usize,
    pub max_total_latency_ms: u64,
    pub quality_threshold: f32,
    pub allow_paid: bool,
}

pub fn routing_profile_defaults(name: &str) -> RoutingProfileConfig {
    match name {
        "free" => RoutingProfileConfig {
            max_provider_attempts: 3,
            max_paid_attempts: 0,
            max_total_latency_ms: 6_000,
            quality_threshold: 0.70,
            allow_paid: false,
        },
        "fast" => RoutingProfileConfig {
            max_provider_attempts: 2,
            max_paid_attempts: 1,
            max_total_latency_ms: 4_000,
            quality_threshold: 0.60,
            allow_paid: true,
        },
        "quality" => RoutingProfileConfig {
            max_provider_attempts: 6,
            max_paid_attempts: 3,
            max_total_latency_ms: 15_000,
            quality_threshold: 0.55,
            allow_paid: true,
        },
        _ => RoutingProfileConfig {
            max_provider_attempts: 4,
            max_paid_attempts: 1,
            max_total_latency_ms: 9_000,
            quality_threshold: 0.65,
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
            profile: Profile::Balanced,
            quality_threshold: None,
            max_provider_attempts: None,
            max_paid_attempts: None,
            max_total_latency_ms: None,
            disable_routing_memory: false,
        }
    }
}

impl Config {
    /// Load configuration from a TOML file
    pub fn from_file(path: impl AsRef<Path>) -> Result<Self, ConfigError> {
        let content = std::fs::read_to_string(path.as_ref())?;
        let config: Config = toml::from_str(&content)?;
        Ok(config)
    }

    /// Load configuration with environment variable overrides
    pub fn load() -> Self {
        // Start with defaults
        let mut config = Config::default();

        // Try to load from config.toml
        if let Ok(config_path) = env::var("WDR_CONFIG") {
            if let Ok(file_config) = Config::from_file(&config_path) {
                config = file_config;
            }
        } else {
            // Try default locations
            for path in ["./config.toml", "./wdr.toml", "./wdr.conf"] {
                if let Ok(file_config) = Config::from_file(path) {
                    config = file_config;
                    break;
                }
            }
        }

        // Override with environment variables
        if let Ok(val) = env::var("WDR_MAX_CHARS") {
            if let Ok(v) = val.parse() {
                config.max_chars = v;
            }
        }
        if let Ok(val) = env::var("WDR_MIN_CHARS") {
            if let Ok(v) = val.parse() {
                config.min_chars = v;
            }
        }
        if let Ok(val) = env::var("WDR_EXA_RESULTS") {
            if let Ok(v) = val.parse() {
                config.exa_results = v;
            }
        }
        if let Ok(val) = env::var("WDR_TAVILY_RESULTS") {
            if let Ok(v) = val.parse() {
                config.tavily_results = v;
            }
        }
        if let Ok(val) = env::var("WDR_OUTPUT_LIMIT") {
            if let Ok(v) = val.parse() {
                config.output_limit = v;
            }
        }
        if let Ok(val) = env::var("WDR_LOG_LEVEL") {
            config.log_level = val;
        }
        if let Ok(val) = env::var("WDR_SKIP_PROVIDERS") {
            config.skip_providers = val.split(',').map(|s| s.trim().to_string()).collect();
        }
        if let Ok(val) = env::var("WDR_PROVIDERS_ORDER") {
            config.providers_order = val.split(',').map(|s| s.trim().to_string()).collect();
        }
        if let Ok(val) = env::var("WDR_PROFILE") {
            if let Ok(p) = val.parse() {
                config.profile = p;
            }
        }
        if let Ok(val) = env::var("WDR_QUALITY_THRESHOLD") {
            if let Ok(v) = val.parse() {
                config.quality_threshold = Some(v);
            }
        }
        if let Ok(val) = env::var("WDR_MAX_PROVIDER_ATTEMPTS") {
            if let Ok(v) = val.parse() {
                config.max_provider_attempts = Some(v);
            }
        }
        if let Ok(val) = env::var("WDR_MAX_PAID_ATTEMPTS") {
            if let Ok(v) = val.parse() {
                config.max_paid_attempts = Some(v);
            }
        }
        if let Ok(val) = env::var("WDR_MAX_TOTAL_LATENCY_MS") {
            if let Ok(v) = val.parse() {
                config.max_total_latency_ms = Some(v);
            }
        }
        if let Ok(val) = env::var("WDR_DISABLE_ROUTING_MEMORY") {
            if let Ok(v) = val.parse() {
                config.disable_routing_memory = v;
            }
        }

        // Semantic cache config from env vars
        if let Ok(val) = env::var("WDR_SEMANTIC_CACHE__ENABLED") {
            config.semantic_cache.enabled = val.parse().unwrap_or(false);
        }
        if let Ok(val) = env::var("WDR_SEMANTIC_CACHE__PATH") {
            config.semantic_cache.path = val;
        }
        if let Ok(val) = env::var("WDR_SEMANTIC_CACHE__THRESHOLD") {
            config.semantic_cache.threshold = val.parse().unwrap_or(0.85);
        }
        if let Ok(val) = env::var("WDR_SEMANTIC_CACHE__MAX_ENTRIES") {
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
}
