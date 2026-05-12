import logging
from typing import TypedDict

logger = logging.getLogger(__name__)


class ProviderStatsDict(TypedDict):
    success: int
    failure: int
    avg_latency_ms: float
    avg_quality: float
    last_attempted: float | None


DEFAULT_PROVIDER_STATS: ProviderStatsDict = {
    "success": 0,
    "failure": 0,
    "avg_latency_ms": 0.0,
    "avg_quality": 0.0,
    "last_attempted": None,
}


def compute_p75_latency(avg_latency_ms: float, default: int = 3000) -> int:
    if avg_latency_ms == 0:
        return default
    return int(avg_latency_ms * 1.5)
