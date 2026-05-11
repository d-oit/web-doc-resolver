"""
Per-domain routing memory for the Web Doc Resolver.
"""

import sqlite3
from collections import defaultdict
from datetime import datetime


class RoutingMemory:
    def __init__(self, db_path: str = ".do-wdr_routing.db"):
        # domain -> provider -> stats
        self.domain_stats = defaultdict(
            lambda: defaultdict(
                lambda: {
                    "success": 0,
                    "failure": 0,
                    "avg_latency_ms": 0.0,
                    "avg_quality": 0.0,
                }
            )
        )
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        try:
            conn = sqlite3.connect(self.db_path)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS provider_quota_usage (
                    provider    TEXT NOT NULL,
                    year_month  TEXT NOT NULL,
                    call_count  INTEGER NOT NULL DEFAULT 0,
                    updated_at  INTEGER NOT NULL,
                    PRIMARY KEY (provider, year_month)
                )
            """)
            conn.commit()
            conn.close()
        except Exception:
            pass

    def record(
        self, domain: str, provider: str, success: bool, latency_ms: int, quality_score: float
    ) -> None:
        stats = self.domain_stats[domain][provider]
        total = stats["success"] + stats["failure"]
        stats["avg_latency_ms"] = ((stats["avg_latency_ms"] * total) + latency_ms) / (total + 1)
        stats["avg_quality"] = ((stats["avg_quality"] * total) + quality_score) / (total + 1)
        if success:
            stats["success"] += 1
        else:
            stats["failure"] += 1

    def rank(self, domain: str, providers: list[str]) -> list[str]:
        if domain not in self.domain_stats:
            return providers

        def provider_score(provider: str) -> tuple[float, float, float]:
            s = self.domain_stats[domain][provider]
            total = s["success"] + s["failure"]
            success_rate = (s["success"] / total) if total else 0.5
            # Rank by success rate, then quality, then (negative) latency
            return (success_rate, s["avg_quality"], -s["avg_latency_ms"])

        return sorted(providers, key=provider_score, reverse=True)

    def get_p75_latency(self, domain: str, provider: str, default: int = 2500) -> int:
        stats = self.domain_stats.get(domain, {}).get(provider)
        if not stats or stats["avg_latency_ms"] == 0:
            return default
        # Heuristic: p75 is often ~1.5x average for tail latency
        return int(stats["avg_latency_ms"] * 1.5)

    def increment_provider_usage(self, provider: str) -> None:
        try:
            try:
                from datetime import UTC

                ym = datetime.now(UTC).strftime("%Y-%m")
            except ImportError:
                # Fallback for Python < 3.11
                ym = datetime.utcnow().strftime("%Y-%m")
            conn = sqlite3.connect(self.db_path)
            conn.execute(
                """
                INSERT INTO provider_quota_usage (provider, year_month, call_count, updated_at)
                VALUES (?, ?, 1, unixepoch())
                ON CONFLICT(provider, year_month) DO UPDATE SET
                    call_count = call_count + 1,
                    updated_at = unixepoch()
            """,
                (provider, ym),
            )
            conn.commit()
            conn.close()
        except Exception:
            pass

    def get_exa_monthly_usage(self) -> int:
        try:
            try:
                from datetime import UTC

                ym = datetime.now(UTC).strftime("%Y-%m")
            except ImportError:
                # Fallback for Python < 3.11
                ym = datetime.utcnow().strftime("%Y-%m")
            conn = sqlite3.connect(self.db_path)
            row = conn.execute(
                "SELECT COALESCE(call_count, 0) FROM provider_quota_usage "
                "WHERE provider = 'exa_mcp' AND year_month = ?",
                (ym,),
            ).fetchone()
            count = row[0] if row else 0
            conn.close()
            return count
        except Exception:
            return 0
