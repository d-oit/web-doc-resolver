use std::collections::HashMap;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Default)]
pub struct CircuitBreakerState {
    pub failures: usize,
    pub open_until: Option<Instant>,
}

impl CircuitBreakerState {
    pub fn is_open(&self) -> bool {
        self.open_until.map(|t| t > Instant::now()).unwrap_or(false)
    }

    pub fn record_failure(&mut self, threshold: usize, cooldown: Duration) {
        self.failures += 1;
        if self.failures >= threshold {
            self.open_until = Some(Instant::now() + cooldown);
        }
    }

    pub fn record_success(&mut self) {
        self.failures = 0;
        self.open_until = None;
    }
}

#[derive(Default)]
pub struct CircuitBreakerRegistry {
    providers: HashMap<String, CircuitBreakerState>,
}

impl CircuitBreakerRegistry {
    pub fn is_open(&self, provider: &str) -> bool {
        self.providers
            .get(provider)
            .map(|s| s.is_open())
            .unwrap_or(false)
    }

    pub fn record_failure(&mut self, provider: &str, threshold: usize, cooldown: Duration) {
        self.providers
            .entry(provider.to_string())
            .or_default()
            .record_failure(threshold, cooldown);
    }

    pub fn record_success(&mut self, provider: &str) {
        self.providers
            .entry(provider.to_string())
            .or_default()
            .record_success();
    }
}
