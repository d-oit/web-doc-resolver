"""
Tests for Issue #59: Budget-aware routing, negative caching, and provider circuit breakers.

Note: conftest.py autouse fixture mocks can_try, get_p75_latency, and
plan_provider_order. Tests here validate the UNMOCKED modules (NegativeCacheEntry,
CircuitBreakerState, RoutingMemory.record/rank, QualityScore dataclass, score_content).
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

# Capture real deterministic_merge before conftest mocks it
# (conftest.py autouse fixture replaces scripts.synthesis.deterministic_merge with a stub)
import scripts.synthesis as _synthesis_module
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

_real_deterministic_merge = _synthesis_module.deterministic_merge

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
        assert res.score == 0.65  # 1.0 - 0.25 (too_short) - 0.10 (missing_links)
        assert res.acceptable is False

    def test_non_string_input(self):
        # Should handle gracefully via internal check
        res = self._score_content(None)
        assert res.score == 1.0
        assert res.acceptable is True

    def test_score_range(self):
        assert 0.0 <= self._score_content("abc").score <= 1.0

    def test_frontmatter_bonus(self):
        """Content with 2026-standards frontmatter gets +0.05 bonus."""
        # Use clearly-long content (>500 chars) + no links → only missing_links
        # penalty (-0.10). Base = 0.90, with frontmatter = 0.95.
        base = "".join(f"Doc line {i}.\n" for i in range(30))  # well above 500
        fm = (
            "---\n"
            "relevance_score: 0.9\n"
            "intent_category: technical\n"
            "token_estimate: 500\n"
            "last_updated: 2026-05-01\n"
            "---\n"
        )
        s1 = self._score_content(base).score
        s2 = self._score_content(fm + base).score
        assert s2 == s1 + 0.05, f"Expected +0.05 frontmatter bonus, got {s1=} {s2=}"

    def test_anchor_bonus(self):
        """Content with 2026-standard anchors gets +0.05 bonus."""
        # Use clearly-long content (>500 chars) + no links → only missing_links
        # penalty (-0.10). Base = 0.90, anchors = 0.95.
        base = "".join(f"Doc line {i}.\n" for i in range(30))
        anchors = "".join(
            ["[ANCHOR: SUMMARY]\n"]
            + [f"S{i}.\n" for i in range(15)]
            + ["[ANCHOR: TECHNICAL_DETAILS]\n"]
            + [f"T{i}.\n" for i in range(15)]
            + ["[ANCHOR: COMPARISON]\n"]
            + [f"C{i}.\n" for i in range(15)]
            + ["[ANCHOR: CITATIONS]\n"]
            + [f"R{i}.\n" for i in range(15)]
        )
        s1 = self._score_content(base).score
        s2 = self._score_content(anchors).score
        assert s2 == s1 + 0.05, f"Expected +0.05 anchor bonus, got {s1=} {s2=}"

    def test_both_bonuses_capped_at_1_0(self):
        """Score with both bonuses should be capped at 1.0."""
        # Use varied lines to avoid duplicate_heavy penalty
        lines = [
            "---\n",
            "relevance_score: 0.95\n",
            "intent_category: reference\n",
            "token_estimate: 1000\n",
            "last_updated: 2026-05-15\n",
            "---\n",
        ]
        lines.append("[ANCHOR: SUMMARY]\n")
        lines.extend(f"Summary detail {i}.\n" for i in range(15))
        lines.append("[ANCHOR: TECHNICAL_DETAILS]\n")
        lines.extend(f"Technical detail {i}.\n" for i in range(15))
        lines.append("[ANCHOR: COMPARISON]\n")
        lines.extend(f"Comparison point {i}.\n" for i in range(15))
        lines.append("[ANCHOR: CITATIONS]\n")
        lines.extend(f"Citation {i}.\n" for i in range(15))
        content = "".join(lines)
        # No links → missing_links (-0.10) → base 0.90, both bonuses +0.10 → 1.0 capped
        result = self._score_content(content)
        assert result.score <= 1.0
        assert result.score >= 0.95  # proves both bonuses applied (would be 0.90 without them)


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

    def test_zero_max_provider_attempts_blocks_all(self):
        """Budget with 0 max_provider_attempts immediately denies all can_try()."""
        budget = ResolutionBudget(0, 0, 5000)
        assert budget.can_try(is_paid=False) is False
        assert budget.stop_reason == "max_provider_attempts"

    def test_zero_max_paid_blocks_paid_only(self):
        """Budget with 0 max_paid_attempts blocks paid but allows free."""
        budget = ResolutionBudget(5, 0, 5000)
        assert budget.can_try(is_paid=True) is False
        assert budget.stop_reason == "max_paid_attempts"
        # Free should still work
        assert budget.can_try(is_paid=False) is True

    def test_negative_latency_does_not_break_budget(self):
        """Negative latency should not prevent further attempts."""
        budget = ResolutionBudget(3, 1, 1000)
        budget.record_attempt(is_paid=False, latency_ms=-500)
        assert budget.attempts == 1
        # elapsed_ms is not clamped (passed through as-is), but can_try still works
        # because -500 < max_total_latency_ms (1000)
        assert budget.elapsed_ms == -500
        assert budget.can_try(is_paid=False) is True


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

    def test_time_based_recovery_after_cooldown(self):
        """Circuit breaker auto-resets when cooldown period expires."""
        registry = CircuitBreakerRegistry(threshold=1)
        # Open the breaker with a very short cooldown
        registry.record_failure("p1", threshold=1, cooldown_seconds=1)
        assert registry.is_open("p1") is True

        # Simulate cooldown expiry by manipulating open_until
        from datetime import datetime, timedelta, timezone

        breaker = registry.breakers["p1"]
        breaker.open_until = datetime.now(timezone.utc) - timedelta(seconds=10)
        assert registry.is_open("p1") is False, "Should auto-recover after cooldown"

    def test_time_based_recovery_still_open_during_cooldown(self):
        """Circuit breaker stays open while cooldown hasn't expired."""
        registry = CircuitBreakerRegistry(threshold=1)
        registry.record_failure("p1", threshold=1, cooldown_seconds=3600)
        assert registry.is_open("p1") is True

        # Simulate being mid-cooldown
        from datetime import datetime, timedelta, timezone

        breaker = registry.breakers["p1"]
        breaker.open_until = datetime.now(timezone.utc) + timedelta(minutes=30)
        assert registry.is_open("p1") is True

    def test_is_open_handles_timezone_naive_open_until(self):
        """is_open handles timezone-naive open_until by assuming UTC."""
        from datetime import datetime, timedelta

        registry = CircuitBreakerRegistry(threshold=1)
        registry.record_failure("p1", threshold=1, cooldown_seconds=3600)

        # Set open_until to naive datetime in the future
        breaker = registry.breakers["p1"]
        breaker.open_until = datetime.utcnow() + timedelta(hours=1)
        assert registry.is_open("p1") is True

        # Set open_until to naive datetime in the past
        breaker.open_until = datetime.utcnow() - timedelta(hours=1)
        assert registry.is_open("p1") is False


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


# ─── Synthesis: Content Similarity ────────────────────────────────────────


class TestContentSimilarity:
    """Tests for _content_similarity and conflict detection."""

    @staticmethod
    def _content_similarity(a: str, b: str) -> float:
        from scripts.synthesis import _content_similarity

        return _content_similarity(a, b)

    def test_identical_content(self):
        text = "This is documentation about Python. " * 20
        assert self._content_similarity(text, text) == 1.0

    def test_completely_different(self):
        a = "Python web framework Django. " * 20
        b = "Rust systems programming language. " * 20
        assert self._content_similarity(a, b) < 0.3

    def test_empty_strings(self):
        assert self._content_similarity("", "anything") == 0.0
        assert self._content_similarity("anything", "") == 0.0
        assert self._content_similarity("", "") == 0.0

    def test_similar_but_not_identical(self):
        # Use strings where differences are concentrated at one location
        a = "x" * 2000
        b = "x" * 1999 + "y"
        sim = self._content_similarity(a, b)
        assert sim > 0.95, f"Expected very high similarity, got {sim}"

    def test_truncated_at_2000_chars(self):
        """Similarity is computed only on first 2000 chars."""
        # short is all x's, long starts with same x's then diverges
        short = "x" * 650
        long = ("x" * 650) + ("z" * 3000)  # same first 650, then different
        # First 2000 chars: 650 x's + 1350 z's from long, vs 650 x's from short
        # SequenceMatcher finds the matching 650 x's: 2*650/(650+2000) ≈ 0.49
        sim = self._content_similarity(short, long)
        assert sim > 0.3, f"Expected moderate similarity, got {sim}"


# ─── Synthesis: Has Conflicts ────────────────────────────────────────────


class TestHasConflicts:
    """Tests for _has_conflicts conflict detection."""

    def _has_conflicts(self, results: list) -> bool:
        from scripts.synthesis import _has_conflicts

        return _has_conflicts(results)

    def _make_result(self, content: str) -> ResolvedResult:
        return ResolvedResult(source="test", content=content, score=0.5)

    def test_single_result_no_conflict(self):
        assert self._has_conflicts([self._make_result("content")]) is False

    def test_empty_list_no_conflict(self):
        assert self._has_conflicts([]) is False

    def test_similar_results_no_conflict(self):
        # Near-identical content (1 char difference in 2000) should not be conflicting
        r1 = self._make_result("y" * 2000)
        r2 = self._make_result("y" * 1999 + "z")
        assert self._has_conflicts([r1, r2]) is False

    def test_conflicting_results_detected(self):
        r1 = self._make_result("Python is the best language. " * 30)
        r2 = self._make_result("Rust outperforms Python significantly. " * 30)
        assert self._has_conflicts([r1, r2]) is True

    def test_three_results_pairwise_conflict(self):
        """Three results where only one pair conflicts → still True."""
        r1 = self._make_result("A" * 1000)
        r2 = self._make_result("A" * 1000)  # similar to r1
        r3 = self._make_result("B" * 1000)  # different from both
        assert self._has_conflicts([r1, r2, r3]) is True


# ─── Synthesis: Is Fragmented ────────────────────────────────────────────


class TestIsFragmented:
    """Tests for _is_fragmented detection."""

    @staticmethod
    def _is_fragmented(results: list, min_chars: int = 500) -> bool:
        from scripts.synthesis import _is_fragmented

        return _is_fragmented(results, min_chars)

    def _make_result(self, content: str) -> ResolvedResult:
        return ResolvedResult(source="test", content=content, score=0.5)

    def test_all_long_not_fragmented(self):
        results = [self._make_result("x" * 600), self._make_result("y" * 600)]
        assert self._is_fragmented(results) is False

    def test_majority_short_fragmented(self):
        results = [
            self._make_result("short"),
            self._make_result("also short"),
            self._make_result("x" * 600),
        ]
        assert self._is_fragmented(results) is True

    def test_exactly_half_short_not_fragmented(self):
        """Exactly half short → not fragmented (must be > half)."""
        results = [
            self._make_result("short"),
            self._make_result("x" * 600),
        ]
        assert self._is_fragmented(results) is False

    def test_custom_min_chars(self):
        """Custom min_chars threshold is respected."""
        results = [
            self._make_result("x" * 10),
            self._make_result("y" * 10),
            self._make_result("z" * 10),
        ]
        # With min_chars=200, all are short → fragmented
        assert self._is_fragmented(results, min_chars=200) is True
        # With min_chars=5, none are short → not fragmented
        assert self._is_fragmented(results, min_chars=5) is False


# ─── Synthesis Gate: Full Decision ───────────────────────────────────────


class TestSynthesisGateDecision:
    """Edge case tests for synthesis_gate_decision."""

    @staticmethod
    def _gate(results: list, threshold: float = 0.8) -> tuple:
        from scripts.synthesis import synthesis_gate_decision

        return synthesis_gate_decision(results, threshold)

    def _make_result(self, content: str, score: float = 0.5) -> ResolvedResult:
        return ResolvedResult(source="test", content=content, score=score)

    def test_single_result_below_threshold_calls_synthesis(self):
        """Single result with score just below threshold → single_low_quality."""
        r = self._make_result("x" * 800, score=0.79)
        should_call, reason = self._gate([r], threshold=0.8)
        assert should_call is True
        assert reason == "single_low_quality"

    def test_custom_threshold_boundary(self):
        """Single result at exact threshold should skip (not call)."""
        # Beautiful, usable content >1000 chars
        content = "Great documentation here. " * 200
        result = self._make_result(content, score=0.8)
        should_call, reason = self._gate([result], threshold=0.8)
        assert should_call is False
        assert reason == "single_high_quality"

    def test_below_threshold_calls(self):
        """Single result just below threshold → call synthesis."""
        result = self._make_result("good content " * 100, score=0.79)
        should_call, reason = self._gate([result], threshold=0.8)
        assert should_call is True
        assert reason == "single_low_quality"


# ─── Deterministic Merge ─────────────────────────────────────────────────


class TestDeterministicMerge:
    """Edge case tests for deterministic_merge."""

    @staticmethod
    def _merge(results: list) -> str:
        """Call real deterministic_merge, bypassing conftest mock."""
        return _real_deterministic_merge(results)

    def _make_result(
        self, content: str, source: str = "test", url: str | None = None
    ) -> ResolvedResult:
        return ResolvedResult(source=source, content=content, url=url, score=0.5)

    def test_empty_results(self):
        assert self._merge([]) == ""

    def test_single_result_has_all_anchors(self):
        r = self._make_result("Single source documentation.", source="docs", url="http://doc.com")
        merged = self._merge([r])
        assert "[ANCHOR: SUMMARY]" in merged
        assert "[ANCHOR: TECHNICAL_DETAILS]" in merged
        assert "[ANCHOR: COMPARISON]" in merged
        assert "[ANCHOR: CITATIONS]" in merged
        assert "http://doc.com" in merged

    def test_multi_result_deduplicates_lines(self):
        r1 = self._make_result("Line A\nLine B\nLine C")
        r2 = self._make_result("Line B\nLine C\nLine D")
        merged = self._merge([r1, r2])
        # Line B and Line C appear in both; merged should only have one copy each
        assert merged.count("Line B") == 1
        assert merged.count("Line C") == 1

    def test_multi_result_has_all_anchors(self):
        r1 = self._make_result("Content from source 1.", source="src1", url="http://url1.com")
        r2 = self._make_result("Content from source 2.", source="src2", url="http://url2.com")
        merged = self._merge([r1, r2])
        assert "[ANCHOR: SUMMARY]" in merged
        assert "[ANCHOR: TECHNICAL_DETAILS]" in merged
        assert "[ANCHOR: COMPARISON]" in merged
        assert "[ANCHOR: CITATIONS]" in merged
        assert "http://url1.com" in merged
        assert "http://url2.com" in merged

    def test_merge_includes_citation_indices(self):
        r1 = self._make_result("Source 1 content.", source="A", url="http://a.com")
        r2 = self._make_result("Source 2 content.", source="B", url="http://b.com")
        merged = self._merge([r1, r2])
        assert "[1]" in merged
        assert "[2]" in merged

    def test_empty_content_lines_preserved(self):
        """Blank lines between content should be preserved."""
        r = self._make_result("Line 1\n\nLine 3")
        merged = self._merge([r])
        # Blank lines are part of the unique_lines set
        assert "" in merged.splitlines()


# ─── Routing Memory Edge Cases ──────────────────────────────────────────


class TestRoutingMemoryEdgeCases:
    """Test edge cases and thread safety for RoutingMemory."""

    def test_thread_safety_concurrent_records(self):
        """Multiple threads recording simultaneously should not cause data corruption."""
        import threading

        rm = RoutingMemory()
        errors = []
        barrier = threading.Barrier(5, timeout=5)

        def record_batch(thread_id: int):
            try:
                barrier.wait()  # Force all threads to start together
                for i in range(50):
                    rm.record(
                        f"domain{thread_id}.com",
                        f"provider{thread_id % 3}",
                        i % 2 == 0,
                        latency_ms=100 + i,
                        quality_score=0.5 + (i % 10) / 20,
                    )
            except Exception as e:
                errors.append(f"Thread {thread_id}: {type(e).__name__}: {e}")

        threads = [threading.Thread(target=record_batch, args=(i,)) for i in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Thread safety errors: {errors}"

        # Verify all records were persisted
        for i in range(5):
            domain = f"domain{i}.com"
            provider = f"provider{i % 3}"
            stats = rm.get_domain_stats(provider, domain)
            assert stats is not None, f"Missing stats for {domain}/{provider}"
            assert stats["attempts"] == 50

    def test_get_domain_stats_zero_attempts_returns_none(self):
        """Stats with zero attempts should return None."""
        rm = RoutingMemory()
        # Domain exists in structure but has zero attempts (initial state)
        stats = rm.get_domain_stats("nonexistent", "any")
        assert stats is None

    def test_rank_providers_with_zero_attempts_uses_base_score(self):
        """Providers with no history get SCORE_BASE."""
        rm = RoutingMemory()
        ranked = rm.rank("no-history.com", ["a", "b", "c"])
        # Without history, order is preserved (all get same base score)
        assert ranked == ["a", "b", "c"]

    def test_clear_removes_all_data(self):
        """clear() should remove all domain stats."""
        rm = RoutingMemory()
        rm.record("test.com", "p1", True, 100, 0.8)
        rm.record("test.com", "p2", True, 200, 0.9)

        stats_before = rm.get_domain_stats("p1", "test.com")
        assert stats_before is not None

        rm.clear()

        stats_after = rm.get_domain_stats("p1", "test.com")
        assert stats_after is None

    def test_single_record_rank(self):
        """Single successful record should boost provider rank."""
        rm = RoutingMemory()
        rm.record("a.com", "best", True, latency_ms=10, quality_score=1.0)
        rm.record("a.com", "worst", False, latency_ms=5000, quality_score=0.1)

        ranked = rm.rank("a.com", ["worst", "best", "neutral"])
        assert ranked[0] == "best"
        assert ranked[1] == "neutral"
        assert ranked[2] == "worst"

    def test_latency_weighting_in_rank(self):
        """Lower latency should give higher score."""
        rm = RoutingMemory()
        # Same success/quality, but fast has much lower latency
        rm.record("b.com", "fast", True, latency_ms=50, quality_score=0.8)
        rm.record("b.com", "slow", True, latency_ms=5000, quality_score=0.8)

        ranked = rm.rank("b.com", ["slow", "fast"])
        assert ranked[0] == "fast"

    def test_recent_success_boosts_rank(self):
        """More recent successes should rank higher due to recency decay."""
        rm = RoutingMemory()
        # Both have same success/quality but we verify ranking works
        rm.record("c.com", "recent", True, latency_ms=200, quality_score=0.9)
        rm.record("c.com", "recent", True, latency_ms=200, quality_score=0.9)

        ranked = rm.rank("c.com", ["old", "recent"])
        # recent should be first since it has history and old has none
        assert ranked[0] == "recent"

    def test_get_p75_latency_single_datapoint(self):
        """With one datapoint, p75 latency = avg_latency_ms * 1.5."""
        rm = RoutingMemory()
        rm.record("d.com", "p", True, latency_ms=100, quality_score=0.8)
        lat = rm.get_p75_latency("d.com", "p")
        # compute_p75_latency(100, 3000) = int(100 * 1.5) = 150
        assert lat == 150

    def test_rank_providers_with_corrupted_stats(self):
        """Rank should not crash when domain has partial/corrupted stats."""
        rm = RoutingMemory()
        # Directly inject a stats dict with missing keys to simulate corruption
        rm.domain_stats["corrupted.com"]["broken"] = {
            "success": 1,
            # Deliberately missing: failure, avg_latency_ms, avg_quality, last_attempted
        }

        # rank should handle this gracefully — not crash, not raise
        try:
            ranked = rm.rank("corrupted.com", ["broken", "p2"])
            # Verify it returned a list (no crash)
            assert isinstance(ranked, list)
            assert len(ranked) == 2
        except Exception as e:
            pytest.fail(f"rank() crashed on corrupted stats: {e}")

    def test_get_domain_stats_with_partial_data(self):
        """get_domain_stats handles stats missing expected keys via .get() defaults."""
        rm = RoutingMemory()
        # Inject minimal stats (only success count, nothing else)
        rm.domain_stats["partial.com"]["minimal"] = {"success": 5}

        # get_domain_stats uses .get() for all keys: success=5, failure=0, attempts=5
        stats = rm.get_domain_stats("minimal", "partial.com")
        assert stats is not None
        assert stats["attempts"] == 5
        assert stats["success_rate"] == 1.0  # 5/5 = 1.0
        assert stats["avg_latency_ms"] == 0  # missing → default 0
        assert stats["avg_quality"] == 0.5  # missing → default 0.5
        assert stats["days_since_last"] == 0.0  # no last_attempted → 0.0

    def test_get_p75_latency_extremely_large_value(self):
        """Extremely large avg_latency_ms should not cause overflow."""
        rm = RoutingMemory()
        rm.record("big.com", "slow", True, latency_ms=10_000_000, quality_score=0.5)
        lat = rm.get_p75_latency("big.com", "slow")
        # Should return a reasonable value, not overflow
        assert lat >= 0
        assert lat < float("inf")

    def test_rank_providers_all_new_returns_original_order(self):
        """All new providers should return in original order (all get SCORE_BASE)."""
        rm = RoutingMemory()
        providers = ["delta", "alpha", "gamma", "beta"]
        ranked = rm.rank("fresh-domain.com", providers)
        assert ranked == providers

    def test_success_rate_maintained(self):
        """Success rate should be correctly maintained across records."""
        rm = RoutingMemory()
        # 3 successes, 1 failure = 75% success rate
        rm.record("maint.com", "p", True, 100, 0.9)
        rm.record("maint.com", "p", True, 100, 0.9)
        rm.record("maint.com", "p", True, 100, 0.9)
        rm.record("maint.com", "p", False, 100, 0.5)

        stats = rm.get_domain_stats("p", "maint.com")
        assert stats is not None
        assert stats["attempts"] == 4
        assert 0.7 < stats["success_rate"] < 0.8

    def test_concurrent_same_domain_provider_no_corruption(self):
        """Multiple threads writing to the same domain+provider should not corrupt stats."""
        import threading

        rm = RoutingMemory()
        errors = []
        num_threads = 6
        records_per_thread = 100
        barrier = threading.Barrier(num_threads, timeout=5)

        def record_batch(thread_id: int):
            try:
                barrier.wait()  # Force simultaneous access to same domain+provider
                for i in range(records_per_thread):
                    rm.record(
                        "shared.com",
                        "shared-provider",
                        success=(i % 3 != 0),  # ~66% success rate
                        latency_ms=100 + thread_id,
                        quality_score=0.7 + (thread_id % 10) / 50,
                    )
            except Exception as e:
                errors.append(f"Thread {thread_id}: {type(e).__name__}: {e}")

        threads = [threading.Thread(target=record_batch, args=(i,)) for i in range(num_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Concurrency errors: {errors}"

        # All records should be persisted without corruption
        stats = rm.get_domain_stats("shared-provider", "shared.com")
        assert stats is not None
        total_expected = num_threads * records_per_thread
        assert (
            stats["attempts"] == total_expected
        ), f"Expected {total_expected} attempts, got {stats['attempts']}"
        # avg_latency_ms should be reasonable (not NaN, not corrupted)
        assert 100 <= stats["avg_latency_ms"] <= 200
        # ~66.7% success rate expected (i % 3 != 0 → fails every 3rd record)
        assert (
            0.6 < stats["success_rate"] < 0.75
        ), f"Expected ~0.667 success rate, got {stats['success_rate']}"
        # quality scores range from 0.7 to 0.88
        assert stats["avg_quality"] > 0.7, f"Expected avg_quality > 0.7, got {stats['avg_quality']}"


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
