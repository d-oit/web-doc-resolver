//! Benchmarks for semantic cache operations
//!
//! Run with: cargo bench --features semantic-cache

use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};
use do_wdr_lib::config::{Config, SemanticCacheConfig};
use do_wdr_lib::semantic_cache::SemanticCache;
use do_wdr_lib::types::ResolvedResult;
use std::time::Duration;
use tokio::runtime::Runtime;

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
            Some(format!("Content for page {} with enough characters to be valid", i)),
            "test_provider",
            0.9 - (i as f64 * 0.1),
        ))
        .collect()
}

/// Benchmark cache store operations
fn bench_store(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let temp_dir = tempfile::tempdir().unwrap();
    let config = test_config(temp_dir.path().to_str().unwrap());
    
    let cache = rt.block_on(async {
        SemanticCache::new(&config).await.unwrap().unwrap()
    });
    
    let results = create_test_results(5);
    
    let mut group = c.benchmark_group("semantic_cache_store");
    group.measurement_time(Duration::from_secs(5));
    group.sample_size(50);
    
    // Benchmark storing different query sizes
    for size in [1, 5, 10].iter() {
        group.bench_with_input(
            BenchmarkId::new("results", size),
            size,
            |b, _| {
                let query = format!("rust programming tutorial {}", rand::random::<u32>());
                let test_results = create_test_results(*size);
                b.to_async(&rt).iter(|| async {
                    cache.store(&query, &test_results, "test_provider").await.unwrap();
                });
            },
        );
    }
    
    group.finish();
    
    // Cleanup
    drop(cache);
    let _ = std::fs::remove_dir_all(temp_dir);
}

/// Benchmark cache query operations
fn bench_query(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let temp_dir = tempfile::tempdir().unwrap();
    let config = test_config(temp_dir.path().to_str().unwrap());
    
    let cache = rt.block_on(async {
        let cache = SemanticCache::new(&config).await.unwrap().unwrap();
        
        // Pre-populate cache with test data
        let queries = vec![
            "rust programming tutorial",
            "python machine learning guide",
            "javascript async await patterns",
            "go concurrency best practices",
            "typescript type system advanced",
        ];
        
        for (i, query) in queries.iter().enumerate() {
            let results = create_test_results(3);
            cache.store(query, &results, "test_provider").await.unwrap();
        }
        
        cache
    });
    
    let mut group = c.benchmark_group("semantic_cache_query");
    group.measurement_time(Duration::from_secs(5));
    group.sample_size(50);
    
    // Benchmark querying with exact match
    group.bench_function("exact_match", |b| {
        b.to_async(&rt).iter(|| async {
            cache.query("rust programming tutorial").await.unwrap();
        });
    });
    
    // Benchmark querying with similar (semantic) match
    group.bench_function("semantic_match", |b| {
        b.to_async(&rt).iter(|| async {
            cache.query("rust coding tutorial").await.unwrap();
        });
    });
    
    // Benchmark querying with no match
    group.bench_function("no_match", |b| {
        b.to_async(&rt).iter(|| async {
            cache.query("completely unrelated query about gardening").await.unwrap();
        });
    });
    
    group.finish();
    
    // Cleanup
    drop(cache);
    let _ = std::fs::remove_dir_all(temp_dir);
}

/// Benchmark concurrent operations
fn bench_concurrent(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let temp_dir = tempfile::tempdir().unwrap();
    let config = test_config(temp_dir.path().to_str().unwrap());
    
    let cache = rt.block_on(async {
        SemanticCache::new(&config).await.unwrap().unwrap()
    });
    
    // Pre-populate
    let results = create_test_results(3);
    rt.block_on(async {
        cache.store("base query", &results, "test_provider").await.unwrap();
    });
    
    let mut group = c.benchmark_group("semantic_cache_concurrent");
    group.measurement_time(Duration::from_secs(10));
    group.sample_size(20);
    
    // Benchmark concurrent reads
    group.bench_function("concurrent_reads", |b| {
        b.to_async(&rt).iter(|| async {
            let mut handles = vec![];
            for i in 0..10 {
                let query = format!("concurrent query {}", i);
                let cache_ref = &cache;
                handles.push(tokio::spawn(async move {
                    cache_ref.query(&query).await.unwrap();
                }));
            }
            for handle in handles {
                handle.await.unwrap();
            }
        });
    });
    
    // Benchmark mixed read/write
    group.bench_function("mixed_read_write", |b| {
        b.to_async(&rt).iter(|| async {
            let mut handles = vec![];
            let results = create_test_results(2);
            
            for i in 0..5 {
                let query = format!("write query {}", i);
                let cache_ref = &cache;
                let results_ref = &results;
                handles.push(tokio::spawn(async move {
                    cache_ref.store(&query, results_ref, "test_provider").await.unwrap();
                }));
            }
            
            for i in 0..5 {
                let query = format!("read query {}", i);
                let cache_ref = &cache;
                handles.push(tokio::spawn(async move {
                    cache_ref.query(&query).await.unwrap();
                }));
            }
            
            for handle in handles {
                handle.await.unwrap();
            }
        });
    });
    
    group.finish();
    
    // Cleanup
    drop(cache);
    let _ = std::fs::remove_dir_all(temp_dir);
}

criterion_group!(benches, bench_store, bench_query, bench_concurrent);
criterion_main!(benches);
