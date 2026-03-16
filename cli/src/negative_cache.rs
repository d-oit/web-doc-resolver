use std::collections::HashMap;
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct NegativeCacheEntry {
    pub provider: String,
    pub reason: String,
    pub expires_at: Instant,
    pub metadata: HashMap<String, String>,
}

#[derive(Default)]
pub struct NegativeCache {
    entries: HashMap<String, NegativeCacheEntry>,
}

impl NegativeCache {
    pub fn make_key(target: &str, provider: &str) -> String {
        format!("{provider}::{target}")
    }

    pub fn should_skip(&self, target: &str, provider: &str) -> bool {
        let key = Self::make_key(target, provider);
        self.entries
            .get(&key)
            .map(|entry| entry.expires_at > Instant::now())
            .unwrap_or(false)
    }

    pub fn insert(
        &mut self,
        target: &str,
        provider: &str,
        reason: impl Into<String>,
        ttl: Duration,
        metadata: HashMap<String, String>,
    ) {
        let key = Self::make_key(target, provider);
        self.entries.insert(
            key,
            NegativeCacheEntry {
                provider: provider.to_string(),
                reason: reason.into(),
                expires_at: Instant::now() + ttl,
                metadata,
            },
        );
    }
}
