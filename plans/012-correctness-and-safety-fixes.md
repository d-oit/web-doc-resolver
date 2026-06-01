# ADR-012: Correctness & Safety Fixes — Thread Safety, SSRF, Provider Reachability

## Status

Wave 1 COMPLETED (PR #364). Waves 4-6 PENDING.

## Context

Code review on PR #341 and subsequent manual audit identified several classes
of correctness issues across the Python codebase:

- **Thread safety**: `threading.Lock` used where `RLock` was needed; SQLite
  connections used across threads without `check_same_thread=False`; TOCTOU
  races in circuit breaker state reads.
- **SSRF**: `is_safe_url()` validation was applied inconsistently — some
  providers had it, others didn't.
- **Provider reachability**: `resolve_direct()` was missing 4 provider entries;
  `Profile.max_hops()` lacked a default return path.

## Wave 1 — COMPLETED (PR `fix/adr-012-correctness-and-safety`)

| ID | Task | Files | Status |
|----|------|-------|--------|
| T1 | CircuitBreakerRegistry lock + falsy-threshold fix | `scripts/circuit_breaker.py` | ✅ |
| T2 | RoutingMemory lock + magic number→constants | `scripts/routing_memory.py` | ✅ |
| T3 | providers_impl rate-limit lock | `scripts/providers_impl.py` | ✅ |
| T4 | utils session + cache lock | `scripts/utils.py` | ✅ |
| T5 | semantic_cache singleton lock + atomic eviction | `scripts/semantic_cache.py` | ✅ |
| T6 | resolve.py monkey-patch → state.py wiring | `scripts/resolve.py` | ✅ |
| S1 | Mistral browser SSRF check | `scripts/providers_impl.py` | ✅ |
| S2 | is_url() reject ftp/ftps | `scripts/utils.py` | ✅ |
| S3 | safeFetch() initial URL validation | `web/lib/resolvers/url.ts` | ✅ |
| P1 | resolve_direct() missing 4 providers | `scripts/resolve.py` | ✅ |
| P2 | Profile.max_hops() default return | `scripts/models.py` | ✅ |
| | RLock deadlock fix (reentrant lock) | `scripts/utils.py` | ✅ |
| | Conftest lock-safe clearing | `tests/conftest.py` | ✅ |
| | Test updates for is_url() behavior | `tests/test_resolve.py` | ✅ |

### Codacy Review Items (PR #364) — All Addressed

| Comment | Fix |
|---------|-----|
| HIGH: SemanticCache SQLite not thread-safe | Added `check_same_thread=False` + `_conn_lock` |
| MEDIUM: Lock→RLock mismatch in CircuitBreaker | Changed to `threading.RLock()` |
| MEDIUM: Lock→RLock mismatch in RoutingMemory | Changed to `threading.RLock()`, deduplicated `get_domain_stats` |
| MEDIUM: SSRF missing from Jina/Firecrawl | Added `is_safe_url()` checks |
| Minor: Bare except in Mistral browser | Changed to `except Exception as e:` with logging |
| HIGH: TOCTOU race in CircuitBreakerState.is_open | Capture `open_until` once at function entry |

## Waves 4-6 — PENDING

| Wave | Focus | Effort | Dependency |
|------|-------|--------|------------|
| Wave 4 | Logging, quality, synthesis fixes (P3-P7, Q1-Q6) | M | Wave 3 (ADR-014) |
| Wave 5 | New test files for uncovered paths (C1-C7) | L | Wave 3 |
| Wave 6 | Cascade consolidation, budget alignment, DRY cleanup | L | Wave 3 |

## Learnings

- **`threading.RLock` vs `Lock`**: `Lock` deadlocks on recursive acquisition;
  `RLock` is reentrant and safe for nested calls like `_get_from_cache` →
  `_get_cache`.
- **Conftest clearing**: After adding locks, the `autouse` fixture must call
  `.clear()` methods (which hold the lock) instead of direct dict access.
- **Monkey-patching dependency**: `resolve.py` lines 85-91 wire shared instances
  to `_url_resolve`/`_query_resolve`. These overwrites must remain until
  ADR-014 creates `scripts/state.py`.
- **SQLite thread safety**: `check_same_thread=False` + `_conn_lock` is required
  when using SQLite connections across `ThreadPoolExecutor` threads.
- **TOCTOU pattern**: Capture mutable state once at function entry to avoid
  time-of-check-to-time-of-use races.

## References

- [GOAP_FOLLOWUP.md](archive/GOAP_FOLLOWUP.md) — Remaining waves
- [PR #364](https://github.com/d-oit/do-web-doc-resolver/pull/364)
- [ADR-014](014-architecture-and-parity.md) — Prerequisite for Waves 4-6
