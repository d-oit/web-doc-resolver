use crate::config::Config;
use std::collections::HashMap;
use tokio::sync::Mutex;
use tokio::time::{Duration, Instant};

/// Internal state for the token bucket
struct BucketState {
    tokens: f64,
    last_refill: Instant,
}

/// Token bucket rate limiter
pub struct TokenBucket {
    state: Mutex<BucketState>,
    rate: f64,
    capacity: f64,
}

impl TokenBucket {
    /// Create a new token bucket. Capacity is clamped to a minimum of 1.0
    /// to prevent infinite waits in the acquire loop.
    pub fn new(rate: f64, capacity: f64) -> Self {
        let capacity = capacity.max(1.0);
        Self {
            state: Mutex::new(BucketState {
                tokens: capacity,
                last_refill: Instant::now(),
            }),
            rate,
            capacity,
        }
    }

    /// Refill tokens based on elapsed time
    fn refill(state: &mut BucketState, rate: f64, capacity: f64) {
        let elapsed = state.last_refill.elapsed().as_secs_f64();
        state.tokens = (state.tokens + elapsed * rate).min(capacity);
        state.last_refill = Instant::now();
    }

    /// Acquire a token, waiting for the exact duration needed.
    pub async fn acquire(&self) {
        // Fast path: try to acquire immediately without sleeping
        {
            let mut state = self.state.lock().await;
            Self::refill(&mut state, self.rate, self.capacity);
            if state.tokens >= 1.0 {
                state.tokens -= 1.0;
                return;
            }
            // Calculate how long until we have at least 1 token
            let needed = 1.0 - state.tokens;
            let wait_secs = needed / self.rate;
            // Drop the lock before sleeping
            drop(state);
            tokio::time::sleep(Duration::from_secs_f64(wait_secs)).await;
        }
        // After waiting, we should have enough tokens; but loop defensively
        // to handle edge cases (e.g. rate=0 or race conditions).
        loop {
            let mut state = self.state.lock().await;
            Self::refill(&mut state, self.rate, self.capacity);
            if state.tokens >= 1.0 {
                state.tokens -= 1.0;
                return;
            }
            let needed = 1.0 - state.tokens;
            let wait_secs = needed / self.rate;
            drop(state);
            tokio::time::sleep(Duration::from_secs_f64(wait_secs)).await;
        }
    }

    /// Try to acquire a token with a timeout. Returns `true` if acquired
    /// within the timeout, `false` otherwise.
    pub async fn acquire_timeout(&self, timeout: Duration) -> bool {
        let deadline = Instant::now() + timeout;
        // Fast path
        {
            let mut state = self.state.lock().await;
            Self::refill(&mut state, self.rate, self.capacity);
            if state.tokens >= 1.0 {
                state.tokens -= 1.0;
                return true;
            }
            let now = Instant::now();
            if now >= deadline {
                return false;
            }
            let needed = 1.0 - state.tokens;
            let wait_secs =
                (needed / self.rate).min(deadline.saturating_duration_since(now).as_secs_f64());
            drop(state);
            if wait_secs > 0.0 {
                tokio::time::sleep(Duration::from_secs_f64(wait_secs)).await;
            }
        }
        // Retry after waiting
        loop {
            let mut state = self.state.lock().await;
            Self::refill(&mut state, self.rate, self.capacity);
            if state.tokens >= 1.0 {
                state.tokens -= 1.0;
                return true;
            }
            if Instant::now() >= deadline {
                return false;
            }
            let needed = 1.0 - state.tokens;
            let wait_secs = (needed / self.rate).min(
                deadline
                    .saturating_duration_since(Instant::now())
                    .as_secs_f64(),
            );
            drop(state);
            if wait_secs > 0.0 {
                tokio::time::sleep(Duration::from_secs_f64(wait_secs)).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{ProviderConfig, RateLimitConfig};

    #[tokio::test]
    async fn test_token_bucket_burst() {
        let bucket = TokenBucket::new(1.0, 5.0);

        let start = Instant::now();
        for _ in 0..5 {
            bucket.acquire().await;
        }
        assert!(start.elapsed() < Duration::from_millis(200));
    }

    #[tokio::test]
    async fn test_token_bucket_rate() {
        let bucket = TokenBucket::new(10.0, 1.0);

        let start = Instant::now();
        for _ in 0..3 {
            bucket.acquire().await;
        }
        // 3 tokens at 10/s: 1st immediate, need 2 more tokens at 100ms each
        assert!(start.elapsed() >= Duration::from_millis(180));
    }

    #[tokio::test]
    async fn test_capacity_less_than_one() {
        // Capacity clamped to 1.0, so this should not hang
        let bucket = TokenBucket::new(10.0, 0.5);
        tokio::time::timeout(Duration::from_secs(1), bucket.acquire())
            .await
            .expect("acquire should not hang with capacity < 1.0");
    }

    #[tokio::test]
    async fn test_acquire_timeout_success() {
        let bucket = TokenBucket::new(100.0, 5.0);
        let acquired = bucket.acquire_timeout(Duration::from_millis(10)).await;
        assert!(acquired);
    }

    #[tokio::test]
    async fn test_acquire_timeout_failure() {
        // Rate of 0 effectively means no tokens replenished
        let bucket = TokenBucket::new(0.0, 1.0);
        // Drain the single token
        assert!(bucket.acquire_timeout(Duration::from_millis(10)).await);
        // Now try to get another — rate is 0, should timeout
        assert!(!bucket.acquire_timeout(Duration::from_millis(10)).await);
    }

    #[test]
    fn test_registry_initialization() {
        let mut config = Config::default();
        let mut providers = HashMap::new();
        providers.insert(
            "test_provider".to_string(),
            ProviderConfig {
                rate_limit: Some(RateLimitConfig {
                    requests_per_second: 5.0,
                    burst: 10.0,
                }),
            },
        );
        config.providers = providers;

        let registry = RateLimiterRegistry::new(&config);
        assert!(registry.limiters.contains_key("test_provider"));
    }

    #[test]
    fn test_registry_skips_zero_rate() {
        let mut config = Config::default();
        let mut providers = HashMap::new();
        providers.insert(
            "zero_rate_provider".to_string(),
            ProviderConfig {
                rate_limit: Some(RateLimitConfig {
                    requests_per_second: 0.0,
                    burst: 1.0,
                }),
            },
        );
        config.providers = providers;

        let registry = RateLimiterRegistry::new(&config);
        assert!(!registry.limiters.contains_key("zero_rate_provider"));
    }

    #[test]
    fn test_registry_missing_config() {
        let config = Config::default();
        let registry = RateLimiterRegistry::new(&config);
        assert!(registry.limiters.is_empty());
    }
}

/// Registry of rate limiters for different providers
pub struct RateLimiterRegistry {
    limiters: HashMap<String, TokenBucket>,
}

impl RateLimiterRegistry {
    /// Create a new registry from configuration
    pub fn new(config: &Config) -> Self {
        let mut limiters = HashMap::new();
        for (name, provider_config) in &config.providers {
            if let Some(rate_limit) = &provider_config.rate_limit {
                if rate_limit.requests_per_second > 0.0 {
                    limiters.insert(
                        name.clone(),
                        TokenBucket::new(rate_limit.requests_per_second, rate_limit.burst),
                    );
                }
            }
        }
        Self { limiters }
    }

    /// Acquire a token for the specified provider
    pub async fn acquire(&self, provider: &str) {
        if let Some(limiter) = self.limiters.get(provider) {
            limiter.acquire().await;
        }
    }

    /// Try to acquire a token with a timeout for the specified provider.
    /// Returns `true` if acquired within the timeout, `false` otherwise.
    /// If the provider has no rate limiter configured, returns `true` immediately.
    pub async fn acquire_timeout(&self, provider: &str, timeout: Duration) -> bool {
        match self.limiters.get(provider) {
            Some(limiter) => limiter.acquire_timeout(timeout).await,
            None => true,
        }
    }
}
