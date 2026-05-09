//! Startup and pre-warming logic for the Web Documentation Resolver CLI.

use crate::config::Config;
use crate::resolver::Resolver;
use std::sync::Arc;
use tokio::sync::Semaphore;

/// Pre-warm the semantic cache with top-N frequently accessed domains.
pub async fn prewarm_cache(resolver: Arc<Resolver>, config: Config) {
    if !config.cache.prewarm.enabled {
        return;
    }

    let top_domains = {
        let rm = resolver.routing_memory();
        let memory = rm.lock().unwrap();
        memory.top_domains(config.cache.prewarm.top_n_domains)
    };

    if top_domains.is_empty() {
        tracing::debug!("No domains found in routing memory for pre-warming");
        return;
    }

    if resolver.cache().is_none() {
        tracing::debug!("Semantic cache disabled, skipping pre-warm");
        return;
    }

    tracing::info!("Starting cache pre-warm for {} domains", top_domains.len());

    let semaphore = Arc::new(Semaphore::new(config.cache.prewarm.max_concurrency));
    let mut tasks = Vec::new();

    for domain in top_domains {
        let sem = semaphore.clone();
        let resolver_clone = resolver.clone();
        let config_clone = config.clone();
        let domain_str = domain.clone();

        // Ensure we are pre-warming with a full URL if it's a domain
        let url = if !domain_str.starts_with("http") {
            format!("https://{}", domain_str)
        } else {
            domain_str.clone()
        };

        tasks.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();

            let already_cached = if let Some(cache) = resolver_clone.cache() {
                cache.has_valid_entry(&url).await
            } else {
                false
            };

            if !already_cached {
                tracing::debug!("Pre-warming: {} with profile {:?}", url, config_clone.cache.prewarm.profile);
                // Use a temporary config with the pre-warm profile
                let mut prewarm_config = config_clone.clone();
                prewarm_config.profile = config_clone.cache.prewarm.profile.clone();

                // We use resolve_url which exists on Resolver
                let _ = resolver_clone.resolve_url(&url).await;
            } else {
                tracing::debug!("Skip pre-warm (already cached): {}", url);
            }
        }));
    }

    futures::future::join_all(tasks).await;
    tracing::info!("Cache pre-warm complete");
}
