//! Async link validation for research results.

use crate::resolver::cascade::{is_safe_url, safe_request};
use futures::future::join_all;
use reqwest::Client;
use std::time::Duration;

/// Validate a list of links using HTTP HEAD requests
pub async fn validate_links(links: &[String]) -> Vec<String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap_or_default();

    let mut futures = Vec::new();
    for link in links {
        let client = client.clone();
        let link = link.clone();
        futures.push(tokio::spawn(async move {
            if !is_safe_url(&link).await {
                return None;
            }

            match safe_request(&client, reqwest::Method::HEAD, &link, 5).await {
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
