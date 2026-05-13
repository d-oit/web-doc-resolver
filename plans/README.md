# Plans

## Current State

→ **[AUDIT.md](AUDIT.md)** — Project audit. Start here.
→ **[16-GOAP-WAVE2-6.md](16-GOAP-WAVE2-6.md)** — Comprehensive 7-wave plan (supersedes 15).
→ **[15-GOAP-NEXT-PHASE.md](15-GOAP-NEXT-PHASE.md)** — Previous plan (superseded by 16).

## Active ADRs

| # | ADR | Topic | Status |
|---|-----|-------|--------|
| 009 | [Cross-Runtime](009-cross-runtime-analysis.md) | Parity gaps, config vs env | Referenced |
| 012 | [Correctness & Safety](012-correctness-and-safety-fixes.md) | Thread safety, SSRF, provider gaps | Wave 1 ✅ Wave 4 PENDING |
| 013 | [Test Coverage & CI](013-test-coverage-and-ci-reliability.md) | Misleading tests, CI fixes | Wave 1b ✅ Wave 2,5 PENDING |
| 014 | [Architecture & Parity](014-architecture-and-parity.md) | DRY consolidation, constants, dead code | Wave 3,6 PENDING |
| 015 | [Nightly Bridge PR](17-NIGHTLY-BRIDGE-PR.md) | Nightly workflow push→PR | PROPOSED → IMPLEMENTING |

## Implementation Waves

| Wave | ADR | Focus | Status |
|------|-----|-------|--------|
| 1 | ADR-012 T1-T6, S1-S3, P1-P2 | Thread safety, SSRF, provider reachability | ✅ **DONE** (PR #364) |
| 1b | ADR-013 I6-I8 | web/package.json version fixes, npm peer deps, libsql | ✅ **DONE** |
| 2 | ADR-013 I1-I5, K1-K7 + N9/N11 | CI fixes, pre-commit, gitleaks, classifiers, package names | PENDING |
| 3 | ADR-014 A1-A8 | constants.py, state.py extraction | PENDING |
| 4 | ADR-012 P3b,P4-P7, Q1-Q6 + N5/N6/N12/N13 | Logging, quality, synthesis fixes, TOCTOU, lock guards, SSRF gaps | PARTIAL (P4,N5,N12,N13,N13b ✅ DONE) |
| 5 | R1-R7 | Rust file splits & dedup (semantic_cache, config, query) | PENDING |
| 6 | T1-T8 | Test coverage for web lib + Rust resolver + skills evals | PENDING |
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
| 16 | [GOAP Waves 2-6](16-GOAP-WAVE2-6.md) | CI, constants, quality, splits, tests, parity | Active plan |
| 17 | [Nightly Bridge PR](17-NIGHTLY-BRIDGE-PR.md) | ADR-015 + GOAP: nightly push→PR fix | Active plan |

## Executed Plans (Completed)

| File | Topic |
|------|-------|
| [CI_FIX.md](CI_FIX.md) | npm peer deps + libsql fix |
| [ESLINT_CONFIG_UPDATE.md](ESLINT_CONFIG_UPDATE.md) | ESLint 2026 config |
| [GOAP_FOLLOWUP.md](GOAP_FOLLOWUP.md) | ADR-012/013/014 wave tracking |
| [17-NIGHTLY-BRIDGE-PR.md](17-NIGHTLY-BRIDGE-PR.md) | ADR-015 + GOAP: nightly push→PR fix |
