//! Configuration module for the Web Documentation Resolver CLI.
//!
//! Provides layered config loading: config.toml + DO_WDR_* env vars + API key env vars.

use crate::semantic_cache::SemanticCacheConfig;
use crate::types::Profile;
use serde::Deserialize;
use std::env;
use std::path::Path;
use std::str::FromStr;
use thiserror::Error;

const ENV_CONFIG: &str = "DO_WDR_CONFIG";
const ENV_MAX_CHARS: &str = "DO_WDR_MAX_CHARS";
const ENV_MIN_CHARS: &str = "DO_WDR_MIN_CHARS";
const ENV_EXA_RESULTS: &str = "DO_WDR_EXA_RESULTS";
const ENV_TAVILY_RESULTS: &str = "DO_WDR_TAVILY_RESULTS";
const ENV_OUTPUT_LIMIT: &str = "DO_WDR_OUTPUT_LIMIT";
const ENV_LOG_LEVEL: &str = "DO_WDR_LOG_LEVEL";
const ENV_SKIP_PROVIDERS: &str = "DO_WDR_SKIP_PROVIDERS";
const ENV_PROVIDERS_ORDER: &str = "DO_WDR_PROVIDERS_ORDER";
const ENV_PROFILE: &str = "DO_WDR_PROFILE";
const ENV_QUALITY_THRESHOLD: &str = "DO_WDR_QUALITY_THRESHOLD";
const ENV_MAX_PROVIDER_ATTEMPTS: &str = "DO_WDR_MAX_PROVIDER_ATTEMPTS";
const ENV_MAX_PAID_ATTEMPTS: &str = "DO_WDR_MAX_PAID_ATTEMPTS";
const ENV_MAX_TOTAL_LATENCY_MS: &str = "DO_WDR_MAX_TOTAL_LATENCY_MS";
const ENV_DISABLE_ROUTING_MEMORY: &str = "DO_WDR_DISABLE_ROUTING_MEMORY";
const ENV_CACHE_TTL_FIRECRAWL: &str = "DO_WDR_CACHE_TTL_FIRECRAWL";
const ENV_CACHE_TTL_EXA: &str = "DO_WDR_CACHE_TTL_EXA";
const ENV_CACHE_TTL_TAVILY: &str = "DO_WDR_CACHE_TTL_TAVILY";
const ENV_CACHE_TTL_SERPER: &str = "DO_WDR_CACHE_TTL_SERPER";
const ENV_CACHE_TTL_JINA: &str = "DO_WDR_CACHE_TTL_JINA";
const ENV_CACHE_TTL_MISTRAL: &str = "DO_WDR_CACHE_TTL_MISTRAL";
const ENV_CACHE_TTL_DUCKDUCKGO: &str = "DO_WDR_CACHE_TTL_DUCKDUCKGO";
const ENV_CACHE_TTL_LLMS_TXT: &str = "DO_WDR_CACHE_TTL_LLMS_TXT";
const ENV_CACHE_TTL_SYNTHESIS: &str = "DO_WDR_CACHE_TTL_SYNTHESIS";
const ENV_CACHE_TTL_DEFAULT: &str = "DO_WDR_CACHE_TTL_DEFAULT";
const ENV_MIN_FREE_QUALITY: &str = "DO_WDR_ROUTING__MIN_FREE_QUALITY_TO_SKIP_PAID";
const ENV_SKIP_WIN_RATE: &str = "DO_WDR_ROUTING__PROVIDER_SKIP_WIN_RATE_THRESHOLD";
const ENV_EXA_QUOTA: &str = "DO_WDR_ROUTING__EXA__MONTHLY_FREE_QUOTA";
const ENV_EXA_BUDGET_WARN: &str = "DO_WDR_ROUTING__EXA__BUDGET_WARN_THRESHOLD";
const ENV_EXA_RESET_DAY: &str = "DO_WDR_ROUTING__EXA__RESET_DAY";
const ENV_SEMANTIC_CACHE_ENABLED: &str = "DO_WDR_SEMANTIC_CACHE__ENABLED";
const ENV_SEMANTIC_CACHE_PATH: &str = "DO_WDR_SEMANTIC_CACHE__PATH";
const ENV_SEMANTIC_CACHE_THRESHOLD: &str = "DO_WDR_SEMANTIC_CACHE__THRESHOLD";
const ENV_SEMANTIC_CACHE_MAX_ENTRIES: &str = "DO_WDR_SEMANTIC_CACHE__MAX_ENTRIES";
const ENV_SYNTHESIS_CACHE_ENABLED: &str = "DO_WDR_SYNTHESIS_CACHE__ENABLED";
const ENV_SYNTHESIS_CACHE_TTL: &str = "DO_WDR_SYNTHESIS_CACHE__TTL";

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
    /// Cache configuration
    #[serde(default)]
    pub cache: CacheConfig,
    /// Routing configuration
    #[serde(default)]
    pub routing: RoutingConfig,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct RoutingConfig {
    /// Minimum quality of free result to skip paid providers (default: 0.70)
    pub min_free_quality_to_skip_paid: Option<f32>,
    /// Threshold for skipping providers with low win rate (default: 0.20)
    pub provider_skip_win_rate_threshold: Option<f32>,
    /// Exa-specific routing configuration
    #[serde(default)]
    pub exa: ExaRoutingConfig,
}

impl RoutingConfig {
    pub fn min_free_quality_to_skip_paid(&self) -> f32 {
        self.min_free_quality_to_skip_paid
            .unwrap_or_else(default_min_free_quality_to_skip_paid)
    }

    pub fn provider_skip_win_rate_threshold(&self) -> f32 {
        self.provider_skip_win_rate_threshold
            .unwrap_or_else(default_provider_skip_win_rate_threshold)
    }
}

fn default_min_free_quality_to_skip_paid() -> f32 {
    0.70
}

fn default_provider_skip_win_rate_threshold() -> f32 {
    0.20
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExaRoutingConfig {
    /// Monthly free quota for Exa MCP (default: 1000)
    #[serde(default = "default_exa_monthly_free_quota")]
    pub monthly_free_quota: usize,
    /// Threshold to warn or guard budget (default: 0.80)
    #[serde(default = "default_exa_budget_warn_threshold")]
    pub budget_warn_threshold: f32,
    /// Day of month when quota resets (default: 1)
    #[serde(default = "default_exa_reset_day")]
    pub reset_day: u8,
}

impl Default for ExaRoutingConfig {
    fn default() -> Self {
        Self {
            monthly_free_quota: default_exa_monthly_free_quota(),
            budget_warn_threshold: default_exa_budget_warn_threshold(),
            reset_day: default_exa_reset_day(),
        }
    }
}

fn default_exa_monthly_free_quota() -> usize {
    1000
}

fn default_exa_budget_warn_threshold() -> f32 {
    0.80
}

fn default_exa_reset_day() -> u8 {
    1
}

/// Aggregated cache configuration
#[derive(Debug, Clone, Deserialize, Default)]
pub struct CacheConfig {
    /// Provider result TTL configuration
    #[serde(default)]
    pub ttl: CacheTtlConfig,
    /// Synthesis cache configuration
    #[serde(default)]
    pub synthesis: SynthesisCacheConfig,
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

impl CacheTtlConfig {
    pub fn get(&self, provider: &str) -> u64 {
        match provider {
            "firecrawl" => self.firecrawl,
            "exa" | "exa_mcp" => self.exa,
            "tavily" => self.tavily,
            "serper" => self.serper,
            "jina" => self.jina,
            "mistral" | "mistral_browser" | "mistral_websearch" => self.mistral,
            "duckduckgo" => self.duckduckgo,
            "llms_txt" => self.llms_txt,
            "synthesis" => self.synthesis,
            _ => self.default,
        }
    }

    fn merge_non_defaults(&mut self, other: &Self) {
        for (target, incoming, default) in [
            (
                &mut self.firecrawl,
                other.firecrawl,
                default_ttl_firecrawl(),
            ),
            (&mut self.exa, other.exa, default_ttl_exa()),
            (&mut self.tavily, other.tavily, default_ttl_tavily()),
            (&mut self.serper, other.serper, default_ttl_serper()),
            (&mut self.jina, other.jina, default_ttl_jina()),
            (&mut self.mistral, other.mistral, default_ttl_mistral()),
            (
                &mut self.duckduckgo,
                other.duckduckgo,
                default_ttl_duckduckgo(),
            ),
            (&mut self.llms_txt, other.llms_txt, default_ttl_llms_txt()),
            (
                &mut self.synthesis,
                other.synthesis,
                default_ttl_synthesis(),
            ),
            (&mut self.default, other.default, default_ttl_default()),
        ] {
            if incoming != default {
                *target = incoming;
            }
        }
    }

    fn apply_env_overrides_from<F>(&mut self, env_lookup: &F)
    where
        F: Fn(&str) -> Option<String>,
    {
        for (target, name) in [
            (&mut self.firecrawl, ENV_CACHE_TTL_FIRECRAWL),
            (&mut self.exa, ENV_CACHE_TTL_EXA),
            (&mut self.tavily, ENV_CACHE_TTL_TAVILY),
            (&mut self.serper, ENV_CACHE_TTL_SERPER),
            (&mut self.jina, ENV_CACHE_TTL_JINA),
            (&mut self.mistral, ENV_CACHE_TTL_MISTRAL),
            (&mut self.duckduckgo, ENV_CACHE_TTL_DUCKDUCKGO),
            (&mut self.llms_txt, ENV_CACHE_TTL_LLMS_TXT),
            (&mut self.synthesis, ENV_CACHE_TTL_SYNTHESIS),
            (&mut self.default, ENV_CACHE_TTL_DEFAULT),
        ] {
            if let Some(v) = env_parse_from(env_lookup, name) {
                *target = v;
            }
        }
    }
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
    default_ttl_synthesis()
}

impl Default for SynthesisCacheConfig {
    fn default() -> Self {
        Self {
            enabled: default_synthesis_cache_enabled(),
            ttl: default_synthesis_cache_ttl(),
        }
    }
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

fn env_value(name: &str) -> Option<String> {
    env::var(name).ok()
}

fn env_parse<T>(name: &str) -> Option<T>
where
    T: FromStr,
{
    env_value(name).and_then(|value| value.parse().ok())
}

fn env_parse_from<T, F>(env_lookup: &F, name: &str) -> Option<T>
where
    T: FromStr,
    F: Fn(&str) -> Option<String>,
{
    env_lookup(name).and_then(|value| value.parse().ok())
}

fn split_env_list(value: String) -> Vec<String> {
    value.split(',').map(|s| s.trim().to_string()).collect()
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
            negative_cache_ttl_secs: default_negative_cache_ttl(),
            error_cache_ttl_secs: default_error_cache_ttl(),
            circuit_breaker_threshold: default_circuit_breaker_threshold(),
            circuit_breaker_cooldown_secs: default_circuit_breaker_cooldown(),
            max_links: default_max_links(),
            cache: CacheConfig::default(),
            routing: RoutingConfig::default(),
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
        self.merge_core(&other);
        self.merge_cache(&other);
        self.merge_routing(&other);
        self.merge_profile(&other);
    }

    fn merge_core(&mut self, other: &Config) {
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
            self.log_level.clone_from(&other.log_level);
        }
        if !other.skip_providers.is_empty() {
            self.skip_providers.clone_from(&other.skip_providers);
        }
        if !other.providers_order.is_empty() {
            self.providers_order.clone_from(&other.providers_order);
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
    }

    fn merge_cache(&mut self, other: &Config) {
        self.cache.ttl.merge_non_defaults(&other.cache.ttl);
        if other.cache.synthesis.enabled != default_synthesis_cache_enabled() {
            self.cache.synthesis.enabled = other.cache.synthesis.enabled;
        }
        if other.cache.synthesis.ttl != default_synthesis_cache_ttl() {
            self.cache.synthesis.ttl = other.cache.synthesis.ttl;
        }
    }

    fn merge_routing(&mut self, other: &Config) {
        if other.routing.min_free_quality_to_skip_paid.is_some() {
            self.routing.min_free_quality_to_skip_paid =
                other.routing.min_free_quality_to_skip_paid;
        }
        if other.routing.provider_skip_win_rate_threshold.is_some() {
            self.routing.provider_skip_win_rate_threshold =
                other.routing.provider_skip_win_rate_threshold;
        }
        if other.routing.exa.monthly_free_quota != default_exa_monthly_free_quota() {
            self.routing.exa.monthly_free_quota = other.routing.exa.monthly_free_quota;
        }
        if (other.routing.exa.budget_warn_threshold - default_exa_budget_warn_threshold()).abs()
            > f32::EPSILON
        {
            self.routing.exa.budget_warn_threshold = other.routing.exa.budget_warn_threshold;
        }
        if other.routing.exa.reset_day != default_exa_reset_day() {
            self.routing.exa.reset_day = other.routing.exa.reset_day;
        }
    }

    fn merge_profile(&mut self, other: &Config) {
        if other.profile != Profile::Balanced {
            self.profile = other.profile;
        }
        if other.quality_threshold.is_some() {
            self.quality_threshold = other.quality_threshold;
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
    }

    fn apply_file_overrides(&mut self) {
        if let Some(config_path) = env_value(ENV_CONFIG) {
            if let Ok(file_config) = Config::from_file(&config_path) {
                self.merge(file_config);
            }
        } else {
            for path in ["./config.toml", "./do-wdr.toml", "./do-wdr.conf"] {
                if let Ok(file_config) = Config::from_file(path) {
                    self.merge(file_config);
                    break;
                }
            }
        }
    }

    fn apply_basic_env_overrides(&mut self) {
        if let Some(v) = env_parse(ENV_MAX_CHARS) {
            self.max_chars = v;
        }
        if let Some(v) = env_parse(ENV_MIN_CHARS) {
            self.min_chars = v;
        }
        if let Some(v) = env_parse(ENV_EXA_RESULTS) {
            self.exa_results = v;
        }
        if let Some(v) = env_parse(ENV_TAVILY_RESULTS) {
            self.tavily_results = v;
        }
        if let Some(v) = env_parse(ENV_OUTPUT_LIMIT) {
            self.output_limit = v;
        }
        if let Some(val) = env_value(ENV_LOG_LEVEL) {
            self.log_level = val;
        }
        if let Some(val) = env_value(ENV_SKIP_PROVIDERS) {
            self.skip_providers = split_env_list(val);
        }
        if let Some(val) = env_value(ENV_PROVIDERS_ORDER) {
            self.providers_order = split_env_list(val);
        }
        if let Some(p) = env_parse(ENV_PROFILE) {
            self.profile = p;
        }
        if let Some(v) = env_parse(ENV_QUALITY_THRESHOLD) {
            self.quality_threshold = Some(v);
        }
        if let Some(v) = env_parse(ENV_MAX_PROVIDER_ATTEMPTS) {
            self.max_provider_attempts = Some(v);
        }
        if let Some(v) = env_parse(ENV_MAX_PAID_ATTEMPTS) {
            self.max_paid_attempts = Some(v);
        }
        if let Some(v) = env_parse(ENV_MAX_TOTAL_LATENCY_MS) {
            self.max_total_latency_ms = Some(v);
        }
        if let Some(v) = env_parse(ENV_DISABLE_ROUTING_MEMORY) {
            self.disable_routing_memory = v;
        }
    }

    fn apply_cache_env_overrides_from<F>(&mut self, env_lookup: &F)
    where
        F: Fn(&str) -> Option<String>,
    {
        self.cache.ttl.apply_env_overrides_from(env_lookup);
        if let Some(v) = env_parse_from(env_lookup, ENV_SYNTHESIS_CACHE_ENABLED) {
            self.cache.synthesis.enabled = v;
        }
        if let Some(v) = env_parse_from(env_lookup, ENV_SYNTHESIS_CACHE_TTL) {
            self.cache.synthesis.ttl = v;
        }
    }

    fn apply_cache_env_overrides(&mut self) {
        self.apply_cache_env_overrides_from(&env_value);
    }

    fn apply_routing_env_overrides(&mut self) {
        if let Some(v) = env_parse(ENV_MIN_FREE_QUALITY) {
            self.routing.min_free_quality_to_skip_paid = Some(v);
        }
        if let Some(v) = env_parse(ENV_SKIP_WIN_RATE) {
            self.routing.provider_skip_win_rate_threshold = Some(v);
        }
        if let Some(v) = env_parse(ENV_EXA_QUOTA) {
            self.routing.exa.monthly_free_quota = v;
        }
        if let Some(v) = env_parse(ENV_EXA_BUDGET_WARN) {
            self.routing.exa.budget_warn_threshold = v;
        }
        if let Some(v) = env_parse(ENV_EXA_RESET_DAY) {
            self.routing.exa.reset_day = v;
        }
    }

    fn apply_semantic_cache_env_overrides(&mut self) {
        if let Some(v) = env_parse(ENV_SEMANTIC_CACHE_ENABLED) {
            self.semantic_cache.enabled = v;
        }
        if let Some(val) = env_value(ENV_SEMANTIC_CACHE_PATH) {
            self.semantic_cache.path = val;
        }
        if let Some(v) = env_parse(ENV_SEMANTIC_CACHE_THRESHOLD) {
            self.semantic_cache.threshold = v;
        }
        if let Some(v) = env_parse(ENV_SEMANTIC_CACHE_MAX_ENTRIES) {
            self.semantic_cache.max_entries = v;
        }
    }

    fn apply_env_overrides(&mut self) {
        self.apply_basic_env_overrides();
        self.apply_cache_env_overrides();
        self.apply_routing_env_overrides();
        self.apply_semantic_cache_env_overrides();
    }

    /// Load configuration with environment variable overrides
    pub fn load() -> Self {
        let mut config = Config::default();
        config.apply_file_overrides();
        config.apply_env_overrides();
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
        self.cache.ttl.get(provider)
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

    #[test]
    fn test_env_overrides_cache_ttl() {
        let mut config = Config::default();
        config.cache.ttl.apply_env_overrides_from(&|name| {
            (name == ENV_CACHE_TTL_FIRECRAWL).then(|| "123".to_string())
        });

        assert_eq!(config.get_ttl("firecrawl"), 123);
    }
}
