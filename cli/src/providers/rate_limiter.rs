use crate::config::Config;
use std::collections::HashMap;
use tokio::sync::Mutex;
use tokio::time::{Duration, Instant};

/// Internal state for the token bucket
struct TokenBucketState {
    tokens: f64,
    last_refill: Instant,
}

/// Token bucket rate limiter
pub struct TokenBucket {
    state: Mutex<TokenBucketState>,
    rate: f64,
    capacity: f64,
}

impl TokenBucket {
    /// Create a new token bucket
    pub fn new(rate: f64, capacity: f64) -> Self {
        Self {
            state: Mutex::new(TokenBucketState {
                tokens: capacity,
                last_refill: Instant::now(),
            }),
            rate,
            capacity,
        }
    }

    /// Acquire a token, waiting if necessary
    pub async fn acquire(&self) {
        loop {
            let mut state = self.state.lock().await;

            let elapsed = state.last_refill.elapsed().as_secs_f64();
            state.tokens = (state.tokens + elapsed * self.rate).min(self.capacity);
            state.last_refill = Instant::now();

            if state.tokens >= 1.0 {
                state.tokens -= 1.0;
                return;
            }

            // Release lock before sleeping
            drop(state);

            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    /// Try to acquire a token without waiting
    #[allow(dead_code)]
    pub async fn try_acquire(&self) -> bool {
        let mut state = self.state.lock().await;

        let elapsed = state.last_refill.elapsed().as_secs_f64();
        state.tokens = (state.tokens + elapsed * self.rate).min(self.capacity);
        state.last_refill = Instant::now();

        if state.tokens >= 1.0 {
            state.tokens -= 1.0;
            true
        } else {
            false
        }
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
                    let burst = if rate_limit.burst > 0.0 {
                        rate_limit.burst
                    } else {
                        1.0
                    };
                    limiters.insert(
                        name.clone(),
                        TokenBucket::new(rate_limit.requests_per_second, burst),
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{ProviderConfig, RateLimitConfig};

    #[tokio::test]
    async fn test_token_bucket_burst() {
        // Rate of 1 per second, burst of 5
        let bucket = TokenBucket::new(1.0, 5.0);

        let start = Instant::now();
        for _ in 0..5 {
            bucket.acquire().await;
        }
        // Burst should be immediate
        assert!(start.elapsed() < Duration::from_millis(100));
    }

    #[tokio::test]
    async fn test_token_bucket_rate() {
        // Rate of 10 per second, burst of 1
        let bucket = TokenBucket::new(10.0, 1.0);

        let start = Instant::now();
        for _ in 0..3 {
            bucket.acquire().await;
        }
        // 3 tokens at 10 tokens/sec should take at least 200ms (0ms, 100ms, 200ms)
        assert!(start.elapsed() >= Duration::from_millis(200));
    }

    #[tokio::test]
    async fn test_try_acquire() {
        let bucket = TokenBucket::new(1.0, 1.0);
        assert!(bucket.try_acquire().await);
        assert!(!bucket.try_acquire().await);
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
}
