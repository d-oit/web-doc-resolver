# GOAP Follow-up: Remaining Implementation Waves

> Generated 2026-05-13 after ADR-012 Wave 1 completion.
> Tracks remaining work across ADR-012/013/014.

## Wave 1 — ✅ Complete (PR: `fix/adr-012-correctness-and-safety`)

| Task | Files | Status |
|---|---|---|
| T1 CircuitBreakerRegistry lock + falsy-threshold fix | `scripts/circuit_breaker.py` | ✅ |
| T2 RoutingMemory lock + magic number→constants | `scripts/routing_memory.py` | ✅ |
| T3 providers_impl rate-limit lock | `scripts/providers_impl.py` | ✅ |
| T4 utils session + cache lock | `scripts/utils.py` | ✅ |
| T5 semantic_cache singleton lock + atomic eviction | `scripts/semantic_cache.py` | ✅ |
| T6 resolve.py monkey-patch → state.py wiring | `scripts/resolve.py` | ✅ |
| S1 Mistral browser SSRF check | `scripts/providers_impl.py` | ✅ |
| S2 is_url() reject ftp/ftps | `scripts/utils.py` | ✅ |
| S3 safeFetch() initial URL validation | `web/lib/resolvers/url.ts` | ✅ |
| P1 resolve_direct() missing 4 providers | `scripts/resolve.py` | ✅ |
| P2 Profile.max_hops() default return | `scripts/models.py` | ✅ |
| I6-I8 package.json version fixes | `web/package.json` | ✅ |
| RLock deadlock fix (reentrant lock) | `scripts/utils.py` | ✅ |
| Conftest lock-safe clearing | `tests/conftest.py` | ✅ |
| Test updates for is_url() behavior | `tests/test_resolve.py` | ✅ |

## Learnings

### RLock vs Lock

`threading.Lock` deadlocks if acquired recursively. `threading.RLock` is reentrant —
safe for nested calls like `_get_from_cache` → `_get_cache` where both acquire the same lock.

### Conftest State Management

The conftest's `autouse` fixture clears shared state directly via `.clear()` methods.
After adding locks, tests must use the lock-safe clear methods (`.clear()` on
CircuitBreakerRegistry/RoutingMemory, `_clear_rate_limits()` on providers_impl)
instead of direct dict access.

### Monkey-patching Dependency

`resolve.py` lines 85-91 wire shared instances to `_url_resolve`/`_query_resolve`.
These overwrites must remain until ADR-014 creates `scripts/state.py` — tests
depend on them for state synchronization.

---

## Wave 2 — ADR-013 CI & Config Fixes

| Task | Files | Effort |
|---|---|---|
| I1 Fix coverage upload condition | `.github/workflows/ci.yml:106` | S |
| I2 Fix gitleaks branch triggers | `.github/workflows/gitleaks.yml:5-6` | S |
| I3 Update actions/checkout in gitleaks | `.github/workflows/gitleaks.yml:21` | S |
| I4 Install lint deps from requirements.txt | `.github/workflows/ci.yml:69` | S |
| I5 Shellcheck severity → error | `.pre-commit-config.yaml:34` | S |
| K1-K3 Consolidate pre-commit hooks | `scripts/setup-hooks.sh`, `.githooks/` | M |
| K4 Fix requirements.txt package names | `requirements.txt` | S |
| K5 Add Python 3.13 classifier | `pyproject.toml:16-18` | S |
| K7 Fix close-resolved-issues.yml trigger | `.github/workflows/close-resolved-issues.yml:4` | S |

## Wave 3 — ADR-014 Constants & State Extraction

| Task | Files | Effort |
|---|---|---|
| A1 Create `scripts/constants.py` | New file | M |
| A2-A4 Remove duplicate constants from resolve.py, utils.py, providers_impl.py | 3 files | M |
| A5 Create `scripts/state.py` | New file | M |
| A6 Remove monkey-patching from resolve.py | `scripts/resolve.py` | S |
| A7 Import state in _url_resolve, _query_resolve | 2 files | S |
| A8 Centralize semantic cache env vars | `scripts/semantic_cache.py` | S |

## Wave 4 — ADR-012 Remaining + Quality Fixes

| Task | Files | Effort | Status |
|---|---|---|---|
| P3a SSRF warning logs added (Wave 1 Codacy) | `scripts/providers_impl.py` | S | ✅ |
| P3b Log all exceptions (9 providers still silent) | `scripts/providers_impl.py` | M | ❌ |
| P4 Replace requests.post with shared session | `scripts/synthesis.py` | M | ❌ |
| P5 Fix preflight_route loose pattern matching | `scripts/routing.py` | M | ❌ |
| P6 Remove unused NegativeCacheEntry (Python) | `scripts/cache_negative.py` | S | ❌ (dataclass dead code) |
| P7 TIERED_TTL → move to constants.py (NOT dead) | `scripts/utils.py` → `constants.py` | S | ❌ (active code, move in Wave 3) |
| Q1-Q6 Quality scoring fixes | `scripts/quality.py` | M | ❌ |

## Feature PRs Merged Since Wave 1 (alongside ADR work)

| PR | Feature |
|----|---------|
| #338 | Tiered provider TTL in config.toml |
| #339 | Cache pre-warming (Rust CLI) |
| #340 | Synthesis alignment with 2026 LLM-ready standards |
| #341 | Quality confidence gate |
| #342 | Probabilistic provider skip |
| #343 | Adaptive per-domain provider reordering |
| #353 | Semantic cache optimization + observability |
| #356 | Exa MCP monthly usage tracking |
| #358 | Per-provider token-bucket rate throttling |
| #354, #357 | Security fix + CLI Markdown parsing |

## Wave 5 — ADR-013 New Test Files

| Task | Files | Effort |
|---|---|---|
| C1-C2 Stream resolution tests | `tests/test_url_resolve.py`, `tests/test_query_resolve.py` | L |
| C3 Provider unit tests | `tests/test_providers.py` | L |
| C4 Synthesis tests | `tests/test_synthesis.py` | M |
| C5-C7 Utils, models, CLI tests | Various | M |

## Wave 6 — ADR-014 Cascade Consolidation

| Task | Files | Effort |
|---|---|---|
| D1 Extract cascade to `scripts/cascade.py` | New file | L |
| D2-D3 Replace inline cache in _url/_query resolve | 2 files | M |
| U1-U6 Budget profile alignment | `scripts/routing.py`, `web/constants.ts` | M |
| R1-R7 Intra-module DRY cleanup | Various | S |
| C1-C10 Circular imports, dead code | Various | M |

---

## Codacy Review Feedback (PR #364) — All Addressed ✅

| Comment | File | Fix |
|---------|------|-----|
| HIGH: SemanticCache SQLite not thread-safe | `scripts/semantic_cache.py` | Added `check_same_thread=False` + `_conn_lock` |
| MEDIUM: Lock→RLock mismatch in CircuitBreaker | `scripts/circuit_breaker.py` | Changed to `threading.RLock()` |
| MEDIUM: Lock→RLock mismatch in RoutingMemory | `scripts/routing_memory.py` | Changed to `threading.RLock()`, deduplicated `get_domain_stats` |
| MEDIUM: SSRF missing from Jina/Firecrawl | `scripts/providers_impl.py` | Added `is_safe_url()` checks |
| Minor: Bare except in Mistral browser | `scripts/providers_impl.py` | Changed to `except Exception as e:` with logging |
| HIGH: TOCTOU race in CircuitBreakerState.is_open | `scripts/circuit_breaker.py` | Capture `open_until` once at function entry |

## Completed ADRs

| ADR | Status | Notes |
|-----|--------|-------|
| ADR-009 | Referenced | Cross-runtime parity analysis documented |
| ADR-012 | Wave 1 ✅ PR #364 | Correctness & Safety — Codacy feedback incorporated |
| ADR-013 | Wave 1b ✅ | Test coverage & CI reliability — npm peer deps, libsql fix |
| ADR-014 | PENDING | Architecture & parity — prerequisite for Waves 4-6 |

## Next Steps

See **[15-GOAP-NEXT-PHASE.md](15-GOAP-NEXT-PHASE.md)** for the detailed
next-phase plan covering Waves 2-6 plus AUDIT P0/P1 items.

## Execution Order (Updated)

```text
Wave 1 ✅ → Wave 2 (CI config) → Wave 3 (constants/state extraction)
→ Wave 4 (quality fixes) + AUDIT P0/P1 items in parallel
→ Wave 5 (tests) + Wave 6 (cascade consolidation) in parallel
```
