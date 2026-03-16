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
    pub attempt_index: usize,
    pub quality_score: Option<f32>,
    pub accepted: bool,
    pub skip_reason: Option<String>,
    pub stop_reason: Option<String>,
    pub negative_cache_hit: bool,
    pub circuit_open: bool,
}

/// Aggregated metrics for a resolution request
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ResolveMetrics {
    pub total_latency_ms: u64,
    pub provider_metrics: Vec<ProviderMetric>,
    pub cascade_depth: usize,
    pub paid_usage: bool,
    pub cache_hit: bool,
    pub budget_elapsed_ms: u64,
}

impl ResolveMetrics {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record_provider(&mut self, provider: ProviderType, latency_ms: u64, success: bool) {
        self.record_provider_detailed(
            provider, latency_ms, success, 0, None, success, None, None, false, false,
        );
    }

    #[allow(clippy::too_many_arguments)]
    pub fn record_provider_detailed(
        &mut self,
        provider: ProviderType,
        latency_ms: u64,
        success: bool,
        attempt_index: usize,
        quality_score: Option<f32>,
        accepted: bool,
        skip_reason: Option<String>,
        stop_reason: Option<String>,
        negative_cache_hit: bool,
        circuit_open: bool,
    ) {
        let paid = provider.is_paid();
        if paid && success {
            self.paid_usage = true;
        }
        self.provider_metrics.push(ProviderMetric {
            provider,
            latency_ms,
            success,
            paid,
            attempt_index,
            quality_score,
            accepted,
            skip_reason,
            stop_reason,
            negative_cache_hit,
            circuit_open,
        });
        self.total_latency_ms += latency_ms;
    }
}
