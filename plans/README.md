# Plans

## Current State

→ **[AUDIT.md](AUDIT.md)** — Project audit. Start here.
→ **[20-GOAP-STATE-UPDATE.md](20-GOAP-STATE-UPDATE.md)** — **Latest** GOAP state (2026-05-29, supersedes 16/18).
→ **[16-GOAP-WAVE2-6.md](16-GOAP-WAVE2-6.md)** — Previous 7-wave plan (superseded by 20).
→ **[18-GOAP-PR-ORCHESTRATION.md](18-GOAP-PR-ORCHESTRATION.md)** — PR orchestration (completed).

## Release Readiness: v0.3.6

**Current version**: `0.3.6` (manifest) — GitHub latest: `v0.3.6` (tag)
**Commits since v0.3.1**: 240+
**Quality gate**: PASS (exit 0) — ~3262 markdownlint warnings (non-blocking)
**CI**: All workflows passing on `main`

### Version Drift Root Cause

Commit `c283dfa` (PR #270) merged an old branch on top of v0.3.3 release, reverting all 4 manifests and CHANGELOG entries. Old branch was forked BEFORE release tags, so merge overwrote release version.

**Permanent fix applied (3-layer defense):**

1. `release.sh` now calls `sync_versions.py --set` (handles all 4 files including `cli.rs`)
2. CI `validate-version` job enforces manifest >= latest tag on every PR
3. Quality gate warns locally on version regression

### What Changed Since v0.3.1 (highlights)

### Blockers for v0.3.4

| # | Blocker | File/Area | Status |
|---|---------|-----------|--------|
| B1 | --- | --- | ✅ RESOLVED — Wave 2 + Wave 5 executed |

### Recommended: Release v0.3.4 (patch)

- **234 commits** since v0.3.1 — significant feature work (rate throttling, adaptive routing, quality gate, semantic cache, SSRF hardening, nightly CI fix, CI config fixes, Rust file splits)
- Latest GitHub release is v0.3.3 — need to align manifests with tag history
- Wave 2 + Wave 5 executed — ready for patch release
- Remaining work (Waves 3, 4, 6, 7) can ship in v0.3.5+

### GitHub Actions Status (2026-05-13)

| Workflow | Status | Notes |
|----------|--------|-------|
| CI | ✅ passing | Python + Rust CI |
| CI UI | ✅ passing | Next.js lint + Playwright 3 projects |
| Integration Tests | ✅ passing | CLI integration |
| Gitleaks | ✅ passing | Secret scanning |
| Nightly Bridge | ✅ passing (PR #366) | Fixed: push→PR creation |
| Close Resolved Issues | ✅ passing | Auto-close linked issues |
| Dep Submission | ✅ passing | Python dependency graph |

### What Changed Since v0.3.1 (highlights)

- feat: Per-provider token-bucket rate throttling (#358)
- feat: Adaptive per-domain provider reordering (#343)
- feat: Quality confidence gate — skip paid on high free quality (#341)
- feat: Probabilistic provider skip for low-win-rate providers (#342)
- feat: Tiered provider TTL in config.toml (#338)
- feat: Startup pre-warm for top-N domains (#339)
- feat: Semantic cache optimization + observability (#353)
- feat: Exa MCP monthly usage tracking (#356)
- fix: TOCTOU race in CircuitBreakerState.is_open() (#365)
- fix: SSRF gaps in docling + ocr providers (#365)
- fix: Shared session for synthesis (no raw requests.post) (#365)
- fix: Nightly Bridge CI push→PR creation (#366)
- ci: Template workflows, gitleaks SHA-pins, .gitattributes (#359-361)
- ci: Quality gate with shellcheck + markdownlint + caching

## Active ADRs

| # | ADR | Topic | Status |
|---|-----|-------|--------|
| 009 | [Cross-Runtime](009-cross-runtime-analysis.md) | Parity gaps, config vs env | Referenced |
| 012 | [Correctness & Safety](012-correctness-and-safety-fixes.md) | Thread safety, SSRF, provider gaps | Wave 1 ✅ Wave 4 PENDING |
| 013 | [Test Coverage & CI](013-test-coverage-and-ci-reliability.md) | Misleading tests, CI fixes | Wave 1b ✅ Wave 2,5 PENDING |
| 014 | [Architecture & Parity](014-architecture-and-parity.md) | DRY consolidation, constants, dead code | Wave 3,6 PENDING |
| 015 | [Nightly Bridge PR](17-NIGHTLY-BRIDGE-PR.md) | Nightly workflow push→PR | ✅ **IMPLEMENTED** (PR #366 merged) |

## Implementation Waves

| Wave | ADR | Focus | Status |
|------|-----|-------|--------|
| 1 | ADR-012 T1-T6, S1-S3, P1-P2 | Thread safety, SSRF, provider reachability | ✅ **DONE** (PR #364) |
| 1b | ADR-013 I6-I8 | web/package.json version fixes, npm peer deps, libsql | ✅ **DONE** |
| 2 | ADR-013 I1-I5, K1-K7 + N9/N11 | CI fixes, pre-commit, gitleaks, classifiers, package names | ✅ **DONE** (K7 markdownlint config OPEN) |
| 3 | ADR-014 A1-A8 | constants.py, state.py extraction | ✅ **DONE** (PR #407) |
| 4 | ADR-012 P3b,P4-P7, Q1-Q6 + N5/N6/N12/N13 | Logging, quality, synthesis fixes, TOCTOU, lock guards, SSRF gaps | ✅ **DONE** |
| 5 | R1-R7 | Rust file splits & dedup (semantic_cache, config, query) | ✅ **DONE** (R5 deferred) |
| 6 | T1-T8 | Test coverage for web lib + Rust resolver + skills evals | ✅ **DONE** (176 web, 76 Rust, 311 Python tests) |
| 7 | W1-W4 | Web middleware + cross-platform parity (preflight, hedging) | PENDING |

## Roadmap Plans (Condensed Status)

| # | Plan | Topic | Status |
|---|------|-------|--------|
| 01 | [Architecture](01-architecture-improvements.md) | PyO3, async mutex, provider trait | All phases PENDING |
| 02 | [Providers](02-new-providers.md) | 7 new integrations | All PENDING |
| 03 | [Performance](03-performance-optimization.md) | Latency, caching, HTTP/2 | 1/10 done (compaction) |
| 04 | [Features](04-new-features.md) | Batch API, streaming, webhooks | All PENDING |
| 05 | [UI/UX](05-ui-ux-improvements.md) | Stepper, streaming, accessibility | 4 items done |
| 06 | [Testing](06-testing-improvements.md) | Security, parity, benchmarks | CI fixes done |
| 07 | [Documentation](07-documentation-improvements.md) | Tutorials, ADRs | 4 doc improvements done |
| 08 | [Deep Research](08-deep-research.md) | Multi-step research framework | All PENDING |
| 10 | [PR #341 Fixes](10-pr341-quality-gate-fixes.md) | Quality gate merge, scope-creep extraction | Merged, prewarm extracted |
| 11 | [Cache Pre-warming](11-cache-prewarming.md) | CLI + web prewarm (Scope creep extraction) | PENDING |
| 15 | [Next Phase](15-GOAP-NEXT-PHASE.md) | Wave 2-6 + AUDIT P0/P1 items | Superseded (see 16) |
| 16 | [GOAP Waves 2-6](16-GOAP-WAVE2-6.md) | CI, constants, quality, splits, tests, parity | Superseded (see 18) |
| 17 | [Nightly Bridge PR](17-NIGHTLY-BRIDGE-PR.md) | ADR-015 + GOAP: nightly push→PR fix | ✅ Completed |
| 18 | [GOAP PR Orchestration](18-GOAP-PR-ORCHESTRATION.md) | PR cleanup, CI fixes, 9 PRs merged/closed | ✅ Completed |
| 19 | [CI Serper Integration](19-ci-serper-integration.md) | Serper CI job, CLI smoke test, DB coverage, .opencode cleanup, llms_txt fix | Active plan |

## Executed Plans (Completed)

| File | Topic |
|------|-------|
| [CI_FIX.md](CI_FIX.md) | npm peer deps + libsql fix |
| [ESLINT_CONFIG_UPDATE.md](ESLINT_CONFIG_UPDATE.md) | ESLint 2026 config |
| [GOAP_FOLLOWUP.md](GOAP_FOLLOWUP.md) | ADR-012/013/014 wave tracking |
| [17-NIGHTLY-BRIDGE-PR.md](17-NIGHTLY-BRIDGE-PR.md) | ADR-015 + GOAP: nightly push→PR fix |
| [18-GOAP-PR-ORCHESTRATION.md](18-GOAP-PR-ORCHESTRATION.md) | GOAP orchestration: 9 PRs merged/closed with CI fixes |
| [19-ci-serper-integration.md](19-ci-serper-integration.md) | Serper CI job, CLI smoke test, DB coverage, .opencode cleanup, llms_txt fix |
