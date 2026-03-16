//! Async link validation for research results.

use reqwest::Client;
use std::time::Duration;
use futures::future::join_all;

/// Validate a list of links using HTTP HEAD requests
pub async fn validate_links(links: &[String]) -> Vec<String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    let mut futures = Vec::new();
    for link in links {
        let client = client.clone();
        let link = link.clone();
        futures.push(tokio::spawn(async move {
            match client.head(&link).send().await {
                Ok(resp) if resp.status().is_success() => Some(link),
                _ => None,
            }
        }));
    }

    let results = join_all(futures).await;
    results.into_iter()
        .filter_map(|r| r.ok().flatten())
        .collect()
}
