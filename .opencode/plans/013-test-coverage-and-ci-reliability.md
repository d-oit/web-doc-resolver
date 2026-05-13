# ADR-013: Test Coverage & CI Reliability

**Date:** 2026-05-12
**Status:** Proposed
**Context:** The test suite has critical coverage gaps, misleading tests that pass without validating real behavior, and CI infrastructure issues that mask failures. Two core resolution paths (`resolve_url_stream` and `resolve_query_stream`) have zero working tests. 7 of 10 provider functions have no unit tests. The only existing integration tests replace core logic with stubs.

---

## Goal

Achieve meaningful test coverage of all critical paths, eliminate misleading tests, fix CI infrastructure issues, and ensure quality gates actually catch regressions.

---

## GOAP Waves

### Wave 1: Fix Misleading & Hollow Tests (Day 1)

| ID | File | Action | Severity |
|----|------|--------|----------|
| M1 | `tests/conftest.py:46-49` | Remove `should_call_llm_synthesis = lambda x: False` and `deterministic_merge = lambda x: "Merged content"` stubs. Add `conftest.py` fixtures that optionally mock synthesis but default to real behavior | HIGH |
| M2 | `tests/conftest.py:54-71` | Remove `plan_provider_order` monkey-patch. Test the real routing logic; use `skip_providers` parameter for targeted tests instead of bypassing routing entirely | HIGH |
| M3 | `tests/test_routing_foundation.py:371-439` | Delete `TestSynthesisGate._gate_decision()` re-implementation. Import and test the real `scripts/synthesis.synthesis_gate_decision()` function | HIGH |
| M4 | `tests/test_routing_foundation.py:442-456` | Replace `test_gate_passed_logic` (which tests `0.85 >= 0.7`) with a test that calls `ResolutionBudget.is_expired()` and `synthesis_gate_decision()` | MEDIUM |
| M5 | `test_quality_real.py:43-46` | Remove `test_score_content_non_string` test that validates a mock workaround. Add `pytest.raises(TypeError)` test for `None`/non-string input after Q1 fix removes the `isinstance` branch | MEDIUM |
| M6 | `tests/test_ssrf_repro.py:18-22` | Add test that exercises real `is_safe_url()` and `validate_url()` logic without mocking `_safe_request`. Current test mocks the only meaningful code path | MEDIUM |
| M7 | `tests/test_resolve.py:72,91` | Stop overriding `scripts.resolve._cache = None` which bypasses the conftest `MemoryCache` fixture | LOW |

### Wave 2: Cover Critical Untested Paths (Day 2-3)

| ID | File | Action | Severity |
|----|------|--------|----------|
| C1 | `tests/test_url_resolve.py` (new) | Create test file for `resolve_url_stream()`: test concurrent futures, budget enforcement, quality gate early exit, negative cache recording, circuit breaker integration. Mock provider functions but exercise the real cascade logic | HIGH |
| C2 | `tests/test_query_resolve.py` (new) | Create test file for `resolve_query_stream()`: same pattern as C1 — mock providers, exercise real cascade, budget, quality gate, negative cache, circuit breaker | HIGH |
| C3 | `tests/test_providers.py` (new) | Add mocked unit tests for: `resolve_with_jina`, `resolve_with_exa`, `resolve_with_exa_mcp`, `resolve_with_tavily`, `resolve_with_serper`, `resolve_with_mistral_websearch`. Each should test: success path, timeout, rate limit response, invalid content | HIGH |
| C4 | `tests/test_synthesis.py` (new) | Test real `synthesis.py` functions: `_content_similarity`, `_has_conflicts`, `_is_fragmented`, `deterministic_merge`, `synthesis_gate_decision`. Test edge cases: empty strings, duplicate results, fragmented content, all-same results | HIGH |
| C5 | `tests/test_utils_critical.py` (new) | Test `extract_text_from_html()`, `compact_content()`, `is_safe_url()` (direct), `normalize_query()`, `validate_links()`, `score_domain_trust()` (renamed from `score_result`), `create_session_with_retry()` | MEDIUM |
| C6 | `tests/test_models.py` (extend) | Add tests for `Profile.is_provider_allowed()`, `Profile.max_hops()`, `ProviderType.is_paid()`, `ProviderType.is_fast()`, `ResolvedResult.to_dict()`, `ResolveMetrics.record_provider()`, `ValidationResult` defaults | MEDIUM |
| C7 | `tests/test_cli.py` (new) | Test `scripts/cli.py`: argument parsing, `--provider`, `--skip`, `--json`, `--profile` flags, output formatting | LOW |

### Wave 3: Fix CI Infrastructure (Day 3-4)

| ID | File | Action | Severity |
|----|------|--------|----------|
| I1 | `.github/workflows/ci.yml:106` | Fix coverage upload condition: change `matrix.python-version == env.PYTHON_VERSION` to `${{ matrix.python-version == env.PYTHON_VERSION }}` — current YAML comparison never evaluates as an expression | HIGH |
| I2 | `.github/workflows/gitleaks.yml:5-6` | Remove `master` and `develop` branch triggers; only `main` exists. Add `paths-ignore` for `*.md` if appropriate | MEDIUM |
| I3 | `.github/workflows/gitleaks.yml:21` | Update `actions/checkout` from `v4.2.2` to `v6.0.2` to match all other workflows | MEDIUM |
| I4 | `.github/workflows/ci.yml:69` | Install lint dependencies from `requirements.txt` or `pyproject.toml` instead of ad-hoc `pip install ruff black mypy types-requests` | MEDIUM |
| I5 | `.pre-commit-config.yaml:34` | Change shellcheck severity from `warning` to `error` to match AGENTS.md policy | MEDIUM |
| I6 | `web/package.json:51` | Fix `typescript: "^6.0.3"` to `"^5.x"` or valid version. TypeScript 6.x does not exist | HIGH |
| I7 | `web/package.json:23` | Fix `next: "^16.2.6"` to a valid Next.js version. 16.x has not been released | HIGH |
| I8 | `web/package.json:29/55` | Remove duplicate `overrides` key for `@ungap/structured-clone` | MEDIUM |

### Wave 4: Fix Pre-commit Hooks & Config Consistency (Day 4)

| ID | File | Action | Severity |
|----|------|--------|----------|
| K1 | `scripts/setup-hooks.sh` | Replace minimal hook with the comprehensive `scripts/pre-commit-hook.sh` that runs `validate_docs.py --fix` then `quality_gate.sh`. Or source the comprehensive hook from `.githooks/` | MEDIUM |
| K2 | `.githooks/pre-commit` | Verify this hook calls `quality_gate.sh` (it does). Add symlink from `.git/hooks/pre-commit` to `.githooks/pre-commit` in setup script | LOW |
| K3 | `.pre-commit-config.yaml` | Remove the duplicate `quality_gate.sh` local hook since `.githooks/pre-commit` already calls it, OR keep only the pre-commit framework hook and remove `.githooks/pre-commit` | LOW |
| K4 | `requirements.txt` | Reconcile with `pyproject.toml`: change `duckduckgo-search>=6.0.0` to `ddgs>=6.0.0` (correct package name). Remove `flake8` (redundant with `ruff`). Fix `mistralai` comment about PyPI removal | HIGH |
| K5 | `pyproject.toml:16-18` | Add Python 3.13 classifier if CI tests it. Add `py313` to `black` target-version | MEDIUM |
| K6 | `commitlint.config.cjs` | Add `type-enum` rule matching AGENTS.md allowed types: `build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test` | LOW |
| K7 | `close-resolved-issues.yml:4` | Change `pull_request_target` to `pull_request` with explicit permission scope, or add `if: github.event.pull_request.merged == true` guard | MEDIUM |

### Wave 5: Fix Flaky & Anti-Pattern Tests (Day 4-5)

| ID | File | Action | Severity |
|----|------|--------|----------|
| F1 | `tests/test_semantic_cache_bench.py:80-94` | Add `@pytest.mark.slow` marker. Increase latency thresholds for CI (300ms avg, 800ms max). Skip on CI unless `RUN_BENCH` env var is set | MEDIUM |
| F2 | `tests/test_live_api_integrations.py` | Change `pytest.skip()` on `None` results to `pytest.xfail()` with reason. Distinguish "no API key" (skip) from "provider broken" (xfail) | MEDIUM |
| F3 | `tests/test_routing_env_override.py:23-29` | Replace `importlib.reload(scripts.routing)` with `pytest.monkeypatch` for env var patching. Module reload can corrupt other tests | MEDIUM |
| F4 | `tests/conftest.py:34-43` | Replace direct `_routing_memory.domain_stats.clear()` / `_circuit_breakers.breakers.clear()` / `_rate_limits.clear()` with proper fixtures using `monkeypatch` or autouse teardown | MEDIUM |
| F5 | `tests/conftest.py:76-79` | Wrap restoration of `should_call_llm_synthesis`, `deterministic_merge`, `plan_provider_order` in `try/finally` to ensure cleanup even on exception | MEDIUM |
| F6 | `tests/test_tiered_ttl.py:32-35` | Remove no-op `test_config_file_loading` or implement it properly | LOW |
| F7 | `tests/bench_quality.py` | Move to `benchmarks/` directory. Add `@pytest.mark.benchmark` marker. Document that it's not a standard pytest target | LOW |
| F8 | `tests/integration/test_cli_markdown.py:6` | Make `CLI_PATH` configurable via env var with sensible default for CI vs local development | LOW |
| F9 | `.github/workflows/cleanup.yml:166` | Remove `continue-on-error: true` from quality gate step. Failures should be visible | MEDIUM |
| F10 | `.github/workflows/nightly-bridge.yml:67-81` | Change auto-format push to create a PR instead of pushing directly to `main`. Use `create-pull-request` action | MEDIUM |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Removing conftest stubs breaks many existing tests | High | Stage removal: first add real tests, then disable stubs, then remove |
| Adding stream resolution tests requires mocking `concurrent.futures` | Medium | Use real `ThreadPoolExecutor` with mocked provider functions; test budget/quality gates |
| CI coverage fix may reveal previously hidden failures | Medium | Fix failures before enabling coverage enforcement |
| Reconciling dependencies may break other packages | Medium | Test in CI with `pip install -e .` from clean venv |

## Postconditions

1. `resolve_url_stream` and `resolve_query_stream` have working test coverage
2. All 10 provider functions have at least mocked unit tests
3. `synthesis.py` tested with real functions (not re-implementations)
4. CI coverage uploads succeed and report real coverage
5. Web `package.json` has valid dependency versions
6. Three pre-commit hooks consolidated to one path
7. Shellcheck severity matches AGENTS.md policy (`error`)
8. No no-op tests; no `pass` test bodies
9. Flaky tests marked `@pytest.mark.slow` with appropriate thresholds

## Related ADRs

- [ADR-012](012-correctness-and-safety-fixes.md) — Correctness fixes that enable meaningful testing
- [ADR-014](014-architecture-and-parity.md) — Architecture consolidation that reduces test surface area
- [ADR-009](009-cross-runtime-analysis.md) — Cross-runtime parity findings

---

## Summary Table

| # | Finding | Severity | Wave | Effort |
|---|---------|----------|------|--------|
| M1-M7 | Misleading/hollow tests (7 items) | HIGH | 1 | M |
| C1-C7 | Uncovered critical paths (7 items) | HIGH | 2 | L |
| I1-I8 | CI infrastructure fixes (8 items) | HIGH-MEDIUM | 3 | S |
| K1-K7 | Pre-commit & config consistency (7 items) | MEDIUM-LOW | 4 | S |
| F1-F10 | Flaky tests & anti-patterns (10 items) | MEDIUM | 5 | S |