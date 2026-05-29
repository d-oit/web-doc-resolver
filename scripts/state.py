"""Shared mutable state for the Web Doc Resolver — eliminates monkey-patching."""

import concurrent.futures

from scripts.circuit_breaker import CircuitBreakerRegistry
from scripts.routing_memory import RoutingMemory

circuit_breakers = CircuitBreakerRegistry()
routing_memory = RoutingMemory()

_executor: concurrent.futures.ThreadPoolExecutor | None = None


def get_executor(max_workers: int = 10) -> concurrent.futures.ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_workers, thread_name_prefix="resolver"
        )
    return _executor
