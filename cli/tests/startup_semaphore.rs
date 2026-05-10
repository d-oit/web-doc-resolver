use do_wdr_lib::config::Config;
use do_wdr_lib::resolver::Resolver;
use do_wdr_lib::startup::prewarm_cache;
use std::sync::Arc;
use std::time::Duration;

#[tokio::test]
async fn test_prewarm_semaphore_limit() {
    let mut config = Config::default();
    config.cache.prewarm.enabled = true;
    config.cache.prewarm.top_n_domains = 10;
    config.cache.prewarm.max_concurrency = 2;

    let resolver = Arc::new(Resolver::new().await);

    {
        let rm = resolver.routing_memory();
        let mut memory = rm.lock().unwrap();
        for i in 0..10 {
            memory.record(&format!("domain{}.com", i), "jina", true, 100, 0.9);
        }
    }

    // We can't easily assert on internal semaphore state without changing startup.rs,
    // but we verify that the prewarm_cache function finishes correctly.
    // If it was broken (e.g. not releasing permits), it might hang or panic.
    let prewarm_future = prewarm_cache(resolver.clone(), config);

    tokio::select! {
        _ = prewarm_future => {
            // Success
        }
        _ = tokio::time::sleep(Duration::from_secs(5)) => {
            panic!("prewarm_cache timed out - possible semaphore deadlock");
        }
    }
}
