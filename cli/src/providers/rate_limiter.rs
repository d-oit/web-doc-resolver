use crate::config::Config;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{Duration, Instant};

/// Token bucket rate limiter
pub struct TokenBucket {
    tokens: Arc<Mutex<f64>>,
    last_refill: Arc<Mutex<Instant>>,
    rate: f64,
    capacity: f64,
}

impl TokenBucket {
    /// Create a new token bucket
    pub fn new(rate: f64, capacity: f64) -> Self {
        Self {
            tokens: Arc::new(Mutex::new(capacity)),
            last_refill: Arc::new(Mutex::new(Instant::now())),
            rate,
            capacity,
        }
    }

    /// Acquire a token, waiting if necessary
    pub async fn acquire(&self) {
        loop {
            let mut tokens = self.tokens.lock().await;
            let mut last = self.last_refill.lock().await;

            let elapsed = last.elapsed().as_secs_f64();
            *tokens = (*tokens + elapsed * self.rate).min(self.capacity);
            *last = Instant::now();

            if *tokens >= 1.0 {
                *tokens -= 1.0;
                return;
            }

            // Release locks before sleeping
            drop(tokens);
            drop(last);

            tokio::time::sleep(Duration::from_millis(50)).await;
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
        // Actually:
        // 1st token: immediate (burst=1)
        // 2nd token: waits for 1/10 = 100ms
        // 3rd token: waits for another 1/10 = 100ms
        // Total should be >= 200ms
        assert!(start.elapsed() >= Duration::from_millis(200));
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
}
