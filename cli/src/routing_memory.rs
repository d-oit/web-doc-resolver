use rusqlite::{Connection, Result as SqliteResult, params};
use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct ProviderStats {
    pub success: usize,
    pub failure: usize,
    pub avg_latency_ms: f32,
    pub avg_quality: f32,
}

pub struct RoutingMemory {
    domain_stats: HashMap<String, HashMap<String, ProviderStats>>,
    db: Option<Connection>,
}

impl Default for RoutingMemory {
    fn default() -> Self {
        Self::new()
    }
}

impl RoutingMemory {
    pub fn new() -> Self {
        let db_path = ".do-wdr_routing.db";
        let db = Connection::open(db_path).ok();

        if let Some(ref conn) = db {
            let _ = conn.execute(
                "CREATE TABLE IF NOT EXISTS provider_quota_usage (
                    provider    TEXT NOT NULL,
                    year_month  TEXT NOT NULL,
                    call_count  INTEGER NOT NULL DEFAULT 0,
                    updated_at  INTEGER NOT NULL,
                    PRIMARY KEY (provider, year_month)
                )",
                [],
            );
        }

        Self {
            domain_stats: HashMap::new(),
            db,
        }
    }

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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_routing_memory_db_init() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("routing.db");
        let db_str = db_path.to_str().unwrap();

        let rm = RoutingMemory {
            domain_stats: HashMap::new(),
            db: Connection::open(db_str).ok(),
        };

        if let Some(ref conn) = rm.db {
            let _ = conn.execute(
                "CREATE TABLE IF NOT EXISTS provider_quota_usage (
                    provider    TEXT NOT NULL,
                    year_month  TEXT NOT NULL,
                    call_count  INTEGER NOT NULL DEFAULT 0,
                    updated_at  INTEGER NOT NULL,
                    PRIMARY KEY (provider, year_month)
                )",
                [],
            );
        }

        assert!(db_path.exists());

        if let Some(ref conn) = rm.db {
            let count: u32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='provider_quota_usage'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 1);
        }
    }

    #[test]
    fn test_increment_provider_usage() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("routing.db");
        let db_str = db_path.to_str().unwrap();

        let rm = RoutingMemory {
            domain_stats: HashMap::new(),
            db: Connection::open(db_str).ok(),
        };

        if let Some(ref conn) = rm.db {
            let _ = conn.execute(
                "CREATE TABLE IF NOT EXISTS provider_quota_usage (
                    provider    TEXT NOT NULL,
                    year_month  TEXT NOT NULL,
                    call_count  INTEGER NOT NULL DEFAULT 0,
                    updated_at  INTEGER NOT NULL,
                    PRIMARY KEY (provider, year_month)
                )",
                [],
            );
        }

        rm.increment_provider_usage("exa_mcp").unwrap();
        assert_eq!(rm.exa_monthly_usage(), 1);

        rm.increment_provider_usage("exa_mcp").unwrap();
        assert_eq!(rm.exa_monthly_usage(), 2);
    }

    #[test]
    fn test_different_month_reset() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("routing.db");
        let db_str = db_path.to_str().unwrap();

        let rm = RoutingMemory {
            domain_stats: HashMap::new(),
            db: Connection::open(db_str).ok(),
        };

        if let Some(ref conn) = rm.db {
            let _ = conn.execute(
                "CREATE TABLE IF NOT EXISTS provider_quota_usage (
                    provider    TEXT NOT NULL,
                    year_month  TEXT NOT NULL,
                    call_count  INTEGER NOT NULL DEFAULT 0,
                    updated_at  INTEGER NOT NULL,
                    PRIMARY KEY (provider, year_month)
                )",
                [],
            );

            conn.execute(
                "INSERT INTO provider_quota_usage (provider, year_month, call_count, updated_at) VALUES (?1, ?2, ?3, ?4)",
                params!["exa_mcp", "2000-01", 10, 0],
            ).unwrap();
        }

        assert_eq!(rm.exa_monthly_usage(), 0);
        rm.increment_provider_usage("exa_mcp").unwrap();
        assert_eq!(rm.exa_monthly_usage(), 1);
    }
}

impl RoutingMemory {
    pub fn increment_provider_usage(&self, provider: &str) -> SqliteResult<()> {
        let Some(ref conn) = self.db else {
            return Ok(());
        };
        let ym = chrono::Utc::now().format("%Y-%m").to_string();
        conn.execute(
            "INSERT INTO provider_quota_usage (provider, year_month, call_count, updated_at)
             VALUES (?1, ?2, 1, unixepoch())
             ON CONFLICT(provider, year_month) DO UPDATE SET
                 call_count = call_count + 1,
                 updated_at = unixepoch()",
            params![provider, ym],
        )?;
        Ok(())
    }

    pub fn exa_monthly_usage(&self) -> u32 {
        let Some(ref conn) = self.db else {
            return 0;
        };
        let ym = chrono::Utc::now().format("%Y-%m").to_string();
        conn.query_row(
            "SELECT COALESCE(call_count, 0) FROM provider_quota_usage
             WHERE provider = 'exa_mcp' AND year_month = ?1",
            params![ym],
            |row| row.get(0),
        )
        .unwrap_or(0)
    }
}

fn extract_domain(target: &str) -> Option<String> {
    url::Url::parse(target)
        .ok()
        .and_then(|u| u.host_str().map(|s| s.to_string()))
}
