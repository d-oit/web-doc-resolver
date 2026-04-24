//! Async link validation for research results.

use crate::resolver::is_url;
use futures::future::join_all;
use reqwest::Client;
use std::sync::OnceLock;
use std::time::Duration;

static SHARED_CLIENT: OnceLock<Client> = OnceLock::new();

/// Get or initialize the shared HTTP client
fn get_client() -> &'static Client {
    SHARED_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_default()
    })
}

/// Validate a list of links using HTTP HEAD requests
pub async fn validate_links(links: &[String]) -> Vec<String> {
    if links.is_empty() {
        return Vec::new();
    }

    let client = get_client();
    let mut futures = Vec::new();

    for link in links {
        if !is_url(link) {
            continue;
        }

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
    results
        .into_iter()
        .filter_map(|r| r.ok().flatten())
        .collect()
}
