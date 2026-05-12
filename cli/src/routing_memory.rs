use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct ProviderStats {
    pub success: usize,
    pub failure: usize,
    pub avg_latency_ms: f32,
    pub avg_quality: f32,
    pub last_attempted: Option<DateTime<Utc>>,
}

#[derive(Default)]
pub struct RoutingMemory {
    domain_stats: HashMap<String, HashMap<String, ProviderStats>>,
}

impl RoutingMemory {
    pub fn record(
        &mut self,
        domain: &str,
        provider: &str,
        success: bool,
        latency_ms: u64,
        quality_score: f32,
    ) {
        let providers = self.domain_stats.entry(domain.to_string()).or_default();
        let stats = providers.entry(provider.to_string()).or_default();
        let total = stats.success + stats.failure;
        let total_f = total as f32;

        stats.avg_latency_ms =
            ((stats.avg_latency_ms * total_f) + latency_ms as f32) / (total_f + 1.0);
        stats.avg_quality = ((stats.avg_quality * total_f) + quality_score) / (total_f + 1.0);
        stats.last_attempted = Some(Utc::now());

        if success {
            stats.success += 1;
        } else {
            stats.failure += 1;
        }
    }

    pub fn compute_score(&self, provider: &str, domain: &str) -> f64 {
        let Some(domain_map) = self.domain_stats.get(domain) else {
            return 0.5;
        };
        let Some(stats) = domain_map.get(provider) else {
            return 0.5;
        };

        let attempts = stats.success + stats.failure;
        if attempts == 0 {
            return 0.5;
        }

        let success_rate = stats.success as f64 / attempts as f64;

        let days_since_last = if let Some(last) = stats.last_attempted {
            let duration = Utc::now().signed_duration_since(last);
            duration.num_seconds() as f64 / 86400.0
        } else {
            0.0
        };

        let quality_factor = 0.5 + 0.5 * stats.avg_quality as f64;
        let recency_weight = (-days_since_last / 7.0).exp();
        let score = (success_rate * quality_factor * recency_weight) * 1000.0
            / (stats.avg_latency_ms as f64).max(1.0);

        tracing::debug!(
            "Provider score: domain={}, provider={}, score={:.4}, success_rate={:.2}, quality={:.2}, recency={:.2}, latency={:.1}ms",
            domain,
            provider,
            score,
            success_rate,
            stats.avg_quality,
            recency_weight,
            stats.avg_latency_ms
        );

        score
    }

    pub fn rank_providers(&self, domain: &str, providers: &[String]) -> Vec<String> {
        let mut scores: Vec<(&String, f64)> = providers
            .iter()
            .map(|p| (p, self.compute_score(p, domain)))
            .collect();

        scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        scores.into_iter().map(|(p, _)| p.clone()).collect()
    }
}
