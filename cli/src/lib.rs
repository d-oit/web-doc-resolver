//! Web Documentation Resolver Library
//!
//! A library for resolving queries or URLs into compact, LLM-ready markdown
//! using a low-cost provider cascade.

pub mod bias_scorer;
pub mod cli;
pub mod compaction;
pub mod config;
pub mod error;
pub mod link_validator;
pub mod metrics;
pub mod output;
pub mod providers;
pub mod resolver;
pub mod semantic_cache;
pub mod synthesis;
pub mod types;

pub use cli::{Cli, Commands};
pub use config::Config;
pub use error::ResolverError;
pub use metrics::{ProviderMetric, ResolveMetrics};
pub use output::{CacheStatsOutput, ConfigOutput, JsonOutput, ProviderList, TextOutput};
pub use resolver::Resolver;
pub use semantic_cache::{CacheStats, SemanticCache, SemanticCacheConfig};
pub use types::{ProviderType, ResolvedResult};
