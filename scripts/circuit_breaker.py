"""
Circuit breaker logic for the Web Doc Resolver.
"""

import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass
class CircuitBreakerState:
    failures: int = 0
    open_until: datetime | None = None

    def is_open(self) -> bool:
        now = datetime.now(timezone.utc)
        if self.open_until is None:
            return False
        # Ensure self.open_until is timezone-aware for comparison if it's not already
        target = self.open_until
        if target.tzinfo is None:
            target = target.replace(tzinfo=timezone.utc)
        return target > now

    def record_failure(self, threshold: int = 3, cooldown_seconds: int = 300) -> None:
        self.failures += 1
        if self.failures >= threshold:
            self.open_until = datetime.now(timezone.utc) + timedelta(seconds=cooldown_seconds)

    def record_success(self) -> None:
        self.failures = 0
        self.open_until = None


class CircuitBreakerRegistry:
    def __init__(self, threshold: int = 3):
        self.breakers: dict[str, CircuitBreakerState] = {}
        self.default_threshold = threshold
        self._lock = threading.Lock()

    def get_breaker(self, provider: str) -> CircuitBreakerState:
        with self._lock:
            if provider not in self.breakers:
                self.breakers[provider] = CircuitBreakerState()
            return self.breakers[provider]

    def is_open(self, provider: str) -> bool:
        return self.get_breaker(provider).is_open()

    def record_failure(
        self, provider: str, threshold: int | None = None, cooldown_seconds: int = 300
    ) -> None:
        resolved = threshold if threshold is not None else self.default_threshold
        with self._lock:
            breaker = self.breakers.get(provider)
            if breaker is None:
                breaker = CircuitBreakerState()
                self.breakers[provider] = breaker
            breaker.record_failure(resolved, cooldown_seconds)

    def record_success(self, provider: str) -> None:
        with self._lock:
            if provider not in self.breakers:
                self.breakers[provider] = CircuitBreakerState()
            self.breakers[provider].record_success()

    def clear(self) -> None:
        with self._lock:
            self.breakers.clear()
