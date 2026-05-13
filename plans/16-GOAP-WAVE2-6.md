# GOAP Waves 2-6: CI Config, Constants, Quality, Splits, Tests, Parity

> Generated 2026-05-13. Supersedes `15-GOAP-NEXT-PHASE.md` for remaining work.

## Goal

Close all P0/P1 issues, execute Waves 2-6 from ADR-013/014, and address
newly discovered gaps (Rust file size violations, dead code, thread-safety
concerns, parity gaps).

## Preconditions

- ADR-012 Wave 1 merged (PR #364)
- ADR-013 Wave 1b merged
- Quality gate, tiered TTL, provider skip, rate throttling all merged

## New Discoveries (not in prior plans)

| ID | Issue | File | Severity |
|----|-------|------|----------|
| N1 | `semantic_cache.rs` 1056 lines (2x limit) | `cli/src/semantic_cache.rs` | P0 |
| N2 | `config.rs` 712 lines (over 500 limit) | `cli/src/config.rs` | P0 |
| N3 | `build_budget()` duplicated verbatim in 2 files | `query.rs:506` + `url.rs:475` | P1 |
| N4 | Dead `Profile::is_provider_allowed()` + `max_hops()` | `cli/src/types.rs:99-116` | P2 |
| N5 | `CircuitBreakerRegistry.is_open()` TOCTOU — state used outside lock | `scripts/circuit_breaker.py:46-47` | P1 |
| N6 | `_maybe_evict()` not independently lock-protected | `scripts/semantic_cache.py:336` | P2 |
| N7 | 11/13 skills missing `evals.json` (was 0/13) | `.agents/skills/*/` | P2 |
| N8 | No `pnpm-lock.yaml` in repo | `cli/ui/`, `web/` | P2 |
| N9 | `duckduckgo-search` vs `ddgs` package name mismatch | `requirements.txt:9` | P1 |
| N10 | `setup-hooks.sh` only validates symlinks, not quality gate | `scripts/setup-hooks.sh` | P2 |
| N11 | CI runs 3 Playwright projects; AGENTS.md says 1 | `ci-ui.yml:176` vs `AGENTS.md:55` | P2 |
| N12 | Raw `requests.post()` in synthesis — no SSRF, no retry, no session | `scripts/synthesis.py:165` | P1 |

## Actions (dependency-ordered waves)

### Wave 2 — ADR-013 CI & Config Fixes (Effort: S, ~1 PR)

| ID | Task | File | Notes |
|----|------|------|-------|
| I1 | Fix coverage upload condition to use literal `'3.12'` | `ci.yml:106` | Fragile env context comparison |
| I2 | Fix gitleaks branch triggers (remove `master`, `develop`) | `gitleaks.yml:5-6` | Only `main` needed |
| I3 | Pin gitleaks checkout to v6.0.2 (match ci.yml) | `gitleaks.yml:21` | v4.2.2 outdated |
| I4 | Add `flake8` to CI lint deps | `ci.yml:69` | Missing from install step |
| I5 | Fix shellcheck severity to `error` in pre-commit config | `.pre-commit-config.yaml:34` | Currently `warning` |
| K4 | Fix `duckduckgo-search` → `ddgs` in requirements.txt | `requirements.txt:9` | Package renamed upstream |
| K5 | Add `3.13` classifier + black/ruff target-version | `pyproject.toml` | CI tests 3.13 but not listed |
| K6 | Update AGENTS.md Playwright command to include all 3 projects | `AGENTS.md:55` | CI runs `desktop+mobile+tablet` |
| K7 | Fix `markdownlint.toml` config parsing — `MD013=false` ignored | `markdownlint.toml`, `.githooks/pre-commit`, `.pre-commit-config.yaml` | TOML format may not be recognized; consider JSON or YAML config, or add `--disable MD013` to the hook args |

### Wave 3 — ADR-014 Constants & State Extraction (Effort: M, ~1 PR)

| ID | Task | File | Notes |
|----|------|------|-------|
| A1 | Create `scripts/constants.py` | New | `MAX_CHARS`, `MIN_CHARS`, `DEFAULT_TIMEOUT`, `TIERED_TTL` |
| A2 | Remove duplicate constants from `resolve.py` | `scripts/resolve.py:62-64` | Import from constants |
| A3 | Remove duplicate constants from `providers_impl.py` | `scripts/providers_impl.py:26-28` | Note: has config fallback |
| A4 | Remove duplicate constants from `utils.py` | `scripts/utils.py:28-31` | Import from constants |
| A5 | Create `scripts/state.py` with shared singletons | New | CB registry, routing memory |
| A6 | Remove monkey-patching from resolve.py | `scripts/resolve.py:85-91` | Import from state |
| A7 | Update `_url_resolve` + `_query_resolve` imports | 2 files | Import from state |
| A8 | Centralize semantic cache env vars | `scripts/semantic_cache.py` | |

### Wave 4 — Quality, Safety & Code Fixes (Effort: M-L, ~2-3 PRs)

| ID | Task | File | Notes |
|----|------|------|-------|
| P3b | Add logging to 7 silent exception handlers | `scripts/providers_impl.py` | `except Exception:` → `except Exception as e: logger.warning(...)` |
| P4 | Replace `requests.post` with `get_session()` + SSRF check | `scripts/synthesis.py:165` | No retry, no SSRF protection |
| P5 | Anchor `preflight_route` patterns with word boundaries | `scripts/routing.py:157-158` | Regex or anchored matching |
| P6 | Remove dead `NegativeCacheEntry` dataclass | `scripts/cache_negative.py:11-16` | Never instantiated |
| Q1-Q6 | Extract 11 magic numbers to named constants | `scripts/quality.py` | |
| N5 | Fix `CircuitBreakerRegistry.is_open()` TOCTOU | `scripts/circuit_breaker.py:46-47` | Check state under lock |
| N6 | Add lock guard to `_maybe_evict()` as defense-in-depth | `scripts/semantic_cache.py:336` | Reentrant-safe |
| N12 | Add SSRF check to Mistral API call in synthesis | `scripts/synthesis.py` | Direct calls bypass SSRF |

### Wave 5 — Rust File Splits & Dedup (Effort: M-L, ~2 PRs)

| ID | Task | File | Notes |
|----|------|------|-------|
| R1 | Split `semantic_cache.rs` (1056→<500) | `cli/src/semantic_cache.rs` | Worst offender, 2x limit |
| R2 | Split `config.rs` (712→<500) | `cli/src/config.rs` | Split parsing vs defaults |
| R3 | Split `query.rs` (527→<500) | `cli/src/resolver/query.rs` | Extract to cascade.rs |
| R4 | Extract duplicate `build_budget()` to `cascade.rs` | `query.rs:506` + `url.rs:475` | 22-line exact duplicate |
| R5 | Extract shared gate-check logic to `cascade.rs` | `query.rs` + `url.rs` | Negative cache + CB checks |
| R6 | Remove dead `Profile::is_provider_allowed()` + `max_hops()` | `cli/src/types.rs:99-116` | Never called |
| R7 | Refactor `page.tsx` (496 lines) → extract components | `web/app/page.tsx` | Near limit |

### Wave 6 — Tests & Coverage (Effort: M, ~2 PRs)

| ID | Task | File | Notes |
|----|------|------|-------|
| T1 | Unit tests for `circuit-breaker.ts` | `web/tests/circuit-breaker.test.ts` | 0 coverage |
| T2 | Unit tests for `errors.ts` | `web/tests/errors.test.ts` | 0 coverage |
| T3 | Unit tests for `quality.ts` | `web/tests/quality.test.ts` | 0 coverage |
| T4 | Unit tests for `keys.ts` | `web/tests/keys.test.ts` | 0 coverage |
| T5 | Unit tests for `log.ts` | `web/tests/log.test.ts` | 0 coverage |
| T6 | Unit tests for `results.ts` | `web/tests/results.test.ts` | 0 coverage |
| T7 | Inline tests for `query.rs` + `url.rs` | `cli/src/resolver/` | 0 coverage (vs 2 inline tests in mod.rs) |
| T8 | Add `evals.json` to 3 most-used skills | `.agents/skills/*/` | 11/13 missing |

### Wave 7 — Web Middleware & Cross-Platform Parity (Effort: L, ~2 PRs)

| ID | Task | File | Notes |
|----|------|------|-------|
| W1 | Create `web/middleware.ts` with rate limiting | New | AUDIT M2 — currently only lib util |
| W2 | Port `preflight_route()` / `detect_doc_platform()` to Rust | `cli/src/routing.rs` | Python has it, Rust doesn't |
| W3 | Port hedged/parallel provider execution to Rust | `cli/src/resolver/` | Currently sequential only |
| W4 | Align budget profile presets (Python vs Rust divergence) | `cli/src/config.rs` + `scripts/routing.py` | Different defaults per profile |

## Postconditions

1. CI config is clean, gitleaks runs on all branches, coverage uploads correctly
2. Constants centralized in `scripts/constants.py`; no duplication
3. Shared state in `scripts/state.py`; no monkey-patching
4. All Rust source files under 500-line limit
5. Dead code removed (`NegativeCacheEntry`, `Profile` dead methods)
6. Thread-safety concerns fixed (CB TOCTOU, evict lock guard)
7. No silent exception handlers in production providers
8. `synthesis.py` uses shared session with SSRF protection
9. Web lib modules have basic unit test coverage
10. Rate-limiting middleware intercepts API requests at edge

## Execution Order

```
Wave 2 (fast: CI config) → Wave 3 (prerequisite: constants/state)
→ Wave 4 (quality/safety) + Wave 5 (Rust splits) in parallel
→ Wave 6 (tests) + Wave 7 (middleware + parity) in parallel
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Wave 3 `state.py` breaks test fixtures | Update conftest to import from state.py; run full suite |
| Wave 5 Rust splits introduce circular imports | Follow existing module pattern; keep public API unchanged |
| `semantic_cache.rs` at 1056 lines has complex split points | Audit module boundaries first; consider `{mod,store,query,eviction}.rs` |
| `config.rs` at 712 lines affects CLI startup | Split into `config/{mod,parsing,defaults}.rs` |
| `_maybe_evict` lock guard may cause nested lock | Use RLock or restructure to avoid nested acquisition |
| Budget profile divergence may be intentional per runtime | Document divergence rationale; don't force alignment without testing |
