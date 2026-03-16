use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct ProviderStats {
    pub success: usize,
    pub failure: usize,
    pub avg_latency_ms: f32,
    pub avg_quality: f32,
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

        if success {
            stats.success += 1;
        } else {
            stats.failure += 1;
        }
    }

    pub fn rank_for_target(&self, target: &str, providers: &[String]) -> Vec<String> {
        let domain = extract_domain(target).unwrap_or_default();
        let Some(stats) = self.domain_stats.get(&domain) else {
            return providers.to_vec();
        };

        let mut ranked = providers.to_vec();
        ranked.sort_by(|a, b| {
            let sa = stats.get(a).cloned().unwrap_or_default();
            let sb = stats.get(b).cloned().unwrap_or_default();

            let ta = sa.success + sa.failure;
            let tb = sb.success + sb.failure;

            let sra = if ta == 0 {
                0.5
            } else {
                sa.success as f32 / ta as f32
            };
            let srb = if tb == 0 {
                0.5
            } else {
                sb.success as f32 / tb as f32
            };

            srb.partial_cmp(&sra)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| {
                    sb.avg_quality
                        .partial_cmp(&sa.avg_quality)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .then_with(|| {
                    sa.avg_latency_ms
                        .partial_cmp(&sb.avg_latency_ms)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
        });

        ranked
    }
}

fn extract_domain(target: &str) -> Option<String> {
    url::Url::parse(target)
        .ok()
        .and_then(|u| u.host_str().map(|s| s.to_string()))
}
