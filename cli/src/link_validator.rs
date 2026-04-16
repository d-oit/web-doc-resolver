//! Async link validation for research results.

use crate::resolver::cascade::is_safe_url_async;
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
        if !is_safe_url_async(link).await {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_validate_links_blocks_unsafe() {
        use crate::resolver::cascade::is_safe_url;
        let links = vec![
            "https://google.com".to_string(),
            "http://127.0.0.1".to_string(),
            "http://[::ffff:169.254.169.254]".to_string(),
            "http://100.64.0.1".to_string(),
        ];
        let validated = validate_links(&links).await;

        // Should only contain safe links.
        // Note: google.com might fail HEAD if no internet, but it should at least not be filtered out by is_safe_url.
        // The unsafe ones MUST be filtered out by is_safe_url BEFORE the HEAD request.
        for link in &validated {
            assert!(is_safe_url(link));
        }
        assert!(!validated.contains(&"http://127.0.0.1".to_string()));
        assert!(!validated.contains(&"http://[::ffff:169.254.169.254]".to_string()));
        assert!(!validated.contains(&"http://100.64.0.1".to_string()));
    }
}
