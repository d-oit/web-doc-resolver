use do_wdr_lib::config::Config;
use do_wdr_lib::resolver::Resolver;
use do_wdr_lib::startup::prewarm_cache;
use std::sync::Arc;

#[tokio::test]
async fn test_prewarm_cache_interaction() {
    let mut config = Config::default();
    config.cache.prewarm.enabled = true;
    config.cache.prewarm.top_n_domains = 5;

    let resolver = Arc::new(Resolver::new().await);

    // Fill routing memory with some dummy data
    {
        let rm = resolver.routing_memory();
        let mut memory = rm.lock().unwrap();
        memory.record("example.com", "jina", true, 100, 0.9);
        memory.record("rust-lang.org", "jina", true, 100, 0.9);
    }

    // Call prewarm_cache
    prewarm_cache(resolver.clone(), config).await;

    // Verify top domains were actually used (by checking routing memory again or similar)
    // Here we just verify completion.
}

#[tokio::test]
async fn test_prewarm_disabled() {
    let mut config = Config::default();
    config.cache.prewarm.enabled = false;

    let resolver = Arc::new(Resolver::new().await);
    {
        let rm = resolver.routing_memory();
        let mut memory = rm.lock().unwrap();
        memory.record("example.com", "jina", true, 100, 0.9);
    }

    prewarm_cache(resolver.clone(), config).await;
    // Should return early
}
