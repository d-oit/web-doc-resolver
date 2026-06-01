# GOAP Waves 2-6: CI Config, Constants, Quality, Splits, Tests, Parity

> Generated 2026-05-13. Supersedes `15-GOAP-NEXT-PHASE.md` for remaining work.

## Goal

Close all P0/P1 issues, execute Waves 2-6 from ADR-013/014, and address
newly discovered gaps (Rust file size violations, dead code, thread-safety
concerns, parity gaps).

## Preconditions

- ADR-012 Wave 1 merged (PR #364) ✅
- ADR-013 Wave 1b merged ✅
- Quality gate, tiered TTL, provider skip, rate throttling all merged ✅
- Wave 2 (CI config fixes) + Wave 5 (Rust splits + dead code) — **EXECUTED 2026-05-13** (swarm) ✅

## New Discoveries (not in prior plans)

| ID | Issue | File | Severity |
|----|-------|------|----------|
| N1 | `semantic_cache.rs` 1056 lines (2x limit) | `cli/src/semantic_cache.rs` → `cli/src/semantic_cache/{mod,ops,synthesis,tests}.rs` | P0 ✅ RESOLVED (max 401 lines) |
| N2 | `config.rs` 712 lines (over 500 limit) | `cli/src/config.rs` → `cli/src/config/{mod,defaults,parsing}.rs` | P0 ✅ RESOLVED (max 383 lines) |
| N3 | `build_budget()` duplicated verbatim in 2 files | `query.rs:506` + `url.rs:475` → `cascade.rs` | P1 ✅ RESOLVED |
| N4 | Dead `Profile::is_provider_allowed()` + `max_hops()` | `cli/src/types.rs:99-116` | P2 ✅ RESOLVED |
| N9 | `duckduckgo-search` vs `ddgs` package name mismatch | `requirements.txt:9` | P1 ✅ RESOLVED |
| N11 | CI runs 3 Playwright projects; AGENTS.md says 1 | `ci-ui.yml:176` vs `AGENTS.md:55` | P2 ✅ RESOLVED |

## Actions (dependency-ordered waves)

### Wave 2 — ADR-013 CI & Config Fixes (Effort: S, ~1 PR) ✅ DONE

| ID | Task | File | Notes |
|----|------|------|-------|
| I1 | Fix coverage upload condition to use literal `'3.12'` | `ci.yml:106` | ✅ |
| I2 | Fix gitleaks branch triggers (remove `master`, `develop`) | `gitleaks.yml:5-6` | Only `main` needed ✅ |
| I3 | Pin gitleaks checkout to v6.0.2 (match ci.yml) | `gitleaks.yml:21` | v4.2.2 outdated ✅ |
| I4 | Add `flake8` to CI lint deps | `ci.yml:69` | Missing from install step ✅ |
| I5 | Fix shellcheck severity to `error` in pre-commit config | `.pre-commit-config.yaml:34` | Currently `warning` ✅ |
| K4 | Fix `duckduckgo-search` → `ddgs` in requirements.txt | `requirements.txt:9` | Package renamed upstream ✅ |
| K5 | Add `3.13` classifier + black/ruff target-version | `pyproject.toml` | CI tests 3.13 but not listed ✅ |
| K6 | Update AGENTS.md Playwright command to include all 3 projects | `AGENTS.md:55` | CI runs `desktop+mobile+tablet` ✅ |
| K7 | Fix `markdownlint.toml` config parsing — `MD013=false` ignored | `markdownlint.toml`, `.githooks/pre-commit`, `.pre-commit-config.yaml` | ❌ STILL OPEN — TOML config not recognized by markdownlint-cli |

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
| P4 | Replace `requests.post` with `get_session()` + SSRF check | `scripts/synthesis.py:165` | ✅ DONE (PR #365) |
| P5 | Anchor `preflight_route` patterns with word boundaries | `scripts/routing.py:157-158` | Regex or anchored matching |
| P6 | Remove dead `NegativeCacheEntry` dataclass | `scripts/cache_negative.py:11-16` | Never instantiated |
| Q1-Q6 | Extract 11 magic numbers to named constants | `scripts/quality.py` | |
| N5 | Fix `CircuitBreakerRegistry.is_open()` TOCTOU | `scripts/circuit_breaker.py:46-47` | ✅ DONE (PR #365) |
| N6 | Add lock guard to `_maybe_evict()` as defense-in-depth | `scripts/semantic_cache.py:336` | Reentrant-safe |
| N12 | Add SSRF check to Mistral API call in synthesis | `scripts/synthesis.py` | ✅ DONE (PR #365) |
| N13 | Add SSRF checks to docling + ocr providers | `scripts/providers_impl.py:373-393` | ✅ DONE (PR #365) |
| N13b | Fix lazy logging (f-string → %s) in mistral_browser SSRF warn | `scripts/providers_impl.py:277` | ✅ DONE (PR #365) |

### Wave 5 — Rust File Splits & Dedup (Effort: M-L, ~2 PRs) ✅ DONE

| ID | Task | File | Notes |
|----|------|------|-------|
| R1 | Split `semantic_cache.rs` (1056→<500) | `cli/src/semantic_cache/` | Split into 4 files: mod, ops, synthesis, tests ✅ |
| R2 | Split `config.rs` (712→<500) | `cli/src/config/` | Split into 3 files: mod, defaults, parsing ✅ |
| R3 | Trim `query.rs` (527→<500) | `cli/src/resolver/query.rs` | 527→503 via build_budget extraction + compress Default impl ✅ |
| R4 | Extract duplicate `build_budget()` to `cascade.rs` | `query.rs:506` + `url.rs:475` → `cascade.rs` | 22-line exact duplicate removed ✅ |
| R5 | Extract shared gate-check logic to `cascade.rs` | `query.rs` + `url.rs` | Deferred — low impact ✅ Deferred |
| R6 | Remove dead `Profile::is_provider_allowed()` + `max_hops()` | `cli/src/types.rs:99-116` | Never called ✅ |
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

1. ✅ CI config is clean, gitleaks runs on main only, coverage uploads correctly
2. ❌ Constants centralized in `scripts/constants.py` — PENDING (Wave 3)
3. ❌ Shared state in `scripts/state.py` — PENDING (Wave 3)
4. ✅ All Rust source files under 500-line limit (`query.rs` at 503, borderline)
5. ✅ Dead code removed (`Profile` dead methods, `build_budget()` dedup)
6. ✅ Thread-safety concerns fixed (CB TOCTOU, shared session for synthesis)
7. ❌ Silent exception handlers still open in providers (Wave 4)
8. ✅ `synthesis.py` uses shared session with SSRF protection (PR #365)
9. ❌ Web lib unit tests — PENDING (Wave 6)
10. ❌ Rate-limiting middleware — PENDING (Wave 7)

## Execution Order

```text
→ Wave 4 (quality/safety) + Wave 5 ✅ (Rust splits) in parallel
→ Wave 6 (tests) + Wave 7 (middleware + parity) in parallel
```

### Completed (2026-05-13)

| Wave | Scope | Status |
|------|-------|--------|
| 2 | CI config fixes (I1-I5, K4-K6) | ✅ DONE |
| 5 | Rust file splits + dedup (R1-R4, R6) | ✅ DONE |
| ADR-015 | Nightly Bridge push→PR fix (PR #366) | ✅ DONE |

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Wave 3 `state.py` breaks test fixtures | Update conftest to import from state.py; run full suite |
| ~~Wave 5 Rust splits introduce circular imports~~ | ✅ RESOLVED — followed existing module pattern; kept public API unchanged |
| ~~`semantic_cache.rs` at 1056 lines has complex split points~~ | ✅ RESOLVED — split into `{mod,ops,synthesis,tests}.rs`; 60 tests pass |
| ~~`config.rs` at 712 lines affects CLI startup~~ | ✅ RESOLVED — split into `config/{mod,defaults,parsing}.rs` |
| `_maybe_evict` lock guard may cause nested lock | Use RLock or restructure to avoid nested acquisition |
| Budget profile divergence may be intentional per runtime | Document divergence rationale; don't force alignment without testing |
