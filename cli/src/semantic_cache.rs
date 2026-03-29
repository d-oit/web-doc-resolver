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

use crate::ResolverError;
use crate::config::Config;
use crate::types::ResolvedResult;

#[cfg(feature = "semantic-cache")]
use {
    chaotic_semantic_memory::encoder::TextEncoder, chaotic_semantic_memory::prelude::*,
    serde_json::Value, std::collections::HashMap,
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
    encoder: TextEncoder,
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
}

impl Default for SemanticCacheConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            path: ".do-wdr_cache".to_string(),
            threshold: 0.85,
            max_entries: 10000,
        }
    }
}

impl SemanticCache {
    /// Initialize semantic cache from config (async)
    #[cfg(feature = "semantic-cache")]
    pub async fn new(config: &Config) -> StdResult<Option<Self>, ResolverError> {
        if !config.semantic_cache.enabled {
            tracing::debug!("Semantic cache disabled");
            return Ok(None);
        }

        let cache_config = config.semantic_cache.clone();

        tracing::info!(
            "Initializing semantic cache at '{}' with threshold {}",
            cache_config.path,
            cache_config.threshold
        );

        // Create parent directory if needed
        if let Err(e) = std::fs::create_dir_all(&cache_config.path) {
            tracing::warn!("Failed to create cache directory: {}", e);
            return Ok(None);
        }

        let db_path = std::path::Path::new(&cache_config.path).join("semantic.db");

        let framework = ChaoticSemanticFramework::builder()
            .with_local_db(db_path.to_str().unwrap_or("memory.db"))
            .build()
            .await
            .map_err(|e| ResolverError::Config(e.to_string()))?;

        Ok(Some(Self {
            framework,
            config: cache_config,
            encoder: TextEncoder::new(),
        }))
    }

    /// Initialize semantic cache (no-op without feature)
    #[cfg(not(feature = "semantic-cache"))]
    pub fn new(_config: &Config) -> Result<Option<Self>, ResolverError> {
        Ok(None)
    }

    /// Query the cache for similar results
    #[cfg(feature = "semantic-cache")]
    pub async fn query(
        &self,
        query: &str,
    ) -> StdResult<Option<Vec<ResolvedResult>>, ResolverError> {
        // Generate query vector
        let query_vector = self.encode_query(query);

        // Probe semantic memory - returns (id, score) pairs
        let hits = self
            .framework
            .probe(query_vector, 5)
            .await
            .map_err(|e| ResolverError::Cache(format!("probe failed: {}", e)))?;

        if hits.is_empty() {
            tracing::debug!("Semantic cache miss for query='{}'", query);
            return Ok(None);
        }

        // Check best hit against threshold
        let (best_id, best_score) = &hits[0];

        if *best_score >= self.config.threshold {
            tracing::info!(
                "Semantic cache HIT for query='{}' (score: {:.2}, id: {})",
                query,
                best_score,
                best_id
            );

            // Retrieve full concept with metadata
            if let Some(concept) = self
                .framework
                .get_concept(best_id)
                .await
                .map_err(|e| ResolverError::Cache(format!("get_concept failed: {}", e)))?
            {
                if let Some(results_value) = concept.metadata.get("results") {
                    if let Ok(results) =
                        serde_json::from_value::<Vec<ResolvedResult>>(results_value.clone())
                    {
                        return Ok(Some(results));
                    }
                }
            }
        }

        tracing::debug!(
            "Semantic cache miss for query='{}' (best score: {:.2} < {})",
            query,
            best_score,
            self.config.threshold
        );
        Ok(None)
    }

    /// Query the cache (no-op without feature)
    #[cfg(not(feature = "semantic-cache"))]
    #[allow(dead_code)]
    pub async fn query(
        &self,
        _query: &str,
    ) -> StdResult<Option<Vec<ResolvedResult>>, ResolverError> {
        Ok(None)
    }

    /// Store results in the cache
    #[cfg(feature = "semantic-cache")]
    pub async fn store(
        &self,
        query: &str,
        results: &[ResolvedResult],
        provider: &str,
    ) -> StdResult<(), ResolverError> {
        // Generate query vector (normalizes internally)
        let query_vector = self.encode_query(query);

        // Normalize query for consistent ID
        let normalized: String = query
            .to_lowercase()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");

        // Create metadata HashMap
        let mut metadata = HashMap::new();
        metadata.insert("query".to_string(), Value::String(query.to_string()));
        metadata.insert(
            "results".to_string(),
            serde_json::to_value(results)
                .map_err(|e| ResolverError::Cache(format!("serialize results: {}", e)))?,
        );
        metadata.insert("provider".to_string(), Value::String(provider.to_string()));
        metadata.insert(
            "timestamp".to_string(),
            Value::String(chrono::Utc::now().to_rfc3339()),
        );

        self.framework
            .inject_concept_with_metadata(normalized.clone(), query_vector, metadata)
            .await
            .map_err(|e| ResolverError::Cache(format!("inject failed: {}", e)))?;

        tracing::info!(
            "Stored result in semantic cache: provider={}, query='{}'",
            provider,
            query
        );
        Ok(())
    }

    /// Store results (no-op without feature)
    #[cfg(not(feature = "semantic-cache"))]
    #[allow(dead_code)]
    pub async fn store(
        &self,
        _query: &str,
        _results: &[ResolvedResult],
        _provider: &str,
    ) -> StdResult<(), ResolverError> {
        Ok(())
    }

    /// Remove a cached entry by query
    #[cfg(feature = "semantic-cache")]
    pub async fn remove(&self, query: &str) -> StdResult<(), ResolverError> {
        // Normalize query to match how it was stored
        let normalized: String = query
            .to_lowercase()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");

        // Use the normalized query as the concept ID
        self.framework
            .delete_concept(&normalized)
            .await
            .map_err(|e| ResolverError::Cache(format!("delete failed: {}", e)))?;

        tracing::info!("Removed from semantic cache: query='{}'", query);
        Ok(())
    }

    /// Remove a cached entry (no-op without feature)
    #[cfg(not(feature = "semantic-cache"))]
    #[allow(dead_code)]
    pub async fn remove(&self, _query: &str) -> StdResult<(), ResolverError> {
        Ok(())
    }

    /// Query the cache for a specific URL (L2 Cache)
    #[cfg(feature = "semantic-cache")]
    pub async fn query_url(&self, url: &str) -> StdResult<Option<ResolvedResult>, ResolverError> {
        self.query(url)
            .await
            .map(|opt| opt.and_then(|vec| vec.into_iter().next()))
    }

    /// Query the cache for a specific provider (L4 Cache)
    #[cfg(feature = "semantic-cache")]
    pub async fn query_provider(
        &self,
        query: &str,
        provider: &str,
    ) -> StdResult<Option<Vec<ResolvedResult>>, ResolverError> {
        let key = format!("{}:{}", provider, query);
        self.query(&key).await
    }

    /// Get cache statistics
    #[cfg(feature = "semantic-cache")]
    pub async fn stats(&self) -> StdResult<CacheStats, ResolverError> {
        // Note: concept_count() not available in current API version
        Ok(CacheStats {
            entries: 0,
            hit_rate: 0.0,
            path: self.config.path.clone(),
        })
    }

    /// Get cache statistics (no-op without feature)
    #[cfg(not(feature = "semantic-cache"))]
    #[allow(dead_code)]
    pub async fn stats(&self) -> StdResult<CacheStats, ResolverError> {
        Ok(CacheStats {
            entries: 0,
            hit_rate: 0.0,
            path: String::new(),
        })
    }

    /// Encode query to semantic vector
    #[cfg(feature = "semantic-cache")]
    fn encode_query(&self, query: &str) -> HVec10240 {
        // Normalize query for better matching: lowercase, trim, collapse whitespace
        let normalized: String = query
            .to_lowercase()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");

        // Use TextEncoder for proper semantic encoding
        self.encoder.encode(&normalized)
    }

    /// Encode query (no-op without feature)
    #[cfg(not(feature = "semantic-cache"))]
    #[allow(dead_code, clippy::unused_unit)]
    fn encode_query(&self, _query: &str) -> () {}
}
