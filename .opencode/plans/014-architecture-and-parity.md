# ADR-014: Architecture & Cross-Runtime Parity

**Date:** 2026-05-12
**Status:** Proposed
**Context:** The codebase has significant DRY violations (~310 lines of near-identical code between `_url_resolve.py` and `_query_resolve.py`), triple-defined constants, circular import workarounds, and cross-runtime divergences in budget profiles, quality thresholds, and provider coverage. These make the codebase harder to maintain and increase the risk of cross-platform bugs.

---

## Goal

Consolidate duplicated logic, establish single-source-of-truth patterns for configuration and constants, and bring Python/Rust/Web runtimes into structural parity.

---

## GOAP Waves

### Wave 1: Extract Shared Constants & State (Day 1)

| ID | File | Action | Severity |
|----|------|--------|----------|
| A1 | `scripts/constants.py` (new) | Create single-source module for `MAX_CHARS`, `MIN_CHARS`, `DEFAULT_TIMEOUT`, `CACHE_DIR`, `CACHE_TTL`, `ACCEPTABLE_QUALITY_THRESHOLD`, `TOO_SHORT_THRESHOLD`, and all other shared constants. Import from here everywhere | HIGH |
| A2 | `scripts/resolve.py` | Remove `MAX_CHARS`, `MIN_CHARS`, `DEFAULT_TIMEOUT` definitions (lines 59-61). Import from `scripts.constants` | HIGH |
| A3 | `scripts/utils.py` | Remove `MAX_CHARS`, `DEFAULT_TIMEOUT`, `CACHE_DIR`, `CACHE_TTL` definitions (lines 27-30). Import from `scripts.constants` | HIGH |
| A4 | `scripts/providers_impl.py` | Remove `MAX_CHARS`, `MIN_CHARS`, `DEFAULT_TIMEOUT` definitions (lines 24-26). Import from `scripts.constants` | HIGH |
| A5 | `scripts/state.py` (new) | Create module holding shared instances: `_circuit_breakers`, `_routing_memory`, initialize once. Both `_url_resolve.py` and `_query_resolve.py` import from here. Eliminates monkey-patching in `resolve.py` | HIGH |
| A6 | `scripts/resolve.py` | Remove monkey-patching lines 84-87. Import shared state from `scripts.state` instead | HIGH |
| A7 | `scripts/_url_resolve.py`, `scripts/_query_resolve.py` | Remove module-level `_circuit_breakers` and `_routing_memory` creation (lines 44-45 in each). Import from `scripts.state` | HIGH |
| A8 | `scripts/semantic_cache.py:478-485` | Move `ENABLE_SEMANTIC_CACHE`, `SEMANTIC_CACHE_THRESHOLD`, `SEMANTIC_CACHE_MAX_ENTRIES` env var reads to `scripts.constants`. Semantic cache module imports from constants | MEDIUM |

### Wave 2: Consolidate Cascade Logic (Day 2-3)

| ID | File | Action | Severity |
|----|------|--------|----------|
| D1 | `scripts/cascade.py` (new) | Extract shared cascade function from the duplicated logic in `_url_resolve.py:166-298` and `_query_resolve.py:146-246`. The function takes: provider_map, eligible_providers, budget, callbacks (on_result, on_quality_fail, on_provider_skip), and routing_type ("url"/"query"). Returns `list[ResolvedResult]` or generator | HIGH |
| D2 | `scripts/_url_resolve.py` | Replace ~133 lines of cascade loop with call to `cascade.run_cascade()`. Keep URL-specific handling: `fetch_llms_txt` special case, `compact_content` call, domain stats recording | HIGH |
| D3 | `scripts/_query_resolve.py` | Replace ~100 lines of cascade loop with call to `cascade.run_cascade()`. Keep query-specific handling: query string recording, no `compact_content` | HIGH |
| D4 | `scripts/cascade.py` (new) | Extract shared `_check_semantic_cache()` and `_store_in_semantic_cache()` from `_url_resolve.py:48-84` and `_query_resolve.py:44-80` (37 identical lines). Single implementation | HIGH |
| D5 | `scripts/_url_resolve.py`, `scripts/_query_resolve.py` | Replace inline semantic cache functions with imports from `scripts.cascade` | MEDIUM |
| D6 | `scripts/cascade.py` (new) | Extract shared `ResolutionBudget` construction logic from `_url_resolve.py:114-123` and `_query_resolve.py:116-125` | MEDIUM |
| D7 | `scripts/resolve.py:155-156` | Inline `synthesize_results()` call or remove the re-export wrapper that adds no value | LOW |

### Wave 3: DRY Within Modules (Day 3)

| ID | File | Action | Severity |
|----|------|--------|----------|
| R1 | `scripts/doc_models.py`, `scripts/doc_checkers_1.py`, `scripts/doc_checkers_2.py`, `scripts/doc_fixers.py` | Consolidate `REPO_ROOT` definition into `scripts/constants.py`. Remove 3 duplicate definitions | LOW |
| R2 | `scripts/doc_models.py:7-9` | Remove unused `EXTERNAL_PACKAGES` frozenset | LOW |
| R3 | `scripts/doc_fixers.py` | Remove or implement 3 stub fixers: `fix_python_cli`, `fix_duplicate_links`, `fix_repo_trees` (all return 0 with no logic) | LOW |
| R4 | `scripts/utils.py:333-396` | Move `EnhancedHTMLParser` class definition out of `extract_text_from_html()` to module level. It's recreated on every call | MEDIUM |
| R5 | `scripts/cache_negative.py:49-51` | Move deferred `from scripts.utils import get_ttl` to module top level. If circular import exists, refactor the dependency | LOW |
| R6 | `scripts/quality.py` | Add `from __future__ import annotations` and full type annotations to `score_content()` signature and return type | LOW |
| R7 | `scripts/synthesis.py` | Replace `import datetime` with `from datetime import date`. Replace unnamed magic numbers with constants: `SIMILARITY_TRUNCATION=2000`, `CONFLICT_THRESHOLD=0.2`, `FRAGMENT_MIN_CHARS=500`, `MIN_TOTAL_CONTENT=1000`, `SYNTHESIS_QUALITY_THRESHOLD=0.65` | MEDIUM |

### Wave 4: Unify Budget Profiles & Quality Thresholds (Day 4)

| ID | File | Action | Severity |
|----|------|--------|----------|
| U1 | `scripts/routing.py:48-77` | Convert `PROFILE_BUDGETS` dict to a `TypedDict` or dataclass `BudgetProfile` with fields: `max_provider_attempts`, `max_paid_attempts`, `max_total_latency_ms`, `min_free_quality_to_skip_paid`, `allow_parallel`. Replace `budget_data["max_provider_attempts"]` lookups with typed attribute access | HIGH |
| U2 | `web/app/constants.ts:23-29` | Align `PROFILES.balanced` with Python/Rust defaults: `maxProviderAttempts: 4` (currently 6), `maxPaidAttempts: 1` (currently 2), `maxTotalLatencyMs: 9000` (currently 12000). These diverge significantly | HIGH |
| U3 | `scripts/constants.py` | Define `MIN_FREE_QUALITY_TO_SKIP_PAID = 0.70`, `MIN_CHARS_DEFAULT = 200`, `ACCEPTABLE_QUALITY_THRESHOLD = 0.65`. Import in `quality.py`, `routing.py`, `_url_resolve.py`, `_query_resolve.py` | MEDIUM |
| U4 | `web/lib/quality.ts` | Replace hardcoded `0.65` with `ACCEPTABLE_QUALITY_THRESHOLD` constant imported from config. Replace hardcoded `50` with `MIN_CHARS_DEFAULT = 200` | MEDIUM |
| U5 | `cli/src/routing.rs:204-229` | Document that Rust profile defaults already use configurable thresholds. Ensure Python and Web read from the same config source or shared defaults | LOW |
| U6 | `scripts/routing.py:11` | Move `DEFAULT_MIN_FREE_QUALITY = float(os.getenv("DO_WDR_MIN_FREE_QUALITY_TO_SKIP_PAID", "0.70"))` to `scripts/constants.py`. Read env var at module import time | LOW |

### Wave 5: Resolve Circular Dependencies & Dead Code (Day 5)

| ID | File | Action | Severity |
|----|------|--------|----------|
| C1 | `scripts/utils.py:558-563` | Break circular import: `_get_cache_proxy` imports `scripts.resolve` which imports from `scripts.utils`. Refactor by extracting cache management to `scripts/cache_manager.py` that doesn't import from resolve | HIGH |
| C2 | `scripts/_url_resolve.py:162` | Remove circular import workaround `from scripts import resolve as resolve_module` inside function body. After A5/C1, shared state and cache are in separate modules, so the circular dependency is eliminated | MEDIUM |
| C3 | `scripts/_query_resolve.py:142` | Same as C2 — remove inner-function import of resolve module | MEDIUM |
| C4 | `scripts/routing_memory.py:85-87` | Remove backward-compat `rank()` wrapper that calls `rank_providers()`. Use `rank_providers()` directly | LOW |
| C5 | `scripts/models.py:103` | Add `to_dict()` method to `ValidationResult` for consistency with `ResolvedResult.to_dict()` | LOW |
| C6 | `scripts/models.py:122` | Wire `ResolveMetrics.cascade_depth` — increment in cascade loop or remove the field if unused | LOW |
| C7 | `cli/src/output.rs:32-40` | Remove dead `JsonOutput::error()` method (marked `#[allow(dead_code)]`, `_msg` parameter unused, always returns zero-score empty result) | LOW |
| C8 | `cli/src/output.rs:51-77` | Remove dead `TextOutput` struct and methods (`print_result`, `print_error`, `print_info`, `print_success`) — none are called in `main.rs` | LOW |
| C9 | `cli/src/semantic_cache.rs:544-551` | Fix `stats()` to return real entries/hit_rate when `semantic-cache` feature is enabled instead of always returning zeros | MEDIUM |
| C10 | `web/package.json:51` | Already fixed in ADR-013 I6 — ensure TypeScript version is valid (`^5.x`) | N/A |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Extracting cascade logic may break URL-vs-query differences | High | Keep URL-specific and query-specific callbacks/hooks in the shared `run_cascade()` function; unit test both paths thoroughly |
| Moving constants to new module changes import paths across codebase | Medium | Update all imports in one commit; run `quality_gate.sh` and full test suite |
| Breaking circular imports requires careful reordering | Medium | `scripts.constants` has no imports from `scripts.*`; `scripts.state` only imports `circuit_breaker` and `routing_memory`; both are leaf modules |
| Aligning budget profiles changes web behavior | Low | Web was using more generous defaults (6 attempts, 12s); the stricter Python/Rust defaults (4 attempts, 9s) are the intended baseline |
| Removing `conftest.py` stubs requires new tests first | Medium | Wave 2 (ADR-013) must add real tests before Wave 1 (this ADR) can safely remove stubs |

## Postconditions

1. All configuration constants defined once in `scripts/constants.py`
2. Shared mutable state defined once in `scripts/state.py`
3. Cascade logic in single `scripts/cascade.py` module (~200 lines vs ~310 duplicated)
4. No circular imports — `constants` and `state` are leaf modules
5. No monkey-patching of module-level state
6. Budget profiles use typed dataclass, aligned across all 3 runtimes
7. Quality thresholds are configurable via constants, not hardcoded
8. Dead code removed (stub fixers, unused dataclasses, dead CLI output structs)
9. All `REPO_ROOT` references point to single source
10. `semantic_cache.py` env vars centralized in `constants.py`

## Related ADRs

- [ADR-012](012-correctness-and-safety-fixes.md) — Bug fixes and security hardening (wave 1 sets up `scripts/constants.py` and `scripts/state.py`)
- [ADR-013](013-test-coverage-and-ci-reliability.md) — Test coverage (depends on cascade consolidation for meaningful stream tests)
- [ADR-001](01-architecture-improvements.md) — Architecture improvements (async migration, Provider trait, config consolidation)
- [ADR-003](03-performance-optimization.md) — Performance optimization (shared HTTP session requires `state.py`)

---

## Summary Table

| # | Finding | Severity | Wave | Effort |
|---|---------|----------|------|--------|
| A1-A8 | Triple-defined constants, monkey-patching, env var duplication | HIGH | 1 | M |
| D1-D7 | ~310 lines duplicated cascade logic, semantic cache, budget construction | HIGH | 2 | L |
| R1-R7 | Intra-module DRY violations, dead code, magic numbers | MEDIUM | 3 | S |
| U1-U6 | Budget profile divergence, hardcoded quality thresholds | HIGH | 4 | M |
| C1-C10 | Circular imports, dead code across runtimes | MEDIUM | 5 | M |