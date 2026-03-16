//! Telemetry and metrics for resolution tracking.

use crate::types::ProviderType;
use serde::{Deserialize, Serialize};

/// Metrics for a single provider call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMetric {
    pub provider: ProviderType,
    pub latency_ms: u64,
    pub success: bool,
    pub paid: bool,
}

/// Aggregated metrics for a resolution request
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ResolveMetrics {
    pub total_latency_ms: u64,
    pub provider_metrics: Vec<ProviderMetric>,
    pub cascade_depth: usize,
    pub paid_usage: bool,
    pub cache_hit: bool,
}

impl ResolveMetrics {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record_provider(&mut self, provider: ProviderType, latency_ms: u64, success: bool) {
        let paid = provider.is_paid();
        if paid && success {
            self.paid_usage = true;
        }
        self.provider_metrics.push(ProviderMetric {
            provider,
            latency_ms,
            success,
            paid,
        });
        self.total_latency_ms += latency_ms;
    }
}
