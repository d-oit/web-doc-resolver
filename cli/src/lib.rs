//! Web Documentation Resolver Library
//!
//! A library for resolving queries or URLs into compact, LLM-ready markdown
//! using a low-cost provider cascade.

pub mod bias_scorer;
pub mod circuit_breaker;
pub mod cli;
pub mod compaction;
pub mod config;
pub mod error;
pub mod link_validator;
pub mod metrics;
pub mod negative_cache;
pub mod output;
pub mod providers;
pub mod quality;
pub mod resolver;
pub mod routing;
pub mod routing_memory;
pub mod semantic_cache;
pub mod synthesis;
pub mod types;

pub use cli::{Cli, Commands};
pub use config::Config;
pub use error::ResolverError;
pub use metrics::{ProviderMetric, ResolveMetrics};
pub use output::{CacheStatsOutput, ConfigOutput, JsonOutput, ProviderList, TextOutput};
pub use quality::{QualityScore, score_content};
pub use resolver::Resolver;
pub use routing::{PlannedProvider, ResolutionBudget, plan_provider_order};
pub use semantic_cache::{CacheStats, SemanticCache, SemanticCacheConfig};
pub use types::{ProviderType, ResolvedResult, RoutingDecision};
