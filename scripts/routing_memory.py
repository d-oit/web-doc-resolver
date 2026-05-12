"""
Per-domain routing memory for the Web Doc Resolver.
"""

import logging
import sqlite3
import time
from collections import defaultdict
from typing import Any

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
        self.domain_stats: defaultdict[str, defaultdict[str, dict[str, Any]]] = defaultdict(
            lambda: defaultdict(
                lambda: {
                    "success": 0,
                    "failure": 0,
                    "avg_latency_ms": 0.0,
                    "avg_quality": 0.0,
                }
            )
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
            return (success_rate, s["avg_quality"], -s["avg_latency_ms"])

        return sorted(providers, key=provider_score, reverse=True)

    def get_p75_latency(self, domain: str, provider: str, default: int = 2500) -> int:
        domain_map = self.domain_stats.get(domain)
        if domain_map is None:
            return default
        stats = domain_map.get(provider)
        if not stats or stats["avg_latency_ms"] == 0:
            return default
        return int(stats["avg_latency_ms"] * 1.5)

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
