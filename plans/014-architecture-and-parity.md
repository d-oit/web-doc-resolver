# ADR-014: Architecture & Parity — DRY Consolidation, Constants, Dead Code

## Status

PENDING. Prerequisite for Waves 4-6.

## Context

The Python codebase has accumulated duplicate constants across multiple modules
(e.g., `MAX_CHARS`, `MIN_CHARS`, cache TTLs defined in 3+ places), shared
state wired via monkey-patching in `resolve.py` lines 85-91, and the cascade
logic is inlined in `_url_resolve.py`/`_query_resolve.py` rather than a
dedicated module. These patterns make maintenance harder and create subtle bugs.

## Decision

1. **Extract constants**: Create `scripts/constants.py` as the single source of
   truth for all magic numbers and named constants.
2. **Extract state**: Create `scripts/state.py` to hold shared instances
   (CircuitBreakerRegistry, RoutingMemory, rate-limit dicts) — eliminating the
   monkey-patching in `resolve.py`.
3. **Extract cascade**: Move cascade orchestration to `scripts/cascade.py`,
   keeping `_url_resolve.py` and `_query_resolve.py` for pre/post processing.
4. **Clean dead code**: Remove unused `NegativeCacheEntry`, dead `TIERED_TTL`
   entry, unused imports.

## Wave 3 — Constants & State Extraction (PENDING, next)

| ID | Task | File | Effort |
|----|------|------|--------|
| A1 | Create `scripts/constants.py` | New | M |
| A2-A4 | Remove duplicate constants from resolve.py, utils.py, providers_impl.py | 3 files | M |
| A5 | Create `scripts/state.py` | New | M |
| A6 | Remove monkey-patching from resolve.py | `scripts/resolve.py` | S |
| A7 | Import state in _url_resolve, _query_resolve | 2 files | S |
| A8 | Centralize semantic cache env vars | `scripts/semantic_cache.py` | S |

## Wave 6 — Cascade Consolidation (PENDING, depends on Wave 3)

| ID | Task | Effort |
|----|------|--------|
| D1 | Extract cascade to `scripts/cascade.py` | L |
| D2-D3 | Replace inline cache in _url/_query resolve | M |
| U1-U6 | Budget profile alignment (`scripts/routing.py`, `web/constants.ts`) | M |
| R1-R7 | Intra-module DRY cleanup | S |
| C1-C10 | Circular imports, dead code | M |

## Risks

| Risk | Mitigation |
|------|------------|
| State extraction breaks test fixtures | Update conftest to use `state.py` API; run full test suite |
| Cascade refactor overlaps with remaining ADR-012 fixes | Do Wave 3 first; then Wave 4 + 5 parallel, then Wave 6 |
| Constants extraction changes behavior | Ensure all constants are functionally identical; diff before/after |

## References

- [GOAP_FOLLOWUP.md](archive/GOAP_FOLLOWUP.md) — Wave execution order
- [AUDIT.md](AUDIT.md) — Code quality section (Q1-Q3)
- [ADR-012](012-correctness-and-safety-fixes.md) — Remaining fixes depend on this
