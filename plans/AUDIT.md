# Project Audit — 2026-05-13

> Single source of truth for project health. Supersedes all prior audit/bug/issue files in `plans/`.

---

## Previously-Reported Issues — Status

| Issue | Status | Notes |
|---|---|---|
| `references/` directory bloat | ✅ RESOLVED | Deleted |
| `packages/` monorepo | ✅ RESOLVED | Deleted |
| `pnpm-workspace.yaml` | ✅ RESOLVED | Deleted |
| `scripts/resolve.py` 544→193 lines | ✅ RESOLVED | Split into sub-modules |
| `cli/src/resolver.rs` monolith | ✅ RESOLVED | Split into `resolver/{mod,cascade,query,url}.rs` |
| `web/app/api/resolve/route.ts` 602→301 lines | ✅ RESOLVED | Split done |
| Python Serper provider missing | ✅ RESOLVED | `scripts/providers_impl.py` |
| `web-build` duplicate in `ci.yml` | ✅ RESOLVED | Removed |
| `npm test` missing from `ci-ui.yml` | ✅ RESOLVED | Added |
| AGENTS.md Rust edition 2021→2024 | ✅ RESOLVED | Updated |
| Version sync across runtimes | ✅ RESOLVED | All at 0.3.1 |
| Quality score in Web UI | ✅ RESOLVED | `qualityScore` state + display |
| Firecrawl missing in Web UI | ✅ RESOLVED | Restored to `constants.ts` + E2E test added |
| `CLAUDE.md` still exists | ⚪ KEPT | Contains only `@AGENTS.md` redirect — harmless |

---

## Open Issues

### 1. AGENTS.md Accuracy

| # | Issue | Suggestion |
|---|---|---|
| A1 | Repo structure missing `cli/ui/` | Add entry — design system with own AGENTS.md, 14 subdirs |
| A2 | Repo structure missing `docs/` | Add entry — has `docs/standards.md`, `docs/examples/` |
| A3 | Repo structure missing `plans/` | Add entry — this directory |
| A4 | Setup commands missing `cli/ui/` | Add `cd cli/ui && pnpm install` |
| A5 | `CLAUDE.md` redirect | Optional: delete or keep as-is |

### 2. Missing Implementations

| # | Gap | File / Location | Impact | Status |
|---|---|---|---|---|
| M1 | No Next.js error boundary | `web/app/error.tsx` | Unhandled errors crash page | ✅ RESOLVED (exists, 30 lines) |
| M2 | No rate-limiting middleware | `web/middleware.ts` (does not exist) | API abuse possible | ❌ OPEN |
| M3 | No 404 page | `web/app/not-found.tsx` | Generic Next.js 404 | ✅ RESOLVED (exists, 18 lines) |
| M4 | `validateUrl()` SSRF check not called | Defined in `web/lib/validation.ts` (195 lines), unused in `route.ts` | SSRF vulnerability | ✅ RESOLVED (called via `validateUrlForFetchAsync` in `url.ts`) |
| M5 | No unit tests for web utilities | `web/lib/circuit-breaker.ts`, `errors.ts`, `quality.ts`, `keys.ts` | Regression risk | ❌ OPEN |
| M6 | No direct unit tests for Rust resolver | `cli/src/resolver/query.rs` (527 lines), `url.rs` (496 lines) | Low coverage | ❌ OPEN |
| M7 | Mobile/tablet Playwright not in CI | `ci-ui.yml` runs `--project=desktop --project=mobile --project=tablet` (3 projects) | Mobile regressions undetected | ✅ RESOLVED (CI already runs all 3 projects) |
| M8 | 2 of 13 skills have `evals.json` | `.agents/skills/*/` | Skill quality unmeasured | ❌ OPEN — 11 still missing |

### 3. Code Quality

| # | File | Lines | Limit | Action |
|---|---|---|---|---|---|
| Q1 | `web/app/page.tsx` | 496 | 500 | **Near limit** — extract components soon |
| Q2 | `cli/src/resolver/query.rs` | 527 | 500 | **EXCEEDED** — split required |
| Q3 | `cli/src/resolver/url.rs` | 496 | 500 | Near limit — monitor |
| Q4 | `cli/src/semantic_cache.rs` | 1056 | 500 | **CRITICALLY EXCEEDED** — split required |
| Q5 | `cli/src/config.rs` | 712 | 500 | **EXCEEDED** — split required |

### 4. Cross-Platform Parity

| # | Feature | Python | Rust | Web | Gap |
|---|---|---|---|---|---|
| P1 | `exa_mcp_mistral` combo | ❌ | ❌ | ✅ | Port to Python + Rust |
| P2 | Deep research parallel mode | Partial | `--synthesize` only | ✅ | Full parallel mode missing in CLIs |
| P3 | Budget profiles / presets | N/A | `--profile` flag **wired** in `main.rs:68-84` | N/A | ✅ WIRED — but `is_provider_allowed()` + `max_hops()` are dead code in `types.rs:99-116` |
| P8 | Duplicate `build_budget()` fn | N/A | Same fn in `query.rs:506` and `url.rs:475` | N/A | Extract to `cascade.rs` |
| P4 | Preflight routing | `detect_doc_platform()` | Minimal `detectJsHeavy()` | Minimal | Port advanced routing to Rust/Web |
| P5 | Hedged requests | ✅ | ❌ | ❌ | Port to Rust + Web |
| P6 | Routing memory persistence | In-memory only | File persistence | N/A | Add file persistence to Python |
| P7 | Rate throttling (token bucket) | ✅ | ✅ | N/A | Done across CLIs; web remains un-throttled |

### 5. Infrastructure

| # | Issue | Detail |
|---|---|---|
| I1 | Python 3.10 not in CI | `requires-python = ">=3.10"` but CI matrix is 3.11/3.12/3.13 |
| I2 | `cli/ui/` no pnpm lock file in repo | CI uses pnpm but lock file not checked in |
| I3 | Version number question | All at 0.3.1 — verify if should be 1.x |
| I4 | DuckDuckGo CAPTCHA blocking | Externally blocked — deprioritized, monitoring |
| I5 | `cli/ui/` pnpm lock file | Repo uses pnpm; lock file status needs verification |
| I6 | `markdownlint.toml` config not respected | `MD013 = false` set but rule still fires; pre-commit blocks valid docs-only commits | `markdownlint.toml`, `.githooks/pre-commit` |

### 6. Recently Merged Features (since last audit)

| PR | Feature | Merged |
|----|---------|--------|
| #338 | Tiered provider TTL — all cache TTLs in config.toml | ✅ |
| #339 | Startup pre-warm for top-N domains | ✅ |
| #340 | Synthesis alignment with 2026 LLM-ready standards | ✅ |
| #341 | Quality confidence gate — skip paid on high free quality | ✅ |
| #342 | Probabilistic provider skip for low-win-rate/quota-gated | ✅ |
| #343 | Adaptive per-domain provider reordering | ✅ |
| #344-#351 | Dependabot + CI hardening (7 PRs) | ✅ |
| #353 | Semantic cache optimization + observability | ✅ |
| #354 | Transitive vulnerability fix + ecosystem sync | ✅ |
| #356 | Exa MCP monthly usage tracking in routing memory | ✅ |
| #357 | CLI Markdown parsing fix (code blocks, indentation) | ✅ |
| #358 | Per-provider token-bucket rate throttling | ✅ |
| #359-#361 | Template workflows, gitleaks SHA-pins, .gitattributes | ✅ |
| #364 | ADR-012 Wave 1: thread safety, SSRF, provider fixes | ✅ |

### 7. Newly Discovered Issues (2026-05-13 Audit)

| ID | Issue | File | Severity |
|----|-------|------|----------|
| N1 | `semantic_cache.rs` 1056 lines — **2x** the 500-line limit | `cli/src/semantic_cache.rs` | P0 |
| N2 | `config.rs` 712 lines — **exceeds** 500-line limit | `cli/src/config.rs` | P0 |
| N3 | `build_budget()` duplicated verbatim in 2 files | `query.rs:506` + `url.rs:475` | P1 |
| N4 | Dead `Profile::is_provider_allowed()` + `max_hops()` — never called | `cli/src/types.rs:99-116` | P2 |
| N5 | `CircuitBreakerRegistry.is_open()` — TOCTOU: state object used outside lock scope | `scripts/circuit_breaker.py:46-47` | P1 |
| N6 | `_maybe_evict()` not independently lock-protected | `scripts/semantic_cache.py:336` | P2 |
| N7 | 11/13 skills missing `evals.json` | `.agents/skills/*/` | P2 |
| N8 | No `pnpm-lock.yaml` anywhere in repo | `cli/ui/`, `web/` | P2 |
| N9 | `duckduckgo-search` vs `ddgs` package name mismatch | `requirements.txt:9` | P1 |
| N10 | `setup-hooks.sh` only validates symlinks, not quality gate | `scripts/setup-hooks.sh` | P2 |
| N11 | CI runs 3 Playwright projects; AGENTS.md says 1 | `ci-ui.yml:176` vs `AGENTS.md:55` | P2 |
| N12 | Raw `requests.post()` in synthesis — no SSRF, no retry, no shared session | `scripts/synthesis.py:165` | P1 |

---

## Additional Learnings (post-2026-05-05)

### Provider Rate Throttling
- **Token bucket design**: Clamp `capacity` to `max(1.0, ·)` to prevent infinite acquire loops
- **Avoid polling**: Calculate exact sleep duration instead of fixed-interval polling
- **Cascade safety**: `acquire_timeout()` so rate-limited providers fall back instead of blocking cascade
- **Config merge**: Target specific `rate_limit` fields rather than wholesale `ProviderConfig` replacement

### Feature Implementation Patterns
- **Quality confidence gate**: Free-tier results evaluated against 0.70 threshold; if met, paid providers skipped
- **Probabilistic skip**: Providers with low win rate get skip probability proportional to fail ratio
- **Adaptive reordering**: Routing memory ranks providers by domain performance per-profile
- **Exa MCP tracking**: Monthly usage count stored in routing memory DB; resets on provider cooldown

## Priority Actions

### Previously Resolved (removed from active priority actions)

| Old # | Action | Status |
|-------|--------|--------|
| 5 (old) | Split `query.rs` into sub-modules | Still OPEN — moved to P0 #3 |
| 6 (old) | Add mobile + tablet Playwright to CI | ✅ RESOLVED — already runs 3 projects |
| 8 (old) | Wire Rust `--profile` to budget presets | ✅ RESOLVED — wired in `main.rs:68-84` |

### P0 — Critical (do now)

| # | Action | File | Status |
|---|---|---|---|
| 1 | Call `validateUrl()` before resolution | `web/app/api/resolve/route.ts` | ✅ RESOLVED (called in url.ts) |
| 2 | Create error boundary | `web/app/error.tsx` | ✅ RESOLVED (exists) |
| 3 | Split `query.rs` (527 > 500 limit) | `cli/src/resolver/query.rs` | ❌ OPEN — EXCEEDED |
| 4 | Split page component (496, near limit) | `web/app/page.tsx` | ⚠️ Near limit — monitor |
| 5 | Split `semantic_cache.rs` (1056 > 500 limit) | `cli/src/semantic_cache.rs` | ❌ OPEN — CRITICALLY EXCEEDED |
| 6 | Split `config.rs` (712 > 500 limit) | `cli/src/config.rs` | ❌ OPEN — EXCEEDED |

### P1 — High (next sprint)

| # | Action | File / Area |
|---|---|---|
| 7 | Create rate-limiting middleware | `web/middleware.ts` |
| 8 | Unit tests for web utilities (6 files: circuit-breaker, errors, quality, keys, log, results) | `web/lib/*.ts` |
| 9 | Fix `CircuitBreakerRegistry.is_open()` TOCTOU | `scripts/circuit_breaker.py:46-47` |
| 10 | Fix 7 silent exception handlers in providers | `scripts/providers_impl.py` |
| 11 | Replace raw `requests.post()` with shared session + SSRF in synthesis | `scripts/synthesis.py:165` |
| 12 | Extract duplicate `build_budget()` to cascade.rs | `query.rs:506` + `url.rs:475` |
| 13 | Fix CI/config issues (coverage upload, gitleaks, flake8, shellcheck severity) | `.github/workflows/`, `.pre-commit-config.yaml` |

### P2 — Medium (roadmap)

| # | Action | Area |
|---|---|---|
| 15 | Port preflight routing to Rust + Web | Cross-platform |
| 16 | Add hedged requests to Rust | `cli/src/resolver/cascade.rs` |
| 17 | Add `evals.json` to more skills (11/13 missing) | `.agents/skills/*/` |
| 18 | Add Python 3.10 to CI or bump `requires-python` | `pyproject.toml`, `.github/workflows/ci.yml` |
| 19 | Add `evals.json` to 3 most-used skills | `.agents/skills/*/` |
| 20 | Remove dead `Profile::is_provider_allowed()` + `max_hops()` | `cli/src/types.rs:99-116` |
| 21 | Remove dead `NegativeCacheEntry` dataclass | `scripts/cache_negative.py:11-16` |
| 22 | Extract magic numbers in quality.py to named constants | `scripts/quality.py` |

### P3 — Low (nice to have)

| # | Action | Area |
|---|---|---|
| 23 | Port `exa_mcp_mistral` combo to Python + Rust | Cross-platform |
| 24 | Full `--deep-research` parallel mode for CLIs | Python + Rust |
| 25 | File-based routing memory for Python | `scripts/` |
| 26 | Anchor `preflight_route` patterns with word boundaries | `scripts/routing.py:157-158` |
| 27 | Add lock guard to `_maybe_evict()` | `scripts/semantic_cache.py:336` |
| 28 | Fix `setup-hooks.sh` to install full quality gate | `scripts/setup-hooks.sh` |

---

## Plans Directory Cleanup

### Files Already Deleted (completed — listed here for history)

All 11 files listed in the initial audit (`BUGS_AND_ISSUES.md`, `IMPLEMENTATION_PLAN.md`,
`SWARM_ANALYSIS_SUMMARY.md`, `CODEBASE_AUDIT_2026_04_01.md`, `FEATURE_IMPROVEMENTS_2026_04_01.md`,
`ADDITIONAL_IMPROVEMENTS_PLAN.md`, `AI_AGENT_INSTRUCTIONS_ANALYSIS.md`, `UI_ENHANCEMENTS_PLAN.md`,
`UI_UX_BEST_PRACTICES.md`, `WEB_AUDIT_RESULTS.md`, `PROVIDER_SCORE_OPTIMIZATION.md`)
were already deleted before this audit and confirmed not present.

### Current Files

| File | Topic | Status |
|---|---|---|
| `01-architecture-improvements.md` | PyO3, async mutex, provider trait | Condensed (~36 lines) |
| `02-new-providers.md` | 7 new provider integrations | Condensed (~28 lines) |
| `03-performance-optimization.md` | 10 optimizations | Condensed (~46 lines) |
| `04-new-features.md` | Batch API, streaming, webhooks | Condensed (~28 lines) |
| `05-ui-ux-improvements.md` | Stepper, streaming UI | Condensed (~35 lines) |
| `06-testing-improvements.md` | Security tests, parity tests | Condensed (~37 lines) |
| `07-documentation-improvements.md` | Tutorials, ADRs | Condensed (~39 lines) |
| `08-deep-research.md` | Deep research framework | Condensed (~31 lines) |
| `009-cross-runtime-analysis.md` | ADR: cross-runtime parity | New |
| `10-pr341-quality-gate-fixes.md` | PR #341 merge resolution | Standalone |
| `11-cache-prewarming.md` | ADR-011: cache pre-warming follow-up | Standalone |
| `012-correctness-and-safety-fixes.md` | ADR-012: thread safety, SSRF | New |
| `013-test-coverage-and-ci-reliability.md` | ADR-013: CI fixes, test gaps | New |
| `014-architecture-and-parity.md` | ADR-014: DRY consolidation | New |
| `15-GOAP-NEXT-PHASE.md` | Next implementation wave | Superseded by 16 |
| `16-GOAP-WAVE2-6.md` | Comprehensive 7-wave plan | Active |

---

## Cross-Reference

| Document | Purpose |
|---|---|
| `AGENTS.md` (root) | Project conventions, setup, structure |
| `CHANGELOG.md` | Release history |
| `agents-docs/DEVELOPMENT.md` | Developer guide |
| `agents-docs/DEPLOYMENT.md` | Deployment procedures |
| `agents-docs/RELEASES.md` | Release workflow |

---

*Last updated: 2026-05-13. ADR-012 Wave 1 ✅. ADR-013 Wave 1b ✅. Next: Waves 2-7. See [16-GOAP-WAVE2-6.md](16-GOAP-WAVE2-6.md).*

## Learnings (captured 2026-05-12)

### Rate Limiter Implementation Patterns
- **Token bucket**: Clamp `capacity` to `max(1.0, ·)` in constructor to prevent infinite acquire loops
- **Avoid polling**: Calculate exact sleep duration `(1.0 - tokens) / rate` instead of fixed-interval polling
- **Cascade safety**: Use `acquire_timeout()` so rate-limited providers fall back instead of blocking the entire cascade
- **Consolidated state**: Single `Mutex<BucketState>` is cleaner than multiple `Arc<Mutex<T>>`
- **Config merge**: Target specific fields (`rate_limit`) rather than wholesale `ProviderConfig` replacement to preserve future fields

### CI / Infrastructure
- **libsql test flakiness**: `libsql` uses a global `Once` for threading config — tests must run with `--test-threads=1` to avoid cascade poisoning; pinned in CI at `.github/workflows/ci.yml`
- **Rate limit env vars**: Follow existing pattern — `DO_WDR_RATE_LIMIT_<PROVIDER>_{RPS,BURST}` with granular field targeting in `Config::load()`

### ADR-012 Wave 1 (2026-05-13)
- **`threading.Lock` is non-reentrant**: Calling `_get_cache()` (which acquires `_cache_lock`) from within `_get_from_cache()` (which also holds `_cache_lock`) causes a deadlock. Use `threading.RLock` for nested lock acquisition.
- **Conftest needs lock-safe clearing**: After adding locks to RoutingMemory/CircuitBreakerRegistry, the conftest `autouse` fixture must call `.clear()` methods (which hold the lock) instead of directly accessing `.domain_stats.clear()` or `.breakers.clear()`.
- **CircuitBreakerRegistry and RoutingMemory need RLock**: PR review flagged `threading.Lock` vs `threading.RLock`. Fixed: `rank_providers()` calls `get_domain_stats()` which re-enters the same lock — requires RLock for recursive acquisition.
- **Semantic cache SQLite needs `check_same_thread=False`**: SQLite's default `check_same_thread=True` causes `ProgrammingError` when the connection is used across `ThreadPoolExecutor` threads. Fix: set `check_same_thread=False` + add `_conn_lock` for serialized access.
- **SSRF validation must be consistent**: Codacy review flagged that Mistral browser got SSRF check but Jina and Firecrawl didn't. Fixed: added `is_safe_url()` to all URL-fetching providers.
- **Monkey-patching is a necessary evil**: `resolve.py` lines 85-91 wire shared instances to `_url_resolve`/`_query_resolve`. Until ADR-014 creates `scripts/state.py`, these overwrites must remain — tests depend on them for state synchronization.
- **Test suite runs in ~60s**: The full non-live suite runs in ~60 seconds. The `pre-commit` hook timeout was caused by a deadlock, not slow tests.

### GOAP Audit 2026-05-13
- **`TOCTOU` in CircuitBreakerRegistry.is_open()**: The registry acquires `self._lock` in `get_breaker()` to retrieve the state object, but the caller's subsequent `.is_open()` on the returned state runs **outside** the lock. The state's `open_until` field can be mutated by another thread between retrieval and check. Fix: inline the comparison inside the locked method or return a snapshot.
- **Raw `requests.post()` bypasses shared session**: `synthesis.py:165` calls `requests.post()` directly instead of `get_session().post()`. This loses: retry logic (3 attempts), connection pooling, SSRF validation (`is_safe_url()`), and consistent User-Agent headers. The shared session in `utils.py` has `Retry(total=3, backoff_factor=1.0)`.
- **`semantic_cache.rs` (1056 lines) is the largest file in the project**: Nearly 2x the 500-line limit. It needs splitting into sub-modules — likely `{mod,store,query,eviction}.rs` — to stay maintainable.
- **`Profile` dead methods**: `is_provider_allowed()` and `max_hops()` at `types.rs:99-116` are never called in the cascade. The budget is managed via `ResolutionBudget` from `routing_profile_defaults()`, making these methods pure dead code.
- **Duplicate `build_budget()`**: The exact same 22-line function exists in both `query.rs:506-527` and `url.rs:475-496`. After extracting to `cascade.rs`, this alone saves 44 lines and eliminates drift risk.
- **Mobile/tablet Playwright already in CI**: `ci-ui.yml:176` runs `--project=desktop --project=mobile --project=tablet`. The AUDIT was incorrect — this was already resolved. We updated the status.
- **Rust `--profile` flag is wired**: `main.rs:68-84` parses the profile string and applies budget presets. The AUDIT was incorrect — this was already implemented. We updated the status.
