# GOAP State Update — 2026-05-29

> Generated after fetching latest `origin/main` (v0.3.6, commit `5ed9ed1`).
> Supersedes `16-GOAP-WAVE2-6.md` and `15-GOAP-NEXT-PHASE.md` for remaining work.

## Goal

Complete all outstanding technical debt items (Waves 3, 6, 7), address open
GitHub issues (#402 roadmap, #406 compaction), and maintain quality gate.

## Preconditions

- Main branch at v0.3.6 (`3e22c8c` after rebase)
- 1 open PR (#406 boilerplate detection)
- 1 open issue (#402 technical debt roadmap)
- Waves 1, 2, 3, 4 (partial), 5 completed
- Wave 6 (tests) **PARTIALLY DONE**
- Wave 7 (middleware) **NOT STARTED**

---

## Completion Matrix

### Wave 1 — ADR-012 Thread Safety, SSRF ✅ DONE (PR #364)

### Wave 2 — ADR-013 CI & Config ✅ DONE

| ID | Task | Status |
|----|------|--------|
| I1-I5 | CI config fixes | ✅ DONE |
| K4-K6 | Package names, classifiers, AGENTS.md | ✅ DONE |
| K7 | markdownlint.toml config | ❌ STILL OPEN |

### Wave 3 — ADR-014 Constants & State Extraction ✅ DONE (PR #407)

| ID | Task | File | Status |
|----|------|------|--------|
| A1 | Create `scripts/constants.py` | New (86 lines) | ✅ |
| A2 | Remove duplicate constants from `resolve.py` | `scripts/resolve.py` | ✅ |
| A3 | Remove duplicate constants from `providers_impl.py` | `scripts/providers_impl.py` | ✅ |
| A4 | Remove duplicate constants from `utils.py` | `scripts/utils.py` | ✅ |
| A5 | Create `scripts/state.py` with shared singletons | New (20 lines) | ✅ |
| A6 | Remove monkey-patching from resolve.py (lines 85-91) | `scripts/resolve.py` | ✅ |
| A7 | Update `_url_resolve` + `_query_resolve` imports | 2 files | ✅ |
| A8 | Centralize semantic cache env vars | Deferred — env vars still in utils.py | ⚠️ |

### Wave 4 — Quality, Safety & Code Fixes — PARTIAL

| ID | Task | Status |
|----|------|--------|
| P3b | Log silent exceptions in providers | ❌ 2 remaining (docling, tesseract at lines 502, 517) |
| P4 | Replace requests.post with shared session | ✅ DONE (PR #365) |
| P5 | Anchor preflight_route patterns | N/A — uses str.startswith, no regex |
| P6 | Remove dead NegativeCacheEntry | ❌ STILL PRESENT |
| Q1-Q6 | Extract magic numbers in quality.py | ❌ STILL PRESENT (0.25, 0.10, 0.15, 0.65 thresholds) |
| N5 | Fix CircuitBreakerRegistry TOCTOU | ✅ DONE (PR #365) |
| N6 | Lock guard on _maybe_evict() | ⚠️ Safe in practice (called under caller's lock) |
| N12/N13 | SSRF gaps in providers | ✅ DONE (PR #365) |
| 252a3ed | Structured error logging across providers | ✅ DONE (merged) |

### Wave 5 — Rust File Splits ✅ DONE

### Wave 6 — Tests & Coverage — PARTIAL

| ID | Task | Status |
|----|------|--------|
| T1 | web/tests/circuit-breaker.test.ts | ❌ MISSING |
| T2 | web/tests/errors.test.ts | ❌ MISSING |
| T3 | web/tests/quality.test.ts | ❌ MISSING |
| T4 | web/tests/keys.test.ts | ❌ MISSING |
| T5 | web/tests/log.ts | ❌ MISSING |
| T5b | web/tests/results.test.ts | ✅ EXISTS |
| T6 | Inline tests for query.rs + url.rs | ❌ MISSING (mod.rs + cascade.rs have tests) |
| T7 | Python test expansion (cascade, routing, providers) | ✅ DONE (10+ test commits since v0.3.6) |
| T8 | Add evals.json to skills | ⚠️ 2/13 done (do-web-doc-resolver, do-github-pr-sentinel) |

### Wave 7 — Web Middleware & Cross-Platform Parity ❌ NOT STARTED

| ID | Task | Status |
|----|------|--------|
| W1 | Create `web/middleware.ts` with rate limiting | ❌ |
| W2 | Port preflight_route to Rust | ❌ |
| W3 | Port hedged/parallel execution to Rust | ❌ |
| W4 | Align budget profile presets | ❌ |

---

## Recent Activity (since 2026-05-18)

| PR | Feature | Merged |
|----|---------|--------|
| #395 | Align quality synthesis with 2026 LLM-Readable-Doc standards | ✅ |
| #396-#398 | Dependency bumps (Python, Cargo, npm) | ✅ |
| #401 | Semantic cache hit performance optimization + pruning | ✅ |
| #403 | Bridge strengthening + LLM-ready Markdown output | ✅ |
| #404 | Codacy agent skill + configuration | ✅ |
| #405 | Clear-text button in search input (UX) | ✅ |
| #406 | Boilerplate detection optimization | ❌ OPEN |
| #407 | ADR-014 Wave 3 — constants.py + state.py, no monkey-patching | ✅ |

### Test Coverage Expansion (10 commits)

- Cascade error handling, routing memory concurrency, URL cascade llms_txt/jina
- Semantic cache hit, budget exhaustion tests
- Provider caplog error logging tests for all providers
- Routing memory edge case, direct_fetch tests
- doc_validator, synthesis edge, Rust bias/link tests
- doc_models unit tests, env/TTL coverage
- Circuit breaker recovery, quality bonus, budget edge, rate limit expiry
- Utils edge case tests + clippy warnings fix

---

## Open GitHub Issues

| # | Title | Labels | Status |
|---|-------|--------|--------|
| #402 | Roadmap: Technical Debt Reduction (Q2-Q3 2026) | documentation, enhancement, security, testing, performance, technical-debt, architecture, roadmap | OPEN — master roadmap |
| #406 | Optimize boilerplate detection in content compaction | — | OPEN — active PR |

---

## Updated Priority Actions

### P0 — Wave 3 ✅ DONE (PR #407)

All Wave 3 items completed. See PR #407 for details.

### P1 — Complete Wave 6 (test coverage)

| # | Action | File | Effort |
|---|--------|------|--------|
| 7 | Create web unit tests: circuit-breaker, errors, quality, keys, log | `web/tests/` | M |
| 8 | Add inline tests to `query.rs` + `url.rs` | `cli/src/resolver/` | M |
| 9 | Add evals.json to 9 more skills (11/13 missing) | `.agents/skills/*/` | M |

### P2 — Remaining Wave 4 fixes

| # | Action | File | Effort |
|---|--------|------|--------|
| 10 | Add logging to 2 remaining silent exception handlers | `scripts/providers_impl.py:502,517` | S |
| 11 | Remove dead NegativeCacheEntry dataclass | `scripts/cache_negative.py` | S |
| 12 | Extract magic numbers in quality.py to named constants | `scripts/quality.py` | S |

### P3 — Wave 7 (cross-platform parity)

| # | Action | File | Effort |
|---|--------|------|--------|
| 13 | Create `web/middleware.ts` with rate limiting | New | M |
| 14 | Port preflight_route/detect_doc_platform to Rust | `cli/src/routing.rs` | L |
| 15 | Port hedged/parallel provider execution to Rust | `cli/src/resolver/` | L |
| 16 | Align budget profile presets (Python vs Rust) | 2 files | M |

### P4 — Roadmap items from #402

| # | Action | Area | Effort |
|---|--------|------|--------|
| 17 | Add Python 3.10 to CI or bump requires-python | CI | S |
| 18 | Consolidate requirements.txt into pyproject.toml | Build | S |
| 19 | Unify env var naming (DO_WDR_\* vs WEB_RESOLVER_\*) | Config | M |
| 20 | Add provider unit tests with HTTP mocking | Tests | M |
| 21 | Add pip-audit/cargo audit/npm audit to CI | Security | S |
| 22 | Migrate to asyncio + httpx for provider calls | Performance | L |
| 23 | Consider fastembed instead of sentence-transformers | Performance | M |

---

## Execution Order

```text
Wave 3 (constants/state) ✅ DONE (PR #407)
  → Wave 4 remaining (P3b, P6, Q magic numbers) — can parallel with Wave 6
  → Wave 6 (web tests, Rust tests, evals.json)
  → Wave 7 (middleware + parity)
  → Roadmap items (402) — ongoing
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| ~~Wave 3 state.py breaks test fixtures~~ | ✅ RESOLVED — conftest updated to use scripts.state |
| ~~Wave 3 constants extraction changes behavior~~ | ✅ RESOLVED — all constants functionally identical |
| K7 markdownlint.toml config still broken | Config parsing issue: `MD013=false` in TOML not recognized by markdownlint-cli; may need JSON config |
| #406 boilerplate PR may conflict with Wave 3 | Rebase after Wave 3 lands |

---

## Postconditions

1. `scripts/constants.py` and `scripts/state.py` exist — no more monkey-patching
2. All silent exception handlers have logging
3. Web lib unit tests exist for 5 core utilities
4. `query.rs` + `url.rs` have inline test modules
5. 13/13 skills have evals.json
6. `web/middleware.ts` provides rate limiting
7. All items from #402 roadmap tracked and progressing
