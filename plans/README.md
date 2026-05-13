# Plans

## Current State

→ **[AUDIT.md](AUDIT.md)** — Project audit. Start here.

## Active ADRs

| # | ADR | Topic | Status |
|---|---|---|---|
| 009 | [Cross-Runtime](009-cross-runtime-analysis.md) | Parity gaps, config vs env | Referenced |
| 012 | [Correctness & Safety](012-correctness-and-safety-fixes.md) | Thread safety, SSRF, provider gaps | Wave 1 ✅ (PR #fix/adr-012) |
| 013 | [Test Coverage & CI](013-test-coverage-and-ci-reliability.md) | Misleading tests, CI fixes | Pending |
| 014 | [Architecture & Parity](014-architecture-and-parity.md) | DRY consolidation, constants, dead code | Pending |

## Implementation Waves

| Wave | ADR | Focus | Status |
|---|---|---|---|
| 1 | ADR-012 T1-T6, S1-S3, P1-P2 | Thread safety, SSRF, provider reachability | ✅ **DONE** |
| 1b | ADR-013 I6-I8 | web/package.json version fixes | ✅ **DONE** |
| 2 | ADR-013 I1-I5 | CI fixes, pre-commit, gitleaks | Pending |
| 3 | ADR-014 A1-A8 | constants.py, state.py extraction | Pending |
| 4 | ADR-012 P3-P7, Q1-Q6 | Logging, quality, synthesis fixes | Pending |
| 5 | ADR-013 C1-C7 | New test files for uncovered paths | Pending |
| 6 | ADR-014 D1-D7 | Cascade consolidation | Pending |

## Roadmap Plans

| # | Plan | Topic |
|---|---|---|
| 01 | [Architecture](01-architecture-improvements.md) | PyO3 bindings, async mutex |
| 02 | [Providers](02-new-providers.md) | New provider integrations |
| 03 | [Performance](03-performance-optimization.md) | Latency, caching, HTTP/2 |
| 04 | [Features](04-new-features.md) | Batch API, streaming, webhooks |
| 05 | [UI/UX](05-ui-ux-improvements.md) | Stepper, streaming UI |
| 06 | [Testing](06-testing-improvements.md) | Security, parity, benchmarks |
| 07 | [Documentation](07-documentation-improvements.md) | Tutorials, ADRs |
| 08 | [Deep Research](08-deep-research.md) | Multi-step research framework |
| 10 | [PR #341 Fixes](10-pr341-quality-gate-fixes.md) | Quality gate merge, feedback fixes |
| 11 | [Cache Pre-warming](11-cache-prewarming.md) | Follow-up PR from scope creep extraction |
