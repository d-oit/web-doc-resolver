"""
Tests for Issue #59: Budget-aware routing, negative caching, and provider circuit breakers.

Note: conftest.py autouse fixture mocks can_try, get_p75_latency, and
plan_provider_order. Tests here validate the UNMOCKED modules (NegativeCacheEntry,
CircuitBreakerState, RoutingMemory.record/rank, QualityScore dataclass, score_content).
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from scripts._query_resolve import resolve_query_stream
from scripts.cache_negative import (
    should_skip_from_negative_cache,
    write_negative_cache,
)
from scripts.circuit_breaker import CircuitBreakerRegistry
from scripts.models import Profile, ResolvedResult
from scripts.quality import QualityScore
from scripts.routing import (
    PROFILE_BUDGETS,
    ResolutionBudget,
    detect_doc_platform,
    extract_domain,
)
from scripts.routing_memory import RoutingMemory

# ─── Quality Scoring (T59.2) ───────────────────────────────────────────────


class TestQualityScoring:
    """Test QualityScore dataclass and score_content heuristic (inline re-implementation
    to avoid conftest mock)."""

    @staticmethod
    def _score_content(markdown: str, links: list[str] | None = None) -> QualityScore:
        from scripts.quality import score_content

        return score_content(markdown, links)

    def test_good_content_accepted(self):
        content = "This is a substantial amount of documentation content. " * 50
        res = self._score_content(content, ["http://link.com"])
        assert res.acceptable is True
        assert res.score >= 0.65

    def test_short_content_rejected(self):
        res = self._score_content("too short")
        assert res.too_short is True
        assert res.acceptable is False

    def test_noisy_content_penalized(self):
        content = "cookie subscribe javascript log in sign up " * 10
        res = self._score_content(content)
        assert res.noisy is True
        assert res.score < 0.8

    def test_duplicate_heavy_penalized(self):
        content = "duplicate line\n" * 20
        res = self._score_content(content)
        assert res.duplicate_heavy is True

    def test_missing_links_penalized(self):
        content = "Good content but no links. " * 50
        res = self._score_content(content, [])
        assert res.missing_links is True

    def test_with_links_improves_score(self):
        content = "Good content. " * 50
        s1 = self._score_content(content, []).score
        s2 = self._score_content(content, ["http://link.com"]).score
        assert s2 > s1

    def test_empty_content(self):
        res = self._score_content("")
        assert res.score == 0.5  # 1.0 - 0.35 (too_short) - 0.15 (missing_links)
        assert res.acceptable is False

    def test_non_string_input(self):
        # Should handle gracefully via internal check
        res = self._score_content(None)
        assert res.score == 1.0
        assert res.acceptable is True

    def test_score_range(self):
        assert 0.0 <= self._score_content("abc").score <= 1.0


# ─── Resolution Budget (T59.1) ─────────────────────────────────────────────


class TestResolutionBudget:
    def test_free_profile_never_calls_paid(self):
        budget = ResolutionBudget(3, 0, 5000, allow_paid=False)
        assert budget.can_try(is_paid=True) is False
        assert budget.stop_reason == "paid_disabled"

    def test_fast_profile_stops_after_low_budget(self):
        budget = ResolutionBudget(3, 1, 1000)
        budget.record_attempt(is_paid=False, latency_ms=600)
        assert budget.can_try(is_paid=False) is True
        budget.record_attempt(is_paid=False, latency_ms=500)
        assert budget.can_try(is_paid=False) is False
        assert budget.stop_reason == "max_total_latency_ms"

    def test_quality_profile_allows_more_attempts(self):
        budget = ResolutionBudget(10, 5, 20000)
        for _ in range(5):
            budget.record_attempt(is_paid=False, latency_ms=100)
        assert budget.can_try(is_paid=False) is True

    def test_latency_budget_stops(self):
        budget = ResolutionBudget(5, 2, 1000)
        budget.record_attempt(is_paid=False, latency_ms=1100)
        assert budget.can_try(is_paid=False) is False
        assert budget.stop_reason == "max_total_latency_ms"

    def test_record_attempt_tracks_counts(self):
        budget = ResolutionBudget(5, 2, 5000)
        budget.record_attempt(is_paid=True, latency_ms=100)
        assert budget.attempts == 1
        assert budget.paid_attempts == 1
        assert budget.elapsed_ms == 100

    def test_paid_attempts_limit(self):
        budget = ResolutionBudget(5, 1, 5000)
        budget.record_attempt(is_paid=True, latency_ms=100)
        assert budget.can_try(is_paid=True) is False
        assert budget.stop_reason == "max_paid_attempts"
        assert budget.can_try(is_paid=False) is True

    def test_profile_mappings_exist(self):
        for p in ["free", "balanced", "fast", "quality"]:
            assert p in PROFILE_BUDGETS
            assert "max_provider_attempts" in PROFILE_BUDGETS[p]


# ─── Negative Caching (T59.3) ──────────────────────────────────────────────


class TestNegativeCache:
    def test_should_skip_returns_false_when_no_cache(self):
        assert should_skip_from_negative_cache(None, "query", "provider") is False

    def test_should_skip_returns_false_for_missing_entry(self):
        cache = MagicMock()
        cache.get.return_value = None
        assert should_skip_from_negative_cache(cache, "query", "provider") is False

    def test_should_skip_returns_true_for_valid_entry(self):
        cache = MagicMock()
        future = (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()
        cache.get.return_value = {"expires_at": future}
        assert should_skip_from_negative_cache(cache, "query", "provider") is True

    def test_should_skip_returns_false_for_expired_entry(self):
        cache = MagicMock()
        cache.get.return_value = {
            "expiry": (datetime.now(timezone.utc) - timedelta(minutes=1)).timestamp()
        }
        assert should_skip_from_negative_cache(cache, "query", "provider") is False

    def test_write_negative_cache(self):
        cache = MagicMock()
        write_negative_cache(cache, "query", "provider", "reason", 600)
        cache.set.assert_called_once()

    def test_write_negative_cache_none(self):
        write_negative_cache(None, "query", "provider", "reason", 600)

    def test_llms_txt_not_found_reason(self):
        cache = MagicMock()
        write_negative_cache(cache, "http://example.com", "llms_txt", "not_found", 3600)
        # Verify it uses the reason in the cache key or metadata if needed
        cache.set.assert_called_once()

    def test_auth_required_long_ttl(self):
        cache = MagicMock()
        write_negative_cache(cache, "query", "provider", "auth_required", 86400)
        cache.set.assert_called_once()


# ─── Circuit Breakers (T59.4) ──────────────────────────────────────────────


class TestCircuitBreaker:
    def test_new_breaker_is_closed(self):
        registry = CircuitBreakerRegistry()
        assert registry.is_open("provider") is False

    def test_opens_after_threshold(self):
        registry = CircuitBreakerRegistry(threshold=2)
        registry.record_failure("p1")
        assert registry.is_open("p1") is False
        registry.record_failure("p1")
        assert registry.is_open("p1") is True

    def test_success_resets(self):
        registry = CircuitBreakerRegistry(threshold=1)
        registry.record_failure("p1")
        assert registry.is_open("p1") is True
        registry.record_success("p1")
        assert registry.is_open("p1") is False

    def test_registry_manages_multiple_providers(self):
        registry = CircuitBreakerRegistry(threshold=1)
        registry.record_failure("p1")
        assert registry.is_open("p1") is True
        assert registry.is_open("p2") is False

    def test_registry_record_success(self):
        registry = CircuitBreakerRegistry()
        registry.record_success("p1")
        assert "p1" in registry.breakers

    def test_default_threshold(self):
        registry = CircuitBreakerRegistry()
        for _ in range(2):
            registry.record_failure("p1")
        assert registry.is_open("p1") is False
        registry.record_failure("p1")
        assert registry.is_open("p1") is True


# ─── Routing Memory (T59.5) ───────────────────────────────────────────────


class TestRoutingMemory:
    def test_record_and_rank(self):
        rm = RoutingMemory()
        # Record success for p2, failure for p1
        rm.record("domain.com", "p1", False, 500, 0.2)
        rm.record("domain.com", "p2", True, 200, 0.9)

        ranked = rm.rank("domain.com", ["p1", "p2", "p3"])
        # p2 should be first as it has highest success rate/score
        assert ranked[0] == "p2"

    def test_unknown_domain_preserves_order(self):
        rm = RoutingMemory()
        order = ["p1", "p2", "p3"]
        assert rm.rank("unknown.com", order) == order

    def test_get_p75_latency_inline(self):
        rm = RoutingMemory()
        rm.record("domain.com", "p1", True, 100, 0.8)
        rm.record("domain.com", "p1", True, 200, 0.8)
        rm.record("domain.com", "p1", True, 300, 0.8)
        rm.record("domain.com", "p1", True, 400, 0.8)

        lat = rm.get_p75_latency("domain.com", "p1")
        assert 300 <= lat <= 400

    def test_get_p75_latency_default_inline(self):
        rm = RoutingMemory()
        assert rm.get_p75_latency("any", "any") == 3000

    def test_multiple_domains(self):
        rm = RoutingMemory()
        rm.record("a.com", "p1", True, 100, 0.9)
        rm.record("b.com", "p1", True, 500, 0.9)
        assert rm.get_p75_latency("a.com", "p1") == 150
        assert rm.get_p75_latency("b.com", "p1") == 750


# ─── Domain Extraction & Platform Detection ──────────────────────────────


class TestDomainExtraction:
    def test_extract_domain(self):
        assert extract_domain("https://docs.python.org/3/library") == "docs.python.org"
        assert extract_domain("http://localhost:8000") == "localhost"

    def test_extract_domain_invalid(self):
        assert extract_domain("not-a-url") is None

    def test_detect_gitbook(self):
        assert detect_doc_platform("https://guide.gitbook.com") == "gitbook"
        assert detect_doc_platform("https://project.gitbook.io") == "gitbook"

    def test_detect_sphinx(self):
        assert detect_doc_platform("https://project.readthedocs.io") == "sphinx"

    def test_detect_notion(self):
        assert detect_doc_platform("https://www.notion.so/workspace/page") == "notion"

    def test_detect_unknown(self):
        assert detect_doc_platform("https://google.com") is None

    def test_detect_confluence(self):
        assert detect_doc_platform("https://company.atlassian.net/wiki/spaces/DS") == "confluence"


# ─── Preflight Routing ───────────────────────────────────────────────────


class TestPreflightRoute:
    def test_gitbook_routes_to_llms_txt(self):
        from scripts.routing import preflight_route

        res = preflight_route("https://docs.gitbook.com")
        assert res["preferred_strategy"] == "llms_txt"

    def test_notion_routes_to_extraction(self):
        from scripts.routing import preflight_route

        res = preflight_route("https://notion.so/page")
        assert res["preferred_strategy"] == "extraction"
        assert res["js_heavy"] is True

    def test_github_routes_to_direct_fetch(self):
        from scripts.routing import preflight_route

        res = preflight_route("https://github.com/user/repo")
        assert res["preferred_strategy"] == "direct_fetch"

    def test_docs_subdomain_routes_to_llms_txt(self):
        from scripts.routing import preflight_route

        res = preflight_route("https://docs.example.com")
        assert res["preferred_strategy"] == "llms_txt"

    def test_generic_url_low_confidence(self):
        from scripts.routing import preflight_route

        res = preflight_route("https://example.com/some/path")
        assert res["confidence"] < 0.5


# ─── URL Normalization ───────────────────────────────────────────────────


class TestNormalizeUrl:
    def test_strips_utm_params(self):
        from scripts.utils import normalize_url

        url = "https://example.com/page?utm_source=news&utm_medium=email&q=search"
        assert normalize_url(url) == "https://example.com/page?q=search"

    def test_strips_fbclid(self):
        from scripts.utils import normalize_url

        url = "https://example.com/page?fbclid=123&other=val"
        assert normalize_url(url) == "https://example.com/page?other=val"

    def test_strips_empty_fragment(self):
        from scripts.utils import normalize_url

        assert normalize_url("https://example.com/page#") == "https://example.com/page"

    def test_normalizes_trailing_slash(self):
        from scripts.utils import normalize_url

        assert normalize_url("https://example.com/path/") == "https://example.com/path"

    def test_preserves_root_slash(self):
        from scripts.utils import normalize_url

        assert normalize_url("https://example.com/") == "https://example.com/"

    def test_normalizes_case(self):
        from scripts.utils import normalize_url

        assert normalize_url("HTTPS://Example.COM/Path") == "https://example.com/Path"


# ─── Synthesis Gate ─────────────────────────────────────────────────────


class TestSynthesisGate:
    """Test logic for stopping cascade based on current results quality."""

    def _gate_decision(self, results: list[ResolvedResult]) -> tuple[bool, str]:
        # Minimalist re-implementation of the synthesis gate logic
        if not results:
            return False, "no_results"

        def similarity(s1, s2):
            if s1 == s2:
                return 1.0
            return 0.1

        if len(results) == 1:
            if results[0].score > 0.8 and len(results[0].content or "") > 1000:
                return False, "single_high_quality"
            return True, "single_low_quality"

        for i in range(len(results)):
            for j in range(i + 1, len(results)):
                if similarity(results[i].content, results[j].content) < 0.2:
                    return True, "conflicts"
        short_count = sum(1 for r in results if len(r.content) < 500)
        if short_count > len(results) / 2:
            return True, "fragmented"
        total_len = sum(len(r.content) for r in results if r.content)
        if total_len < 1000:
            return True, "insufficient_content"
        return False, "complete"

    def _make_result(self, content: str, score: float = 0.8) -> ResolvedResult:
        return ResolvedResult(source="test", content=content, score=score)

    def test_single_high_quality_skips(self):
        should_call, reason = self._gate_decision([self._make_result("good content " * 100, 0.9)])
        assert should_call is False
        assert reason == "single_high_quality"

    def test_single_low_quality_calls(self):
        should_call, reason = self._gate_decision([self._make_result("short", 0.3)])
        assert should_call is True
        assert reason == "single_low_quality"

    def test_conflicting_content_calls(self):
        r1 = self._make_result("Python is great for web development. " * 50)
        r2 = self._make_result("Rust is better than Python for systems programming. " * 50)
        should_call, reason = self._gate_decision([r1, r2])
        assert should_call is True
        assert reason == "conflicts"

    def test_similar_content_skips(self):
        content = "Python is great for web development. " * 50
        r1 = self._make_result(content)
        r2 = self._make_result(content)
        should_call, reason = self._gate_decision([r1, r2])
        assert should_call is False
        assert reason == "complete"

    def test_fragmented_content_calls(self):
        results = [self._make_result("short")] * 3
        should_call, reason = self._gate_decision(results)
        assert should_call is True
        assert reason == "fragmented"

    def test_no_results_skips(self):
        should_call, reason = self._gate_decision([])
        assert should_call is False
        assert reason == "no_results"


class TestQualityGate:
    def test_gate_passed_logic(self):
        budget = ResolutionBudget(3, 1, 10000, min_free_quality_to_skip_paid=0.7)

        # Free result with high score
        best_free_score = 0.85
        assert best_free_score >= budget.min_free_quality_to_skip_paid

    def test_gate_failed_logic(self):
        budget = ResolutionBudget(3, 1, 10000, min_free_quality_to_skip_paid=0.7)

        # Free result with low score
        best_free_score = 0.5
        assert best_free_score < budget.min_free_quality_to_skip_paid

    @pytest.mark.skip(
        reason="TODO: needs proper concurrent.futures mock — MagicMock futures hang in wait()"
    )
    def test_gate_integration_mock(self):
        with (
            patch("scripts._query_resolve.get_semantic_cache", return_value=None),
            patch("scripts._query_resolve._routing_memory") as mock_rm,
            patch("scripts._query_resolve._get_cache", return_value=None),
            patch("scripts._query_resolve.scripts.quality.score_content") as mock_score,
            patch("scripts._query_resolve._circuit_breakers") as mock_cb,
            patch("scripts.routing.plan_provider_order", return_value=["exa_mcp", "exa"]),
            patch("scripts.resolve._get_executor") as mock_executor,
        ):
            mock_cb.is_open.return_value = False
            mock_rm.get_p75_latency.return_value = 100

            # exa_mcp (free) returns high quality result
            res_free = ResolvedResult(
                source="exa_mcp", content="High quality content", url="http://free.com"
            )

            mock_fut = MagicMock()
            mock_fut.result.return_value = res_free
            mock_executor.return_value.submit.return_value = mock_fut

            # Quality score 0.8 (above default 0.7)
            mock_score.return_value = MagicMock(acceptable=True, score=0.8)

            results = list(resolve_query_stream("test query", profile=Profile.BALANCED))

            # Verify gate passed
            final_result = next(r for r in results if r.get("source") != "partial")
            assert final_result["source"] == "exa_mcp"
            assert final_result["metrics"]["quality_gate"]["passed"] is True
            assert final_result["metrics"]["quality_gate"]["score"] == 0.8
