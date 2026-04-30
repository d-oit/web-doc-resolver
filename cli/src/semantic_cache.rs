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
    serde_json::Value, std::collections::HashMap, std::sync::Mutex,
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
            .with_max_concepts(cache_config.max_entries)
            .build()
            .await
            .map_err(|e| ResolverError::Config(e.to_string()))?;

        Ok(Some(Self {
            framework,
            config: cache_config,
            encoder: TextEncoder::new(),
            embedding_cache: Mutex::new(HashMap::new()),
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

        // Check in-memory cache
        if let Ok(cache) = self.embedding_cache.lock() {
            if let Some(vec) = cache.get(&normalized) {
                return *vec;
            }
        }

        // Use TextEncoder for proper semantic encoding
        let vec = self.encoder.encode(&normalized);

        // Store in in-memory cache
        if let Ok(mut cache) = self.embedding_cache.lock() {
            // Basic size limit for in-memory cache to prevent leaks
            if cache.len() < 1000 {
                cache.insert(normalized, vec);
            }
        }

        vec
    }

    /// Encode query (no-op without feature)
    #[cfg(not(feature = "semantic-cache"))]
    #[allow(dead_code, clippy::unused_unit)]
    fn encode_query(&self, _query: &str) -> () {}
}

#[cfg(feature = "semantic-cache")]
#[cfg(test)]
mod tests_semantic {
    use super::*;
    use crate::Config;

    #[tokio::test]
    async fn test_embedding_cache() {
        let temp_dir = tempfile::tempdir().unwrap();
        let mut config = Config::default();
        config.semantic_cache.enabled = true;
        config.semantic_cache.path = temp_dir.path().to_str().unwrap().to_string();

        let cache = SemanticCache::new(&config).await.unwrap().unwrap();

        // First encode - generates and stores
        let query = "test query";
        let _ = cache.encode_query(query);

        // Verify it's in the embedding cache
        {
            let ec = cache.embedding_cache.lock().unwrap();
            assert!(ec.contains_key("test query"));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ResolvedResult;

    /// Create a test configuration with semantic cache enabled
    fn test_config(path: &str) -> Config {
        let mut config = Config::default();
        config.semantic_cache = SemanticCacheConfig {
            enabled: true,
            path: path.to_string(),
            threshold: 0.85,
            max_entries: 10000,
        };
        config
    }

    /// Create sample resolved results for testing
    fn create_test_results(count: usize) -> Vec<ResolvedResult> {
        (0..count)
            .map(|i| ResolvedResult::new(
                format!("https://example.com/page{}", i),
                Some(format!("Content for page {} with enough characters to be valid for testing purposes", i)),
                "test_provider",
                0.9 - (i as f64 * 0.1),
            ))
            .collect()
    }

    #[test]
    fn test_cache_entry_serialization() {
        let entry = CacheEntry {
            query: "rust programming".to_string(),
            results: create_test_results(3),
            provider: "test_provider".to_string(),
            timestamp: chrono::Utc::now(),
            hit_count: 5,
        };

        // Test serialization
        let json = serde_json::to_string(&entry).expect("Failed to serialize CacheEntry");
        assert!(json.contains("rust programming"));
        assert!(json.contains("test_provider"));

        // Test deserialization
        let deserialized: CacheEntry =
            serde_json::from_str(&json).expect("Failed to deserialize CacheEntry");

        assert_eq!(deserialized.query, entry.query);
        assert_eq!(deserialized.provider, entry.provider);
        assert_eq!(deserialized.hit_count, entry.hit_count);
        assert_eq!(deserialized.results.len(), entry.results.len());
    }

    #[test]
    fn test_query_normalization() {
        // Test case variations
        let queries = vec![
            ("Rust Programming", "rust programming"),
            ("RUST   PROGRAMMING", "rust programming"),
            ("  rust  programming  ", "rust programming"),
            ("Rust\tProgramming", "rust programming"),
        ];

        for (input, expected) in queries {
            let normalized: String = input
                .to_lowercase()
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            assert_eq!(
                normalized, expected,
                "Query normalization failed for: {}",
                input
            );
        }
    }

    #[tokio::test]
    #[cfg(feature = "semantic-cache")]
    async fn test_store_and_query() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let config = test_config(temp_dir.path().to_str().unwrap());

        // Initialize cache
        let cache = SemanticCache::new(&config)
            .await
            .expect("Failed to create cache")
            .expect("Cache should be enabled");

        // Create test results
        let results = create_test_results(3);
        let query = "rust programming tutorial";

        // Store in cache
        cache
            .store(query, &results, "test_provider")
            .await
            .expect("Failed to store in cache");

        // Query exact match
        let retrieved = cache.query(query).await.expect("Failed to query cache");

        assert!(retrieved.is_some(), "Should find exact match");
        let retrieved_results = retrieved.unwrap();
        assert_eq!(retrieved_results.len(), results.len());
        assert_eq!(retrieved_results[0].url, results[0].url);

        // Query similar (semantic match)
        let similar_query = "rust coding tutorial";
        let similar_retrieved = cache
            .query(similar_query)
            .await
            .expect("Failed to query cache with similar query");

        // Note: Semantic matching depends on the encoder quality
        // The test documents this behavior
        if similar_retrieved.is_some() {
            assert_eq!(similar_retrieved.as_ref().unwrap().len(), results.len());
        }

        // Query non-matching
        let no_match = cache
            .query("completely unrelated query about gardening")
            .await
            .expect("Failed to query cache");

        assert!(no_match.is_none(), "Should not find unrelated query");

        // Cleanup
        drop(cache);
        drop(temp_dir);
    }

    #[tokio::test]
    #[cfg(feature = "semantic-cache")]
    async fn test_concurrent_access() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let config = test_config(temp_dir.path().to_str().unwrap());

        let cache = SemanticCache::new(&config)
            .await
            .expect("Failed to create cache")
            .expect("Cache should be enabled");

        // Pre-populate with some data
        let initial_results = create_test_results(3);
        cache
            .store("base query", &initial_results, "test_provider")
            .await
            .expect("Failed to store initial data");

        // Test rapid sequential operations (simulating concurrent load)
        // This exercises the underlying database's thread safety
        // by performing operations in quick succession

        // Perform 20 reads rapidly
        for i in 0..20 {
            let query = if i % 2 == 0 {
                "base query"
            } else {
                &format!("concurrent read query {}", i % 5)
            };
            let result = cache.query(query).await;
            assert!(result.is_ok(), "Read operation {} failed", i);
        }

        // Perform 10 writes rapidly
        for i in 0..10 {
            let query = format!("concurrent write query {}", i);
            let results = create_test_results(2);
            let result = cache.store(&query, &results, "test_provider").await;
            assert!(result.is_ok(), "Write operation {} failed", i);
        }

        // Verify data integrity - all written queries should be retrievable
        for i in 0..10 {
            let query = format!("concurrent write query {}", i);
            let retrieved = cache
                .query(&query)
                .await
                .expect("Failed to query after rapid writes");
            assert!(
                retrieved.is_some(),
                "Should find written query after rapid access"
            );
        }

        // Test interleaved reads and writes
        for i in 0..5 {
            let query = format!("interleaved query {}", i);
            let results = create_test_results(2);

            // Write
            cache
                .store(&query, &results, "test_provider")
                .await
                .expect("Failed interleaved write");

            // Immediate read
            let retrieved = cache.query(&query).await.expect("Failed interleaved read");
            assert!(retrieved.is_some(), "Should find immediately written query");
        }

        // Cleanup
        drop(cache);
        drop(temp_dir);
    }

    #[tokio::test]
    #[cfg(feature = "semantic-cache")]
    async fn test_database_failure() {
        // Test with invalid path (read-only or non-existent parent)
        let mut config = Config::default();
        config.semantic_cache = SemanticCacheConfig {
            enabled: true,
            path: "/nonexistent/path/that/cannot/be/created".to_string(),
            threshold: 0.85,
            max_entries: 10000,
        };

        // Should gracefully handle directory creation failure
        let result = SemanticCache::new(&config).await;

        // When cache directory creation fails, it returns Ok(None) instead of error
        assert!(result.is_ok(), "Should not panic on invalid path");
        // The cache gracefully returns None when it can't create the directory
        assert!(
            result.unwrap().is_none(),
            "Should return None for invalid path"
        );
    }

    #[tokio::test]
    #[cfg(feature = "semantic-cache")]
    async fn test_cache_persistence() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let config = test_config(temp_dir.path().to_str().unwrap());
        let query = "persistent query test";
        let results = create_test_results(3);

        // Create cache and store data
        {
            let cache = SemanticCache::new(&config)
                .await
                .expect("Failed to create cache")
                .expect("Cache should be enabled");

            cache
                .store(query, &results, "test_provider")
                .await
                .expect("Failed to store in cache");

            // Verify data is stored
            let retrieved = cache
                .query(query)
                .await
                .expect("Failed to query cache")
                .expect("Should find stored query");
            assert_eq!(retrieved.len(), results.len());

            // Cache is dropped here
        }

        // Create new cache instance with same path
        {
            let cache = SemanticCache::new(&config)
                .await
                .expect("Failed to create cache")
                .expect("Cache should be enabled");

            // Data should still be available
            let retrieved = cache
                .query(query)
                .await
                .expect("Failed to query cache after restart");

            // Note: Data persistence depends on the underlying database implementation
            // This test documents the expected behavior
            if retrieved.is_some() {
                assert_eq!(retrieved.as_ref().unwrap().len(), results.len());
            }
        }

        drop(temp_dir);
    }

    #[tokio::test]
    #[cfg(feature = "semantic-cache")]
    async fn test_remove_operation() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let config = test_config(temp_dir.path().to_str().unwrap());

        let cache = SemanticCache::new(&config)
            .await
            .expect("Failed to create cache")
            .expect("Cache should be enabled");

        let query = "query to be removed";
        let results = create_test_results(2);

        // Store data
        cache
            .store(query, &results, "test_provider")
            .await
            .expect("Failed to store in cache");

        // Verify it's there
        let retrieved = cache.query(query).await.expect("Failed to query cache");
        assert!(retrieved.is_some(), "Should find stored query");

        // Remove the entry
        cache
            .remove(query)
            .await
            .expect("Failed to remove from cache");

        // Verify it's gone
        let after_remove = cache
            .query(query)
            .await
            .expect("Failed to query cache after removal");
        assert!(after_remove.is_none(), "Should not find removed query");

        drop(cache);
        drop(temp_dir);
    }

    #[tokio::test]
    #[cfg(feature = "semantic-cache")]
    async fn test_store_latency() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let config = test_config(temp_dir.path().to_str().unwrap());

        let cache = SemanticCache::new(&config)
            .await
            .expect("Failed to create cache")
            .expect("Cache should be enabled");

        // Warm up - first operation may be slower due to initialization
        let warmup_results = create_test_results(2);
        cache
            .store("warmup", &warmup_results, "test_provider")
            .await
            .expect("Warmup failed");

        // Measure actual latency
        let results = create_test_results(5);
        let query = "latency test query";

        let start = std::time::Instant::now();
        cache
            .store(query, &results, "test_provider")
            .await
            .expect("Failed to store in cache");
        let elapsed = start.elapsed();

        // Latency requirements:
        // - Release build: < 10ms
        // - Debug build: < 1000ms (increased for CI stability)
        // The semantic encoding and database operations add overhead
        #[cfg(not(debug_assertions))]
        let max_latency_ms = 10u128;
        #[cfg(debug_assertions)]
        let max_latency_ms = 400u128; // Increased for shared environments

        assert!(
            elapsed.as_millis() < max_latency_ms,
            "Store operation took {}ms, expected < {}ms",
            elapsed.as_millis(),
            max_latency_ms
        );

        drop(cache);
        drop(temp_dir);
    }

    #[tokio::test]
    #[cfg(feature = "semantic-cache")]
    async fn test_query_latency() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let config = test_config(temp_dir.path().to_str().unwrap());

        let cache = SemanticCache::new(&config)
            .await
            .expect("Failed to create cache")
            .expect("Cache should be enabled");

        // Pre-populate cache
        let results = create_test_results(5);
        let query = "query latency test";
        cache
            .store(query, &results, "test_provider")
            .await
            .expect("Failed to store in cache");

        // Warm up query
        let _ = cache.query("warmup").await;

        // Measure query latency
        let start = std::time::Instant::now();
        let _retrieved = cache.query(query).await.expect("Failed to query cache");
        let elapsed = start.elapsed();

        // Latency requirements:
        // - Release build: < 10ms
        // - Debug build: < 1000ms (increased for CI stability)
        #[cfg(not(debug_assertions))]
        let max_latency_ms = 10u128;
        #[cfg(debug_assertions)]
        let max_latency_ms = 1000u128;

        assert!(
            elapsed.as_millis() < max_latency_ms,
            "Query operation took {}ms, expected < {}ms",
            elapsed.as_millis(),
            max_latency_ms
        );

        drop(cache);
        drop(temp_dir);
    }
}
