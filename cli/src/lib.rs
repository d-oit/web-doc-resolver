//! Web Documentation Resolver Library
//!
//! A library for resolving queries or URLs into compact, LLM-ready markdown
//! using a low-cost provider cascade.

pub mod cli;
pub mod config;
pub mod error;
pub mod output;
pub mod providers;
pub mod resolver;
pub mod semantic_cache;
pub mod types;

pub use cli::{Cli, Commands};
pub use config::Config;
pub use error::ResolverError;
pub use output::{CacheStatsOutput, ConfigOutput, JsonOutput, ProviderList, TextOutput};
pub use resolver::Resolver;
pub use semantic_cache::{CacheStats, SemanticCache, SemanticCacheConfig};
pub use types::{ProviderType, ResolvedResult};
