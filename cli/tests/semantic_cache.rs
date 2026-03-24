//! Integration tests for semantic cache with Turso/libsql persistence.
//!
//! Validates that records are correctly stored and loaded from the database.

#[cfg(feature = "semantic-cache")]
mod semantic_cache_tests {
    use std::collections::HashMap;

    use chaotic_semantic_memory::prelude::*;
    use serde_json::Value;
    use tempfile::TempDir;

    /// Test that concepts with metadata are stored and retrievable from Turso DB
    #[tokio::test]
    async fn test_store_and_load_with_metadata() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_semantic.db");

        let framework = ChaoticSemanticFramework::builder()
            .with_local_db(db_path.to_str().unwrap())
            .build()
            .await
            .expect("Failed to create framework");

        // Create a concept with metadata
        let mut metadata = HashMap::new();
        metadata.insert("query".to_string(), Value::String("test query".to_string()));
        metadata.insert(
            "provider".to_string(),
            Value::String("test_provider".to_string()),
        );
        metadata.insert(
            "results".to_string(),
            Value::Array(vec![Value::Object(
                [
                    (
                        "url".to_string(),
                        Value::String("https://example.com".to_string()),
                    ),
                    (
                        "content".to_string(),
                        Value::String("Test content".to_string()),
                    ),
                    ("source".to_string(), Value::String("test".to_string())),
                ]
                .into_iter()
                .collect(),
            )]),
        );

        let vector = HVec10240::from_bytes(b"test query");

        // Store with metadata
        framework
            .inject_concept_with_metadata("test-1", vector.clone(), metadata.clone())
            .await
            .expect("Failed to inject concept with metadata");

        // Persist to DB
        framework.persist().await.expect("Failed to persist");

        // Verify concept count
        let stats = framework.stats().await.expect("Failed to get stats");
        assert_eq!(stats.concept_count, 1, "Should have 1 concept after store");

        // Retrieve by ID and verify metadata
        let concept = framework
            .get_concept("test-1")
            .await
            .expect("Failed to get concept")
            .expect("Concept should exist");

        assert_eq!(concept.id, "test-1");
        assert_eq!(
            concept.metadata.get("query").unwrap().as_str().unwrap(),
            "test query"
        );
        assert_eq!(
            concept.metadata.get("provider").unwrap().as_str().unwrap(),
            "test_provider"
        );
        assert!(concept.metadata.contains_key("results"));
    }

    /// Test that probing returns correct results after store
    #[tokio::test]
    async fn test_probe_returns_stored_concepts() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_probe.db");

        let framework = ChaoticSemanticFramework::builder()
            .with_local_db(db_path.to_str().unwrap())
            .build()
            .await
            .expect("Failed to create framework");

        // Store multiple concepts
        for i in 0..3 {
            let mut metadata = HashMap::new();
            metadata.insert("query".to_string(), Value::String(format!("query {}", i)));

            let vector = HVec10240::from_bytes(format!("query {}", i).as_bytes());
            framework
                .inject_concept_with_metadata(format!("concept-{}", i), vector, metadata)
                .await
                .expect("Failed to inject");
        }

        // Probe with same vector as concept-0
        let query_vector = HVec10240::from_bytes(b"query 0");
        let hits = framework
            .probe(query_vector, 5)
            .await
            .expect("Probe failed");

        assert!(!hits.is_empty(), "Should have at least one hit");
        assert_eq!(hits[0].0, "concept-0", "Best match should be concept-0");
        assert!(hits[0].1 > 0.5, "Score should be above 0.5");
    }

    /// Test persistence round-trip: store, persist, reload, verify
    #[tokio::test]
    async fn test_persistence_roundtrip() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_roundtrip.db");

        // Phase 1: Store data
        {
            let framework = ChaoticSemanticFramework::builder()
                .with_local_db(db_path.to_str().unwrap())
                .build()
                .await
                .expect("Failed to create framework");

            let mut metadata = HashMap::new();
            metadata.insert(
                "data".to_string(),
                Value::String("persistent value".to_string()),
            );

            let vector = HVec10240::from_bytes(b"persistent query");
            framework
                .inject_concept_with_metadata("persist-test", vector, metadata)
                .await
                .expect("Failed to inject");

            framework.persist().await.expect("Failed to persist");
        }

        // Phase 2: Reload and verify
        {
            let framework = ChaoticSemanticFramework::builder()
                .with_local_db(db_path.to_str().unwrap())
                .build()
                .await
                .expect("Failed to create framework after reload");

            // Load persisted state
            framework
                .load()
                .await
                .expect("Failed to load persisted state");

            // Verify concept exists
            let concept = framework
                .get_concept("persist-test")
                .await
                .expect("Failed to get concept")
                .expect("Concept should exist after reload");

            assert_eq!(
                concept.metadata.get("data").unwrap().as_str().unwrap(),
                "persistent value"
            );
        }
    }

    /// Test metadata update and retrieval
    #[tokio::test]
    async fn test_update_metadata() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_update.db");

        let framework = ChaoticSemanticFramework::builder()
            .with_local_db(db_path.to_str().unwrap())
            .build()
            .await
            .expect("Failed to create framework");

        // Initial store
        let mut metadata = HashMap::new();
        metadata.insert("version".to_string(), Value::Number(1.into()));

        let vector = HVec10240::from_bytes(b"update test");
        framework
            .inject_concept_with_metadata("update-test", vector, metadata)
            .await
            .expect("Failed to inject");

        // Update metadata
        let mut new_metadata = HashMap::new();
        new_metadata.insert("version".to_string(), Value::Number(2.into()));
        new_metadata.insert("updated".to_string(), Value::Bool(true));

        framework
            .update_concept_metadata("update-test", new_metadata)
            .await
            .expect("Failed to update metadata");

        // Verify update
        let concept = framework
            .get_concept("update-test")
            .await
            .expect("Failed to get concept")
            .expect("Concept should exist");

        assert_eq!(
            concept.metadata.get("version").unwrap().as_i64().unwrap(),
            2
        );
        assert_eq!(
            concept.metadata.get("updated").unwrap().as_bool().unwrap(),
            true
        );
    }
}
