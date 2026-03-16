use std::collections::HashMap;
use std::time::Duration;
use wdr_lib::negative_cache::NegativeCache;

#[test]
fn test_negative_cache_skip() {
    let mut cache = NegativeCache::default();
    let target = "https://example.com/bad";
    let provider = "jina";

    assert!(!cache.should_skip(target, provider));

    cache.insert(
        target,
        provider,
        "rate_limited",
        Duration::from_secs(60),
        HashMap::new(),
    );

    assert!(cache.should_skip(target, provider));
    assert!(!cache.should_skip("https://example.com/other", provider));
    assert!(!cache.should_skip(target, "firecrawl"));
}
