//! Integration tests for semantic cache with Turso/libsql persistence.
//!
//! Validates that records are correctly stored, loaded, and removed from the database.

#[cfg(feature = "semantic-cache")]
mod semantic_cache_tests {
    use do_wdr_lib::config::Config;
    use do_wdr_lib::semantic_cache::SemanticCache;
    use do_wdr_lib::types::ResolvedResult;
    use tempfile::TempDir;

    async fn create_test_cache() -> (SemanticCache, TempDir) {
        let temp_dir = tempfile::TempDir::new().expect("Failed to create temp dir");
        let mut config = Config::default();
        config.semantic_cache.enabled = true;
        config.semantic_cache.path = temp_dir.path().to_str().unwrap().to_string();
        config.semantic_cache.threshold = 0.85;

        let cache = SemanticCache::new(&config)
            .await
            .expect("Failed to create cache")
            .expect("Cache was disabled");

        (cache, temp_dir)
    }

    fn create_test_result(source: &str, content: &str) -> Vec<ResolvedResult> {
        vec![ResolvedResult::new(
            "https://example.com",
            Some(content.to_string()),
            source,
            1.0,
        )]
    }

    #[tokio::test]
    async fn test_store_and_load() {
        let (cache, _temp_dir) = create_test_cache().await;

        // Store a result
        let query = "tokio async runtime";
        let results = create_test_result("test_provider", "Test content about Tokio async runtime");
        cache
            .store(query, &results, "test_provider", None)
            .await
            .expect("Failed to store");

        // Query should hit
        let loaded = cache.query(query, None).await.expect("Failed to query");
        assert!(loaded.is_some(), "Expected cache hit for stored query");

        let loaded_results = loaded.unwrap();
        assert_eq!(loaded_results.len(), 1);
        assert_eq!(loaded_results[0].source, "test_provider");
        assert_eq!(
            loaded_results[0].content,
            Some("Test content about Tokio async runtime".to_string())
        );
    }

    #[tokio::test]
    async fn test_semantic_similarity() {
        let (cache, _temp_dir) = create_test_cache().await;

        // Store a result for a specific query
        let query = "rust programming language tutorial";
        let results = create_test_result("rust_docs", "Learn Rust programming");
        cache
            .store(query, &results, "rust_docs", None)
            .await
            .expect("Failed to store");

        // A semantically similar query should hit with high threshold
        // Note: Semantic similarity depends on the TextEncoder's encoding quality
        // This test verifies the encoding and similarity check work correctly
        let similar_query = "Rust programming language TUTORIAL"; // Case difference
        let loaded = cache
            .query(similar_query, None)
            .await
            .expect("Failed to query");

        // Normalization makes this identical query hit with score 1.0
        assert!(
            loaded.is_some(),
            "Expected cache hit for normalized identical query"
        );
    }

    #[tokio::test]
    async fn test_remove_entry() {
        let (cache, _temp_dir) = create_test_cache().await;

        // Store a result
        let query = "unique test query for removal";
        let results = create_test_result("remove_test", "Content to be removed");
        cache
            .store(query, &results, "remove_test", None)
            .await
            .expect("Failed to store");

        // Verify it's stored
        let loaded = cache.query(query, None).await.expect("Failed to query");
        assert!(loaded.is_some(), "Expected cache hit after store");

        // Remove the entry
        cache.remove(query).await.expect("Failed to remove");

        // Query should now miss
        let loaded = cache.query(query, None).await.expect("Failed to query");
        assert!(loaded.is_none(), "Expected cache miss after remove");
    }

    #[tokio::test]
    async fn test_multiple_entries() {
        let (cache, _temp_dir) = create_test_cache().await;

        // Store multiple different queries
        let queries = ["rust async", "python async", "go async"];
        for (i, query) in queries.iter().enumerate() {
            let results = create_test_result(
                &format!("provider_{}", i),
                &format!("Content for {}", query),
            );
            cache
                .store(query, &results, &format!("provider_{}", i), None)
                .await
                .expect("Failed to store");
        }

        // Each query should hit separately
        for (i, query) in queries.iter().enumerate() {
            let loaded = cache.query(query, None).await.expect("Failed to query");
            assert!(loaded.is_some(), "Expected cache hit for query: {}", query);
            assert_eq!(loaded.unwrap()[0].source, format!("provider_{}", i));
        }
    }

    #[tokio::test]
    async fn test_query_url() {
        let (cache, _temp_dir) = create_test_cache().await;

        // Store a URL result
        let url = "https://docs.rs/tokio";
        let results = create_test_result("jina", "Tokio documentation content");
        cache
            .store(url, &results, "jina", None)
            .await
            .expect("Failed to store");

        // Query URL should return single result
        let loaded = cache
            .query_url(url, None)
            .await
            .expect("Failed to query_url");
        assert!(loaded.is_some(), "Expected cache hit for URL");
        assert_eq!(loaded.unwrap().source, "jina");
    }

    #[tokio::test]
    async fn test_query_provider() {
        let (cache, _temp_dir) = create_test_cache().await;

        // Store with provider prefix
        let query = "rust async";
        let provider = "exa_mcp";
        let key = format!("{}:{}", provider, query);
        let results = create_test_result(provider, "Exa MCP result");
        cache
            .store(&key, &results, provider, None)
            .await
            .expect("Failed to store");

        // Query with provider should hit
        let loaded = cache
            .query_provider(query, provider, None)
            .await
            .expect("Failed to query_provider");
        assert!(
            loaded.is_some(),
            "Expected cache hit for provider-specific query"
        );
    }

    #[tokio::test]
    async fn test_cache_stats() {
        let (cache, _temp_dir) = create_test_cache().await;

        let stats = cache.stats().await.expect("Failed to get stats");
        assert_eq!(stats.path, _temp_dir.path().to_str().unwrap());
        // Note: entries count may not be available in current API
    }
}
