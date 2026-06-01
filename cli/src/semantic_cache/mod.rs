//! Semantic cache module for self-learning query resolution.
//!
//! Uses `chaotic_semantic_memory` crate (which uses Turso/libsql internally)
//! to cache and reuse query results based on semantic similarity.
//!
//! ## Feature Gate
//!
//! Compile with `--features semantic-cache` to enable. Without the feature,
//! all functions are no-ops (zero overhead).
//!
//! ## Usage
//!
//! ```toml
//! [semantic_cache]
//! enabled = true
//! path = ".do-wdr_cache"
//! threshold = 0.85
//! max_entries = 10000
//! ```

use crate::types::ResolvedResult;

#[cfg(feature = "semantic-cache")]
use {
    chaotic_semantic_memory::prelude::*,
    std::collections::HashMap,
    std::sync::Mutex,
};

// Use std::result::Result explicitly to avoid conflict with chaotic_semantic_memory::Result
type StdResult<T, E> = std::result::Result<T, E>;

/// Cache entry stored in semantic memory
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CacheEntry {
    /// Original query text
    pub query: String,
    /// Cached results
    pub results: Vec<ResolvedResult>,
    /// Which provider produced this
    pub provider: String,
    /// When cached
    pub timestamp: chrono::DateTime<chrono::Utc>,
    /// Number of cache hits
    pub hit_count: u32,
}

/// Semantic cache statistics
#[derive(Debug, Clone, serde::Serialize)]
pub struct CacheStats {
    /// Total entries in cache
    pub entries: usize,
    /// Cache hit rate (0.0 - 1.0)
    pub hit_rate: f32,
    /// Storage path
    pub path: String,
}

/// Semantic cache wrapper
pub struct SemanticCache {
    #[cfg(feature = "semantic-cache")]
    framework: ChaoticSemanticFramework,
    #[cfg(feature = "semantic-cache")]
    config: SemanticCacheConfig,
    #[cfg(feature = "semantic-cache")]
    embedding_cache: Mutex<HashMap<String, HVec10240>>,
    /// In-memory cache for non-feature builds
    #[cfg(not(feature = "semantic-cache"))]
    _phantom: std::marker::PhantomData<()>,
}

/// Configuration for semantic cache
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SemanticCacheConfig {
    /// Enable semantic cache
    pub enabled: bool,
    /// Path to cache database
    pub path: String,
    /// Similarity threshold (0.0 - 1.0)
    pub threshold: f32,
    /// Maximum entries
    pub max_entries: usize,
    /// Tiered TTL configuration (injected from Config)
    #[serde(skip)]
    pub ttls: Option<std::collections::HashMap<String, u64>>,
}

impl SemanticCacheConfig {
    pub fn get_ttl(&self, provider: &str) -> u64 {
        if let Some(ttls) = &self.ttls {
            if let Some(ttl) = ttls.get(provider) {
                return *ttl;
            }
            if let Some(ttl) = ttls.get("default") {
                return *ttl;
            }
        }
        match provider {
            "firecrawl" => 21600,
            "exa" | "exa_mcp" => 14400,
            "tavily" => 14400,
            "serper" => 7200,
            "jina" => 7200,
            "mistral" | "mistral_browser" | "mistral_websearch" => 28800,
            "duckduckgo" => 3600,
            "llms_txt" => 28800,
            "synthesis" => 43200,
            _ => 3600,
        }
    }
}

impl Default for SemanticCacheConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            path: ".do-wdr_cache".to_string(),
            threshold: 0.85,
            max_entries: 10000,
            ttls: None,
        }
    }
}

mod ops;
mod synthesis;
#[cfg(test)]
mod tests;
