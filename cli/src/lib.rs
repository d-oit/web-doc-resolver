//! Web Documentation Resolver Library
//!
//! A library for resolving queries or URLs into compact, LLM-ready markdown
//! using a low-cost provider cascade.

pub mod config;
pub mod error;
pub mod providers;
pub mod resolver;
pub mod types;

pub use config::Config;
pub use error::ResolverError;
pub use resolver::Resolver;
pub use types::{ProviderType, ResolvedResult};
