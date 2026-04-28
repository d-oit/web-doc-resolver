# Project Audit — 2026-04-28

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
| `CLAUDE.md` still exists | ⚪ KEPT | Contains only `@AGENTS.md` redirect — harmless |

---

## 2026-04-28 Updates — P0/P1 Items Resolved

| Issue | Status | Resolution |
|---|---|---|
| M1: No Next.js error boundary | ✅ RESOLVED | `web/app/error.tsx` exists |
| M2: No rate-limiting middleware | ✅ RESOLVED | `web/middleware.ts` created, uses `lib/rate-limit.ts` |
| M3: No 404 page | ✅ RESOLVED | `web/app/not-found.tsx` exists |
| M4: SSRF check not called | ✅ RESOLVED | `validateUrlForFetchAsync()` called in `route.ts:232` |
| M5: No unit tests for web utilities | ✅ RESOLVED | Tests added: `circuit-breaker.test.ts`, `errors.test.ts`, `quality.test.ts`, `keys.test.ts` |
| M7: Mobile/tablet Playwright not in CI | ✅ RESOLVED | `ci-ui.yml` includes `--project=desktop --project=mobile --project=tablet` with `--workers=3` |
| Q1: `page.tsx` exceeds 500 lines | ✅ RESOLVED | Split: `page.tsx` (356 lines), `Sidebar.tsx` (272), `MainContent.tsx` (201), `KeyboardShortcutsModal.tsx` (45), `constants.ts` (31) |
| Issue #281: CI E2E timeout | ✅ RESOLVED | Timeout 45min, parallel workers, quality-gate includes web-e2e, skip dependabot |
| Issue #282: Flaky benchmark | ✅ RESOLVED | P95 latency threshold, 5 warm-up iterations |

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

| # | Gap | File / Location | Impact |
|---|---|---|---|
| M1 | No Next.js error boundary | `web/app/error.tsx` (does not exist) | Unhandled errors crash page |
| M2 | No rate-limiting middleware | `web/middleware.ts` (does not exist) | API abuse possible |
| M3 | No 404 page | `web/app/not-found.tsx` (does not exist) | Generic Next.js 404 |
| M4 | `validateUrl()` SSRF check not called | Defined in `web/lib/resolvers/index.ts`, unused in `web/app/api/resolve/route.ts` | SSRF vulnerability |
| M5 | No unit tests for web utilities | `web/lib/circuit-breaker.ts`, `errors.ts`, `quality.ts`, `keys.ts` | Regression risk |
| M6 | No direct unit tests for Rust resolver | `cli/src/resolver/query.rs` (480 lines), `url.rs` (444 lines) | Low coverage |
| M7 | Mobile/tablet Playwright not in CI | `ci-ui.yml` runs `--project=desktop` only | Mobile regressions undetected |
| M8 | 11 of 13 skills have no `evals.json` | `.agents/skills/*/` | Skill quality unmeasured |

### 3. Code Quality

| # | File | Lines | Limit | Action |
|---|---|---|---|---|
| Q1 | `web/app/page.tsx` | 730 | 500 | **Split required** — extract components |
| Q2 | `cli/src/resolver/query.rs` | 480 | 500 | Monitor — close to limit |
| Q3 | `cli/src/resolver/url.rs` | 444 | 500 | OK |

### 4. Cross-Platform Parity

| # | Feature | Python | Rust | Web | Gap |
|---|---|---|---|---|---|
| P1 | `exa_mcp_mistral` combo | ❌ | ❌ | ✅ | Port to Python + Rust |
| P2 | Deep research parallel mode | Partial | `--synthesize` only | ✅ | Full parallel mode missing in CLIs |
| P3 | Budget profiles / presets | N/A | `--profile` flag exists, not wired | N/A | Wire Rust flag to presets |
| P4 | Preflight routing | `detect_doc_platform()` | Minimal `detectJsHeavy()` | Minimal | Port advanced routing to Rust/Web |
| P5 | Hedged requests | ✅ | ❌ | ❌ | Port to Rust + Web |
| P6 | Routing memory persistence | In-memory only | File persistence | N/A | Add file persistence to Python |

### 5. Infrastructure

| # | Issue | Detail |
|---|---|---|
| I1 | Python 3.10 not in CI | `requires-python = ">=3.10"` but CI matrix is 3.11/3.12/3.13 |
| I2 | `cli/ui/` no pnpm lock file in repo | CI uses pnpm but lock file not checked in |
| I3 | Version number question | All at 0.3.1 — verify if should be 1.x |
| I4 | DuckDuckGo CAPTCHA blocking | Externally blocked — deprioritized, monitoring |

---

## Priority Actions

### P0 — Critical (do now)

| # | Action | File |
|---|---|---|
| 1 | Call `validateUrl()` before resolution | `web/app/api/resolve/route.ts` |
| 2 | Create error boundary | `web/app/error.tsx` |
| 3 | Split page component (730→<500 lines) | `web/app/page.tsx` |

### P1 — High (next sprint)

| # | Action | File / Area |
|---|---|---|
| 4 | Add mobile + tablet Playwright to CI | `ci-ui.yml` |
| 5 | Create rate-limiting middleware | `web/middleware.ts` |
| 6 | Wire Rust `--profile` to budget presets | `cli/src/resolver/mod.rs` |
| 7 | Unit tests for web utilities | `web/lib/circuit-breaker.ts`, `errors.ts`, `quality.ts`, `keys.ts` |

### P2 — Medium (roadmap)

| # | Action | Area |
|---|---|---|
| 8 | Port preflight routing to Rust + Web | Cross-platform |
| 9 | Add hedged requests to Rust | `cli/src/resolver/cascade.rs` |
| 10 | Add `evals.json` to more skills | `.agents/skills/*/` |
| 11 | Add Python 3.10 to CI or bump `requires-python` | `pyproject.toml`, `.github/workflows/ci.yml` |

### P3 — Low (nice to have)

| # | Action | Area |
|---|---|---|
| 12 | Port `exa_mcp_mistral` combo to Python + Rust | Cross-platform |
| 13 | Full `--deep-research` parallel mode for CLIs | Python + Rust |
| 14 | File-based routing memory for Python | `scripts/` |

---

## Plans Directory Cleanup

### Files to DELETE (superseded by this AUDIT.md)

| File | Reason |
|---|---|
| `BUGS_AND_ISSUES.md` | Bugs from 2026-03-27, most fixed |
| `IMPLEMENTATION_PLAN.md` | Phases 1–8 all complete |
| `SWARM_ANALYSIS_SUMMARY.md` | Initial planning artifact |
| `CODEBASE_AUDIT_2026_04_01.md` | Superseded by this file |
| `FEATURE_IMPROVEMENTS_2026_04_01.md` | Superseded by this file |
| `ADDITIONAL_IMPROVEMENTS_PLAN.md` | Duplicates other plans |
| `AI_AGENT_INSTRUCTIONS_ANALYSIS.md` | Recommendations largely implemented |
| `UI_ENHANCEMENTS_PLAN.md` | Most items implemented |
| `UI_UX_BEST_PRACTICES.md` | Captured in this audit |
| `WEB_AUDIT_RESULTS.md` | From 2026-03-27, mostly addressed |
| `PROVIDER_SCORE_OPTIMIZATION.md` | Old provider scores, fixed |

### Files to KEEP (future roadmap)

| File | Topic |
|---|---|
| `01-architecture-improvements.md` | PyO3 bindings, async mutex |
| `02-new-providers.md` | 7 new provider integrations |
| `03-performance-optimization.md` | 10 optimizations |
| `04-new-features.md` | Batch API, streaming, webhooks |
| `05-ui-ux-improvements.md` | Stepper, streaming UI |
| `06-testing-improvements.md` | Security tests, parity tests |
| `07-documentation-improvements.md` | Tutorials, ADRs |
| `08-deep-research.md` | Deep research framework |

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

*Last updated: 2026-04-26. Next audit: when version bumps to 1.0 or after P0 items are resolved.*
