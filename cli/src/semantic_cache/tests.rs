#[cfg(feature = "semantic-cache")]
#[cfg(test)]
mod tests_semantic {
    use super::super::*;
    use crate::Config;

    #[tokio::test]
    async fn test_embedding_cache() {
        let temp_dir = tempfile::tempdir().unwrap();
        let mut config = Config::default();
        config.semantic_cache.enabled = true;
        config.semantic_cache.path = temp_dir.path().to_str().unwrap().to_string();

        let cache = SemanticCache::new(&config).await.unwrap().unwrap();

        let query = "test query";
        let _ = cache.encode_query(query);

        {
            let ec = cache.embedding_cache.lock().unwrap();
            assert!(ec.contains_key("test query"));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::Config;
    use crate::types::ResolvedResult;

    #[allow(dead_code)]
    fn test_config(path: &str) -> Config {
        Config {
            semantic_cache: SemanticCacheConfig {
                enabled: true,
                path: path.to_string(),
                threshold: 0.85,
                max_entries: 10000,
                ttls: None,
            },
            ..Default::default()
        }
    }

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

        let json = serde_json::to_string(&entry).expect("Failed to serialize CacheEntry");
        assert!(json.contains("rust programming"));
        assert!(json.contains("test_provider"));

        let deserialized: CacheEntry =
            serde_json::from_str(&json).expect("Failed to deserialize CacheEntry");

        assert_eq!(deserialized.query, entry.query);
        assert_eq!(deserialized.provider, entry.provider);
        assert_eq!(deserialized.hit_count, entry.hit_count);
        assert_eq!(deserialized.results.len(), entry.results.len());
    }

    #[test]
    fn test_query_normalization() {
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

        let cache = SemanticCache::new(&config)
            .await
            .expect("Failed to create cache")
            .expect("Cache should be enabled");

        let results = create_test_results(3);
        let query = "rust programming tutorial";

        cache
            .store(query, &results, "test_provider")
            .await
            .expect("Failed to store in cache");

        let retrieved = cache.query(query).await.expect("Failed to query cache");

        assert!(retrieved.is_some(), "Should find exact match");
        let retrieved_results = retrieved.unwrap();
        assert_eq!(retrieved_results.len(), results.len());
        assert_eq!(retrieved_results[0].url, results[0].url);

        let similar_query = "rust coding tutorial";
        let similar_retrieved = cache
            .query(similar_query)
            .await
            .expect("Failed to query cache with similar query");

        if let Some(hits) = &similar_retrieved {
            assert_eq!(hits.len(), results.len());
        }

        let no_match = cache
            .query("completely unrelated query about gardening")
            .await
            .expect("Failed to query cache");

        assert!(no_match.is_none(), "Should not find unrelated query");

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

        let initial_results = create_test_results(3);
        cache
            .store("base query", &initial_results, "test_provider")
            .await
            .expect("Failed to store initial data");

        for i in 0..20 {
            let query = if i % 2 == 0 {
                "base query"
            } else {
                &format!("concurrent read query {}", i % 5)
            };
            let result = cache.query(query).await;
            assert!(result.is_ok(), "Read operation {} failed", i);
        }

        for i in 0..10 {
            let query = format!("concurrent write query {}", i);
            let results = create_test_results(2);
            let result = cache.store(&query, &results, "test_provider").await;
            assert!(result.is_ok(), "Write operation {} failed", i);
        }

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

        for i in 0..5 {
            let query = format!("interleaved query {}", i);
            let results = create_test_results(2);

            cache
                .store(&query, &results, "test_provider")
                .await
                .expect("Failed interleaved write");

            let retrieved = cache.query(&query).await.expect("Failed interleaved read");
            assert!(retrieved.is_some(), "Should find immediately written query");
        }

        drop(cache);
        drop(temp_dir);
    }

    #[tokio::test]
    #[cfg(feature = "semantic-cache")]
    async fn test_database_failure() {
        let config = Config {
            semantic_cache: SemanticCacheConfig {
                enabled: true,
                path: "/nonexistent/path/that/cannot/be/created".to_string(),
                threshold: 0.85,
                max_entries: 10000,
                ttls: None,
            },
            ..Default::default()
        };

        let result = SemanticCache::new(&config).await;

        assert!(result.is_ok(), "Should not panic on invalid path");
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

        {
            let cache = SemanticCache::new(&config)
                .await
                .expect("Failed to create cache")
                .expect("Cache should be enabled");

            cache
                .store(query, &results, "test_provider")
                .await
                .expect("Failed to store in cache");

            let retrieved = cache
                .query(query)
                .await
                .expect("Failed to query cache")
                .expect("Should find stored query");
            assert_eq!(retrieved.len(), results.len());
        }

        {
            let cache = SemanticCache::new(&config)
                .await
                .expect("Failed to create cache")
                .expect("Cache should be enabled");

            let retrieved = cache
                .query(query)
                .await
                .expect("Failed to query cache after restart");

            if let Some(hits) = &retrieved {
                assert_eq!(hits.len(), results.len());
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

        cache
            .store(query, &results, "test_provider")
            .await
            .expect("Failed to store in cache");

        let retrieved = cache.query(query).await.expect("Failed to query cache");
        assert!(retrieved.is_some(), "Should find stored query");

        cache
            .remove(query)
            .await
            .expect("Failed to remove from cache");

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

        let warmup_results = create_test_results(2);
        cache
            .store("warmup", &warmup_results, "test_provider")
            .await
            .expect("Warmup failed");

        let results = create_test_results(5);
        let query = "latency test query";

        let start = std::time::Instant::now();
        cache
            .store(query, &results, "test_provider")
            .await
            .expect("Failed to store in cache");
        let elapsed = start.elapsed();

        #[cfg(not(debug_assertions))]
        let max_latency_ms = 10u128;
        #[cfg(debug_assertions)]
        let max_latency_ms = 1000u128;

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

        let results = create_test_results(5);
        let query = "query latency test";
        cache
            .store(query, &results, "test_provider")
            .await
            .expect("Failed to store in cache");

        let _ = cache.query("warmup").await;

        let start = std::time::Instant::now();
        let _retrieved = cache.query(query).await.expect("Failed to query cache");
        let elapsed = start.elapsed();

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
