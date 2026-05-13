# GOAP Next Phase: Codacy Cleanup, CI Config, Constants Extraction

> Generated 2026-05-13 after ADR-012 Wave 1 complete.
> Next: Wave 2 (CI/config) → Wave 3 (constants/state).

## Goal

Close out remaining ADR-012/013/014 work, fix AUDIT P0/P1 items, and unblock
further development.

## Preconditions

- ADR-012 Wave 1 merged ✅
- Quality gate (PR #341), tiered TTL (#338), provider skip (#342),
  adaptive reordering (#343), rate throttling (#358) all merged ✅

## Actions (dependency-ordered waves)

### Wave 2 — ADR-013 CI & Config Fixes (Effort: S)

| ID | Task | File | Notes |
|----|------|------|-------|
| I1 | Fix coverage upload condition | `.github/workflows/ci.yml:106` | Only on main |
| I2 | Fix gitleaks branch triggers | `.github/workflows/gitleaks.yml:5-6` | all branches |
| I3 | Update actions/checkout in gitleaks | `.github/workflows/gitleaks.yml:21` | v3→v4 |
| I4 | Install lint deps from requirements.txt | `.github/workflows/ci.yml:69` | — |
| I5 | Shellcheck severity → error | `.pre-commit-config.yaml:34` | — |
| K1-K3 | Consolidate pre-commit hooks | `scripts/setup-hooks.sh`, `.githooks/` | Reduce drift |
| K4 | Fix requirements.txt package names | `requirements.txt` | — |
| K5 | Add Python 3.13 classifier | `pyproject.toml:16-18` | — |
| K7 | Fix close-resolved-issues.yml trigger | `.github/workflows/close-resolved-issues.yml:4` | — |

### Wave 3 — ADR-014 Constants & State Extraction (Effort: M, prerequisite)

| ID | Task | File | Notes |
|----|------|------|-------|
| A1 | Create `scripts/constants.py` | New | Single source of truth |
| A2-A4 | Remove duplicate constants from resolve.py, utils.py, providers_impl.py | 3 files | — |
| A5 | Create `scripts/state.py` | New | Shared instances |
| A6 | Remove monkey-patching from resolve.py | `scripts/resolve.py` | Replace with state.py import |
| A7 | Import state in _url_resolve, _query_resolve | 2 files | — |
| A8 | Centralize semantic cache env vars | `scripts/semantic_cache.py` | — |

### Wave 4 — ADR-012 Remaining + Quality Fixes (depends on Wave 3)

| ID | Task | File | Effort | Status |
|----|------|------|--------|--------|
| P3b | Log all provider exceptions (9 still silent) | `scripts/providers_impl.py` | M | ❌ |
| P4 | Replace requests.post with shared session | `scripts/synthesis.py` | M | ❌ |
| P5 | Fix preflight_route loose pattern matching | `scripts/routing.py` | M | ❌ |
| P6 | Remove unused NegativeCacheEntry (Python) | `scripts/cache_negative.py` | S | ❌ |
| P7 | Move TIERED_TTL dict to constants.py (not dead) | `scripts/utils.py` → `constants.py` | S | ❌ (do in Wave 3) |
| Q1-Q6 | Quality scoring fixes | `scripts/quality.py` | M | ❌ |

### AUDIT P2/P3 Roadmap Items

| # | Task | Area | Priority |
|---|------|------|----------|
| 10 | Port preflight routing to Rust + Web | Cross-platform | P2 |
| 11 | Add hedged requests to Rust | `cli/src/resolver/cascade.rs` | P2 |
| 12 | Add `evals.json` to skills | `.agents/skills/*/` | P2 |
| 13 | Add Python 3.10 to CI or bump `requires-python` | CI | P2 |
| 14 | Port `exa_mcp_mistral` combo to Python + Rust | Cross-platform | P3 |
| 15 | Full `--deep-research` parallel mode for CLIs | Python + Rust | P3 |
| 16 | File-based routing memory for Python | `scripts/` | P3 |

### Open AUDIT Items (P0/P1)

| # | Task | File/Location | Priority | Notes |
|---|------|--------------|----------|-------|
| Q1 | Split `page.tsx` (496 lines, near 500 limit) | `web/app/page.tsx` | P0 | Borderline — extract components |
| Q2 | Shrink `query.rs` (527 lines, over 500 limit) | `cli/src/resolver/query.rs` | P0 | **EXCEEDED** — needs splitting |
| M5 | Unit tests for web utilities | `web/lib/*.ts` | P1 | circuit-breaker, errors, quality, keys |
| M7 | Mobile/tablet Playwright in CI | `.github/workflows/ci-ui.yml` | P1 | `--project=desktop` only |
| P3 | Wire Rust `--profile` to budget presets | `cli/src/` | P1 | CLI flag exists but not wired |
| M6 | Unit tests for Rust resolver | `cli/src/resolver/` | P2 | query.rs, url.rs |
| P4/P5 | Port preflight routing + hedged requests to Rust | `cli/src/` | P2 | Parity gaps |
| M8 | Add `evals.json` to skills | `.agents/skills/*/` | P2 | 0/13 have evals |

## Postconditions

1. CI config is clean, gitleaks runs on all branches, coverage uploads correctly
2. Constants are centralized in `scripts/constants.py`
3. Shared state lives in `scripts/state.py` — no more monkey-patching
4. `scripts/synthesis.py` uses shared session instead of raw `requests.post`
5. Quality scoring has no dead code or magic numbers
6. `page.tsx` and `query.rs` are within the 500-line limit
7. Web utilities have basic unit tests

## Execution Order

```
Wave 2 (fast: CI config) → Wave 3 (prerequisite for Waves 4-6)
→ Wave 4 (quality fixes) + AUDIT P0/P1 items in parallel
→ Parity items (P4/P5/M6)
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Wave 3 state.py breaks test fixtures | Update conftest to import from state.py; run full suite after each sub-task |
| Wave 3 constants extraction changes behavior | Verify all constants are functionally identical; use grep to find all references |
| Wave 2 CI changes break the pipeline | Test via `act` locally before pushing; keep old config as comment for rollback |
| Q2 (query.rs split) introduces circular imports | Follow existing module pattern; keep public API surface unchanged |
