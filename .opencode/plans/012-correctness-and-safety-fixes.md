# ADR-012: Correctness & Safety Fixes

**Date:** 2026-05-12
**Status:** Proposed
**Context:** Deep audit of Python (`scripts/`), Rust (`cli/src/`), and Web (`web/`) runtimes uncovered 15 critical bugs, security gaps, and misleading implementations that risk data corruption, silent failures, or security exploits.

---

## Goal

Fix all critical bugs, security vulnerabilities, and misleading code paths so that every provider can be reached, every shared state is thread-safe, and no production path silently fails or bypasses security checks.

---

## GOAP Waves

### Wave 1: Thread Safety & Shared State (Day 1)

| ID | File | Action | Severity |
|----|------|--------|----------|
| T1 | `scripts/circuit_breaker.py` | Add `threading.Lock` to `CircuitBreakerRegistry.register()` and `is_open()`. Wrap `breakers` dict access. Fix falsy-threshold bug: `threshold if threshold is not None else self.default_threshold` | HIGH |
| T2 | `scripts/routing_memory.py` | Add `threading.Lock` to `RoutingMemory.record()` and `rank_providers()`. Wrap `domain_stats` access. Extract scoring magic numbers (`0.5`, `7.0`, `1000.0`) to `SCORE_BASE`, `RECENCY_DECAY_DAYS`, `SCORE_SCALE` | HIGH |
| T3 | `scripts/providers_impl.py` | Add `threading.Lock` around `_rate_limits`. Move `MAX_CHARS`, `MIN_CHARS`, `DEFAULT_TIMEOUT` to single source `scripts/constants.py` | HIGH |
| T4 | `scripts/utils.py` | Add `threading.Lock` around `_global_session` and `_cache`. Move shared constants to `scripts/constants.py` | HIGH |
| T5 | `scripts/semantic_cache.py` | Add `threading.Lock` to singleton creation. Make `_maybe_evict()` atomic: batch DELETE in a single transaction | HIGH |
| T6 | `scripts/resolve.py` | Remove monkey-patching (lines 84-87). Create shared instances in `scripts/state.py`, import from both `_url_resolve.py` and `_query_resolve.py` | HIGH |

### Wave 2: Provider Reachability & Resolve Bugs (Day 2)

| ID | File | Action | Severity |
|----|------|--------|----------|
| P1 | `scripts/resolve.py:176-190` | Add `ProviderType.LLMS_TXT`, `SERPER`, `DOCLING`, `OCR` to `resolve_direct()` dispatch dict | HIGH |
| P2 | `scripts/models.py:41-49` | Add `else: return 4` to `Profile.max_hops()` default | MEDIUM |
| P3 | `scripts/providers_impl.py` | Replace all `except Exception: return None` with `except Exception as e: _log.warning(...)` | HIGH |
| P4 | `scripts/synthesis.py:165-179` | Replace `requests.post` with `get_session().post()`. Extract `MISTRAL_API_URL`, `MISTRAL_MODEL`, `SYNTHESIS_TIMEOUT` constants | MEDIUM |
| P5 | `scripts/routing.py:158` | Fix `preflight_route` loose pattern matching with exact hostname comparison | MEDIUM |
| P6 | `scripts/cache_negative.py:11-16` | Remove unused `NegativeCacheEntry` dataclass or wire it into actual usage | LOW |
| P7 | `scripts/utils.py:36` | Remove dead `TIERED_TTL["exa_mcp"]` entry; add comment explaining key normalization | LOW |

### Wave 3: SSRF & Security Hardening (Day 3)

| ID | File | Action | Severity |
|----|------|--------|----------|
| S1 | `scripts/providers_impl.py:259-313` | Add `is_safe_url(url)` check before Mistral browser agent call | HIGH |
| S2 | `scripts/utils.py:229-236` | Make `is_url()` reject `ftp://` and `ftps://` schemes | HIGH |
| S3 | `web/lib/resolvers/url.ts:7-50` | Add `validateUrlForFetchAsync(url)` at top of `safeFetch()` | MEDIUM |
| S4 | `scripts/utils.py:82-91` | Change `BLOCKED_NETWORKS` from `list` to `tuple` | LOW |
| S5 | `web/app/api/resolve/route.ts:249-255` | Add debug-level logging when user API key overrides server env var | LOW |
| S6 | `web/next.config.mjs:8` | Replace `hostname: "**"` with restricted allowlist or add tradeoff comment | LOW |

### Wave 4: Quality & Scoring Fixes (Day 3-4)

| ID | File | Action | Severity |
|----|------|--------|----------|
| Q1 | `scripts/quality.py:20-21` | Remove `isinstance` branch returning perfect score. Extract magic numbers to named constants | MEDIUM |
| Q2 | `scripts/quality.py` | Add docstring to `score_content()` | LOW |
| Q3 | `scripts/resolve.py` | Fix `__all__` to exclude private names; keep underscores on `_is_rate_limited`/`_set_rate_limit` | LOW |
| Q4 | `scripts/utils.py:295-314` | Rename `score_result()` to `score_domain_trust()` to differentiate from `quality.score_content()` | MEDIUM |
| Q5 | `scripts/utils.py:516` | Remove dead `fragment` conditional | LOW |
| Q6 | `scripts/utils.py:637-677` | Refactor `_detect_error_type` to pattern-list lookup | LOW |

### Wave 5: Cross-Runtime Alignment (Day 4)

| ID | File | Action | Severity |
|----|------|--------|----------|
| R1 | `scripts/resolve.py:60` / `web/lib/resolvers/url.ts:5` | Align `MIN_CHARS` default to 200 everywhere | MEDIUM |
| R2 | `scripts/quality.py:57` / `web/lib/quality.ts:38` / `cli/src/quality.rs` | Use profile-based configurable thresholds; stop hardcoding `0.65` | HIGH |
| R3 | `web/lib/routing.ts:76-103` | Add `availableProviders: Set<string>` parameter to `planProviderOrder()` | MEDIUM |
| R4 | `web/app/api/resolve/route.ts:147-177` | Refactor `resolveUrl()` to return `{ content, provider, latency, quality }` | HIGH |
| R5 | `web/app/api/resolve/route.ts:21-68` | Pass `maxChars` to all provider functions | HIGH |
| R6 | `cli/src/resolver/url.rs:152-154` | Apply `max_chars`/`min_chars` after Docling/OCR extraction | MEDIUM |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Thread locks add latency to hot paths | Low | Use `threading.Lock` (not `RLock`); benchmark before/after |
| Removing `isinstance` branch breaks test mocks | Medium | Update mocks to pass actual strings; add `TypeError` test |
| Mistral SSRF check blocks legitimate URLs | Low | `is_safe_url` already allows all public IPs |
| Aligning `MIN_CHARS` 50→200 rejects shorter web results | Low | 200 is already the Python default; web was under-filtering |
| Refactoring `resolveUrl()` changes web API contract | Medium | Return type becomes object; update `page.tsx` consumer |

## Postconditions

1. All shared mutable state is thread-safe
2. No monkey-patched module state — shared instances via `scripts/state.py`
3. All `ProviderType` values reachable from `resolve_direct()`
4. All provider exceptions logged (not silently swallowed)
5. SSRF validation on every external API call path
6. Quality scoring uses only real string input; no magic numbers
7. Cross-runtime `MIN_CHARS`, quality thresholds, `maxChars` aligned
8. `resolveUrl()` returns metadata; `safeFetch()` validates initial URL

## Related ADRs

- [ADR-009](009-cross-runtime-analysis.md) — Cross-runtime parity findings
- [ADR-010](10-pr341-quality-gate-fixes.md) — Quality confidence gate
- [ADR-014](014-architecture-and-parity.md) — DRY violations and cascade consolidation