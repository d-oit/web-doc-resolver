use criterion::{Criterion, criterion_group, criterion_main};
use do_wdr_lib::link_validator::validate_links;
use futures::future::join_all;
use reqwest::Client;
use std::time::Duration;
use tokio::runtime::Runtime;

async fn validate_links_no_reuse(links: &[String]) -> Vec<String> {
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
    results
        .into_iter()
        .filter_map(|r| r.ok().flatten())
        .collect()
}

fn bench_validate_links(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let links = vec![
        "https://www.google.com".to_string(),
        "https://www.github.com".to_string(),
        "https://www.rust-lang.org".to_string(),
    ];

    let mut group = c.benchmark_group("link_validator");
    group.measurement_time(Duration::from_secs(10));

    group.bench_function("no_reuse", |b| {
        b.to_async(&rt).iter(|| async {
            validate_links_no_reuse(&links).await;
        });
    });

    group.bench_function("reused", |b| {
        b.to_async(&rt).iter(|| async {
            validate_links(&links).await;
        });
    });

    group.finish();
}

criterion_group!(benches, bench_validate_links);
criterion_main!(benches);
