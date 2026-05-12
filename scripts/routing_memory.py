"""
Per-domain routing memory for the Web Doc Resolver.
"""

import logging
import math
import sqlite3
import time
from collections import defaultdict

from scripts._routing_utils import DEFAULT_PROVIDER_STATS, ProviderStatsDict, compute_p75_latency

logger = logging.getLogger(__name__)

CREATE_TABLE_PROVIDER_QUOTA_USAGE = """
    CREATE TABLE IF NOT EXISTS provider_quota_usage (
        provider    TEXT NOT NULL,
        year_month  TEXT NOT NULL,
        call_count  INTEGER NOT NULL DEFAULT 0,
        updated_at  INTEGER NOT NULL,
        PRIMARY KEY (provider, year_month)
    )
"""

DEFAULT_DB_PATH = ".do-wdr_routing.db"


class RoutingMemory:
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.domain_stats: defaultdict[str, defaultdict[str, ProviderStatsDict]] = defaultdict(
            lambda: defaultdict(lambda: ProviderStatsDict(**DEFAULT_PROVIDER_STATS))
        )
        self._db_path = db_path
        self._conn: sqlite3.Connection | None = None
        self._init_db()

    def _init_db(self):
        try:
            self._conn = sqlite3.connect(self._db_path)
            self._conn.execute(CREATE_TABLE_PROVIDER_QUOTA_USAGE)
            self._conn.commit()
        except Exception:
            logger.exception("Failed to initialize routing database at %s", self._db_path)

    def record(
        self, domain: str, provider: str, success: bool, latency_ms: int, quality_score: float
    ) -> None:
        stats = self.domain_stats[domain][provider]
        total = stats["success"] + stats["failure"]
        stats["avg_latency_ms"] = ((stats["avg_latency_ms"] * total) + latency_ms) / (total + 1)
        stats["avg_quality"] = ((stats["avg_quality"] * total) + quality_score) / (total + 1)
        stats["last_attempted"] = time.time()
        if success:
            stats["success"] += 1
        else:
            stats["failure"] += 1

    def get_domain_stats(self, provider: str, domain: str) -> dict | None:
        if domain not in self.domain_stats or provider not in self.domain_stats[domain]:
            return None

        stats = self.domain_stats[domain][provider]
        attempts = stats["success"] + stats["failure"]
        if attempts == 0:
            return None

        success_rate = stats["success"] / attempts
        days_since_last = 0.0
        if stats["last_attempted"]:
            days_since_last = (time.time() - stats["last_attempted"]) / 86400.0

        return {
            "attempts": attempts,
            "success_rate": success_rate,
            "avg_latency_ms": stats["avg_latency_ms"],
            "avg_quality": stats["avg_quality"],
            "days_since_last": days_since_last,
        }

    def rank_providers(self, domain: str, providers: list[str]) -> list[str]:
        scores = {}
        for p in providers:
            stats = self.get_domain_stats(p, domain)
            if not stats or stats["attempts"] == 0:
                scores[p] = 0.5
                continue

            quality_factor = 0.5 + 0.5 * stats.get("avg_quality", 0.5)
            recency = math.exp(-stats["days_since_last"] / 7.0)
            score = (
                (stats["success_rate"] * quality_factor * recency)
                * 1000.0
                / max(stats["avg_latency_ms"], 1.0)
            )
            scores[p] = score

            logger.debug(
                "Provider score: domain=%s, provider=%s, score=%.4f, success_rate=%.2f, quality=%.2f, recency=%.2f, latency=%.1fms",
                domain,
                p,
                score,
                stats["success_rate"],
                stats.get("avg_quality", 0.5),
                recency,
                stats["avg_latency_ms"],
            )

        return sorted(providers, key=lambda p: scores[p], reverse=True)

    def rank(self, domain: str, providers: list[str]) -> list[str]:
        """Backward compatibility for rank method."""
        return self.rank_providers(domain, providers)

    def get_p75_latency(self, domain: str, provider: str, default: int = 3000) -> int:
        domain_map = self.domain_stats.get(domain)
        if domain_map is None:
            return default
        stats = domain_map.get(provider)
        if stats is None:
            return default
        return compute_p75_latency(stats["avg_latency_ms"], default)

    def increment_provider_usage(self, provider: str) -> None:
        try:
            ym = time.strftime("%Y-%m", time.gmtime())
            if self._conn is None:
                return
            self._conn.execute(
                "INSERT INTO provider_quota_usage (provider, year_month, call_count, updated_at) "
                "VALUES (?, ?, 1, unixepoch()) "
                "ON CONFLICT(provider, year_month) DO UPDATE SET "
                "  call_count = call_count + 1, "
                "  updated_at = unixepoch()",
                (provider, ym),
            )
            self._conn.commit()
        except Exception:
            logger.exception("Failed to increment provider usage for %s", provider)

    def get_exa_monthly_usage(self) -> int:
        try:
            ym = time.strftime("%Y-%m", time.gmtime())
            if self._conn is None:
                return 0
            row = self._conn.execute(
                "SELECT COALESCE(call_count, 0) FROM provider_quota_usage "
                "WHERE provider = 'exa_mcp' AND year_month = ?",
                (ym,),
            ).fetchone()
            return row[0] if row else 0
        except Exception:
            logger.exception("Failed to get Exa monthly usage")
            return 0
