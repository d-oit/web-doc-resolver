from unittest.mock import Mock, patch

import pytest

import scripts.providers_impl
import scripts.quality
import scripts.resolve
import scripts.routing
import scripts.routing_memory
import scripts.synthesis
import scripts.utils


class MemoryCache:
    def __init__(self):
        self.data = {}

    def get(self, key):
        return self.data.get(key)

    def set(self, key, value, expire=None):
        self.data[key] = value

    def clear(self):
        self.data.clear()


@pytest.fixture(autouse=True)
def setup_test_env():
    # Fresh cache for every test to avoid cross-test contamination
    cache = MemoryCache()

    # Apply to all possible locations
    scripts.utils._cache = cache
    if hasattr(scripts.resolve, "_cache"):
        scripts.resolve._cache = cache

    # Mock get_cache to return our memory cache
    with patch("scripts.utils.get_cache", return_value=cache):
        # Reset other globals
        scripts.resolve._routing_memory.domain_stats.clear()
        scripts.resolve._circuit_breakers.breakers.clear()
        scripts.providers_impl._rate_limits.clear()

        # Mock quality check to always pass and return 1.0
        original_score = scripts.quality.score_content
        scripts.quality.score_content = lambda x: Mock(acceptable=True, score=1.0)

        # Mock synthesis to avoid LLM calls
        original_should_synth = scripts.synthesis.should_call_llm_synthesis
        original_merge = scripts.synthesis.deterministic_merge
        scripts.synthesis.should_call_llm_synthesis = lambda x: False
        scripts.synthesis.deterministic_merge = lambda x: "Merged content"

        # Mock budget to always allow
        original_can_try = scripts.routing.ResolutionBudget.can_try
        scripts.routing.ResolutionBudget.can_try = lambda self, is_paid=False: True

        # Force synchronous-like behavior by mocking p75 latency
        original_p75 = scripts.routing_memory.RoutingMemory.get_p75_latency
        scripts.routing_memory.RoutingMemory.get_p75_latency = lambda self, d, p, default=2500: (
            999999
        )

        # Force deterministic order for tests
        original_plan = scripts.routing.plan_provider_order

        def mock_plan(target, is_url, custom_order=None, skip_providers=None, **kwargs):
            if custom_order:
                base = list(custom_order)
            elif is_url:
                base = [
                    "llms_txt",
                    "jina",
                    "firecrawl",
                    "direct_fetch",
                    "mistral_browser",
                    "duckduckgo",
                ]
            else:
                base = ["exa_mcp", "exa", "tavily", "duckduckgo", "mistral_websearch"]

            skip = skip_providers or set()
            return [p for p in base if p not in skip]

        scripts.routing.plan_provider_order = mock_plan

        yield

        # Restore
        scripts.quality.score_content = original_score
        scripts.synthesis.should_call_llm_synthesis = original_should_synth
        scripts.synthesis.deterministic_merge = original_merge
        scripts.routing.ResolutionBudget.can_try = original_can_try
        scripts.routing_memory.RoutingMemory.get_p75_latency = original_p75
        scripts.routing.plan_provider_order = original_plan
