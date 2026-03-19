# ADR-001: GitHub Issue Decomposition & Task Plan

**Date:** 2026-03-19
**Status:** Implemented
**Context:** 4 open enhancement issues (#59, #62, #63, #64) + recurring CI failures on integration tests

## Problem Summary

The project has accumulated 4 major enhancement issues and recurring CI failures. The CI integration tests (Mistral, Firecrawl, Tavily) all fail with `ModuleNotFoundError: No module named 'scripts'` because the workflow runs `python scripts/resolve.py` directly instead of as a module.

## CI Failure Root Cause

`scripts/resolve.py` uses absolute package imports (`import scripts.cache_negative`, etc.). When invoked as `python scripts/resolve.py`, Python adds the `scripts/` directory to `sys.path`, not the parent — so `scripts` is not resolvable as a package.

**Fix:** Change integration test steps from `python scripts/resolve.py` to `python -m scripts.resolve`.

---

## Issue #64: Post-Retrieval Optimizations

**Title:** Hedged requests, two-stage synthesis gating, streaming partial results
**Size:** Large (3 features)
**Dependencies:** None (builds on existing parallel architecture)

### Decomposed Tasks

#### T64.1: Two-Stage Synthesis Gate
- **File:** `scripts/synthesis.py`
- **What:** Before calling Mistral, run deterministic post-processing (merge, deduplicate, link-validate, score). Call Mistral only when sources conflict, coverage is fragmented, or confidence < threshold.
- **Config:** Gate condition configurable, visible in telemetry
- **Acceptance:** Synthesis skipped for simple/cached/complete retrievals
- **Tests:** Verify Mistral not called when sources pass acceptance criteria

#### T64.2: Hedged Requests with Cancellation
- **File:** `scripts/routing.py` (new: extend `plan_provider_order`)
- **What:** Start second provider after configurable latency threshold. Cancel losing request once one clears acceptance criteria.
- **Config:** Threshold per execution profile
- **Acceptance:** Hedging activates only after threshold, cancelled requests cleaned up
- **Tests:** Verify cancellation, resource cleanup, budget compliance

#### T64.3: Streaming Partial Results
- **File:** `scripts/resolve.py`
- **What:** Emit cache hits and first-provider results as partial stream before synthesis finishes. Continue synthesis in background.
- **Config:** Toggle via `--stream` flag or execution profile
- **Acceptance:** At least one partial result emitted before synthesis completes
- **Tests:** Verify partial output precedes final output

#### T64.4: Integration & Telemetry
- **Files:** `scripts/resolve.py`, `scripts/utils.py`
- **What:** All three features independently toggleable via config. Gate decision logged in telemetry with reason.
- **Acceptance:** No regression on existing quality benchmarks

---

## Issue #63: Cache-Key Normalization & Preflight Routing

**Title:** Canonical cache-key normalization and cheap preflight routing classifier
**Size:** Medium
**Dependencies:** None

### Decomposed Tasks

#### T63.1: Canonical Cache-Key Normalization
- **File:** `scripts/utils.py`
- **What:** Before semantic-cache lookup, normalize inputs:
  - Strip tracking/UTM params from URLs
  - Normalize redirects and doc-site aliases
  - Collapse anchor-only URL variants where safe
  - Normalize query aliases and stop-word differences
  - Lowercase and trim whitespace
- **Acceptance:** Cache hit rate improves on repeated equivalent URLs and query variants
- **Tests:** Verify normalization of tracking params, anchors, redirect patterns

#### T63.2: Cheap Preflight Routing Classifier
- **File:** `scripts/routing.py`
- **What:** Low-cost probe before committing to fetch strategy:
  - Detect likely doc platforms (GitBook, Sphinx, MkDocs, Notion, Confluence)
  - Inspect content-type headers, auth barriers, JS-heaviness signals, redirect depth
  - Route early between direct fetch, llms.txt/Jina, crawl-heavy, or browser-style
- **Performance:** Must be <50ms in critical path
- **Acceptance:** Mean fallback depth decreases (fewer provider hops per request)
- **Tests:** Verify platform detection, routing decisions

#### T63.3: Telemetry for Normalization & Preflight
- **File:** `scripts/utils.py`
- **What:** Telemetry reports normalization hits and preflight routing decisions separately
- **Acceptance:** Telemetry clearly shows when normalization or preflight affected routing

---

## Issue #62: Distribution & Packaging

**Title:** Publish installable distribution targets and simplify CLI onboarding
**Size:** Large (multi-platform)
**Dependencies:** None

### Decomposed Tasks

#### T62.1: Fix pyproject.toml Entry Points
- **File:** `pyproject.toml`
- **What:** Ensure `wdr` and `web-doc-resolver` console scripts work. Verify `pip install -e .` and `pip install .` produce working CLI.
- **Acceptance:** `pip install -e .` then `wdr --help` works
- **Tests:** CI `sample` job already validates this

#### T62.2: CI Publish to PyPI on Tagged Release
- **File:** `.github/workflows/release.yml`
- **What:** Add PyPI publish step using trusted publishing (OIDC) on version tags
- **Acceptance:** Pushing `v*` tag triggers PyPI publish
- **Tests:** Verify workflow triggers on tag push

#### T62.3: Prebuilt Binary Artifacts in GitHub Releases
- **File:** `.github/workflows/release.yml`
- **What:** Build Rust CLI for Linux/macOS/Windows, attach to GitHub Release
- **Matrix:** `ubuntu-latest`, `macos-latest`, `windows-latest`
- **Acceptance:** GitHub Releases include binaries for all 3 platforms
- **Tests:** Verify artifact upload in release workflow

#### T62.4: README Install Matrix
- **File:** `README.md`
- **What:** Document install paths: pip, pipx, prebuilt binary, cargo
- **Acceptance:** One canonical quickstart path clearly recommended

#### T62.5: crates.io Publish (Optional)
- **File:** `cli/Cargo.toml`
- **What:** If Rust CLI is standalone, publish to crates.io
- **Acceptance:** `cargo install web-doc-resolver` works

---

## Issue #59: Budget-Aware Routing, Negative Caching, Circuit Breakers

**Title:** Implement budget-aware routing, negative caching, and provider circuit breakers
**Size:** Large (6 components)
**Dependencies:** Benefits from #63 (preflight routing)

### Decomposed Tasks

#### T59.1: Resolution Budget Model
- **File:** `scripts/routing.py`
- **What:** `ResolutionBudget` dataclass with `max_provider_attempts`, `max_paid_attempts`, `max_total_latency_ms`, `allow_paid`. Profile mapping for `free`, `balanced`, `fast`, `quality`.
- **Acceptance:** `free` never calls paid providers, `fast` stops after low budget, `quality` continues longer
- **Tests:** Budget enforcement per profile

#### T59.2: Provider Result Quality Scoring
- **File:** `scripts/quality.py` (new)
- **What:** `QualityScore` dataclass scoring content on length, links, duplicates, noise. Accept threshold configurable per profile.
- **Acceptance:** Very short content rejected, good markdown with links accepted, duplicate/noisy triggers fallback
- **Tests:** Scoring heuristics, accept/reject thresholds

#### T59.3: Negative Cache Entries
- **File:** `scripts/cache_negative.py`
- **What:** `NegativeCacheEntry` with reasons (`llms_txt_not_found`, `auth_required`, `rate_limited`, `thin_content`, `js_heavy_page`, `provider_timeout`, `provider_5xx`). TTLs per reason.
- **Acceptance:** `llms.txt` miss prevents reprobe during TTL, timeout/rate-limit entries skip provider
- **Tests:** TTL expiry, reason-specific behavior

#### T59.4: Provider Circuit Breakers
- **File:** `scripts/circuit_breaker.py`
- **What:** `CircuitBreakerState` tracking failures, opening after threshold (default 3), cooldown period (default 300s). Success resets.
- **Acceptance:** Provider opens after threshold, open provider skipped, success resets breaker
- **Tests:** Failure accumulation, cooldown, reset

#### T59.5: Per-Domain Routing Memory
- **File:** `scripts/routing_memory.py`
- **What:** `RoutingMemory` tracking per-domain/provider success rate, avg latency, avg quality. Reorders provider preference based on history.
- **Acceptance:** Domains with strong prior success reorder provider preference
- **Tests:** Domain learning, provider ranking

#### T59.6: Centralized Provider Selection Planner
- **File:** `scripts/routing.py`
- **What:** Single `plan_provider_order()` combining: skip providers, custom order, routing memory, circuit breakers, negative cache
- **Acceptance:** Existing skip-provider and custom-order behavior preserved
- **Tests:** Regression on existing cascade behavior

#### T59.7: Routing Telemetry
- **File:** `scripts/utils.py`
- **What:** Structured telemetry per resolve attempt: provider, attempt index, latency, quality score, accepted, skip reason, stop reason, cache/negative-cache/circuit status
- **Acceptance:** Telemetry clearly shows routing/skip/stop decisions

---

## Implementation Order

### Phase 1: Fix CI (Critical - blocks all development)
1. **T-CI.1:** Fix integration test invocations in `.github/workflows/ci.yml` (`python -m scripts.resolve`)

### Phase 2: Foundation (#59 infrastructure)
2. **T59.2:** Quality scoring module
3. **T59.1:** Budget model
4. **T59.3:** Negative cache
5. **T59.4:** Circuit breakers
6. **T59.5:** Routing memory
7. **T59.6:** Centralized planner
8. **T59.7:** Routing telemetry

### Phase 3: Optimization (#63 builds on #59)
9. **T63.1:** Cache-key normalization
10. **T63.2:** Preflight classifier
11. **T63.3:** Telemetry for normalization/preflight

### Phase 4: Post-Retrieval (#64 builds on #59)
12. **T64.1:** Synthesis gate
13. **T64.2:** Hedged requests
14. **T64.3:** Streaming partial results
15. **T64.4:** Integration & telemetry

### Phase 5: Distribution (#62 independent)
16. **T62.1:** Fix entry points
17. **T62.2:** PyPI publish workflow
18. **T62.3:** Prebuilt binaries
19. **T62.4:** README install matrix
20. **T62.5:** crates.io (optional)

---

## Task Dependency Graph

```
T-CI.1 (fix CI)
  |
  v
Phase 2 (#59 foundation)
  T59.2 -> T59.1 -> T59.3 -> T59.4 -> T59.5 -> T59.6 -> T59.7
  |
  v
Phase 3 (#63 optimization)
  T63.1 -> T63.2 -> T63.3
  |
  v
Phase 4 (#64 post-retrieval)
  T64.1 -> T64.2 -> T64.3 -> T64.4

Phase 5 (#62 distribution) — independent, can run in parallel
  T62.1 -> T62.2 -> T62.3 -> T62.4 -> T62.5
```

---

## Atomic Commit Convention

Each task gets one atomic commit following the pattern:
```
<type>(<scope>): <description>

<body with task ID reference>
```

Examples:
- `fix(ci): use python -m scripts.resolve in integration tests [T-CI.1]`
- `feat(routing): add quality scoring module [T59.2]`
- `feat(routing): add resolution budget model [T59.1]`
- `feat(cache): add negative cache entries [T59.3]`
- `feat(routing): add provider circuit breakers [T59.4]`
- `feat(routing): add per-domain routing memory [T59.5]`
- `feat(routing): add centralized provider selection planner [T59.6]`
- `feat(telemetry): add structured routing telemetry [T59.7]`
- `feat(cache): add canonical cache-key normalization [T63.1]`
- `feat(routing): add preflight routing classifier [T63.2]`
- `feat(telemetry): add normalization/preflight telemetry [T63.3]`
- `feat(synthesis): add two-stage synthesis gate [T64.1]`
- `feat(routing): add hedged requests with cancellation [T64.2]`
- `feat(resolve): add streaming partial results [T64.3]`
- `feat(resolve): integrate post-retrieval optimizations [T64.4]`
- `fix(build): fix pyproject.toml entry points [T62.1]`
- `ci(release): add PyPI publish on tagged release [T62.2]`
- `ci(release): add prebuilt binary artifacts [T62.3]`
- `docs(readme): add install matrix [T62.4]`
- `feat(build): publish to crates.io [T62.5]`
