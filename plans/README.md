# Plans

Living plans for the do-web-doc-resolver project.
Source of truth for architecture lives in [`agents-docs/`](../agents-docs/README.md);
this folder tracks **in-flight and proposed work**. Completed plans are in
[`archive/`](archive/README.md).

## Start Here

| File | Purpose |
|------|---------|
| [`AUDIT.md`](AUDIT.md) | Project audit — known gaps, file-size tracking, ADR status |
| [`20-GOAP-STATE-UPDATE.md`](20-GOAP-STATE-UPDATE.md) | Latest GOAP state (2026-05-30); waves 1–7 complete |
| [`21-codebase-improvement-2026-06.md`](21-codebase-improvement-2026-06.md) | **Active sweep** (2026-06-01): mypy fix, broad-except logging, size violations, providers DRY |

## Release Status

- **Current**: `v0.3.7` — manifests aligned across Python / Rust / Web / CLI
- **Quality gate**: PASS (markdownlint warnings non-blocking)
- **Open PRs**: 0 · **Open issues**: 0
- **Static analysis on `main`**: Clippy ✅ · ESLint ✅ · Ruff ✅ · mypy ✅

## Active ADRs

| # | ADR | Topic | Status |
|---|-----|-------|--------|
| 009 | [Cross-Runtime](009-cross-runtime-analysis.md) | Parity gaps, config vs env | Referenced |
| 012 | [Correctness & Safety](012-correctness-and-safety-fixes.md) | Thread safety, SSRF, provider gaps | ✅ All waves DONE |
| 013 | [Test Coverage & CI](013-test-coverage-and-ci-reliability.md) | Misleading tests, CI fixes | ✅ All waves DONE |
| 014 | [Architecture & Parity](014-architecture-and-parity.md) | DRY consolidation, constants, dead code | ✅ Waves 3, 6 DONE |
| 015 | Nightly Bridge PR (archived) | Nightly workflow push→PR | ✅ Implemented (PR #366) |

## Roadmap Plans

| # | Plan | Topic | Status |
|---|------|-------|--------|
| 01 | [Architecture](01-architecture-improvements.md) | PyO3, async mutex, provider trait | All phases PENDING (see plan 21 D1–D3) |
| 02 | [Providers](02-new-providers.md) | 7 new integrations | All PENDING |
| 03 | [Performance](03-performance-optimization.md) | Latency, caching, HTTP/2 | 1/10 done (compaction) |
| 04 | [Features](04-new-features.md) | Batch API, streaming, webhooks | All PENDING |
| 05 | [UI/UX](05-ui-ux-improvements.md) | Stepper, streaming, accessibility | 4 items done |
| 06 | [Testing](06-testing-improvements.md) | Security, parity, benchmarks | CI fixes done |
| 07 | [Documentation](07-documentation-improvements.md) | Tutorials, ADRs | 4 doc improvements done |
| 08 | [Deep Research](08-deep-research.md) | Multi-step research framework | All PENDING |
| 11 | [Cache Pre-warming](11-cache-prewarming.md) | CLI + web prewarm | PENDING |
| 21 | [Codebase Improvement 2026-06](21-codebase-improvement-2026-06.md) | mypy, broad excepts, file-size splits, providers DRY | ✅ Wave A, B1-B2 DONE |

## Implementation Waves (history)

| Wave | Focus | Status |
|------|-------|--------|
| 1 | Thread safety, SSRF, provider reachability (ADR-012) | ✅ DONE (PR #364) |
| 1b | web/package.json, npm peer deps, libsql (ADR-013) | ✅ DONE |
| 2 | CI fixes, pre-commit, gitleaks, classifiers (ADR-013) | ✅ DONE |
| 3 | `constants.py` + `state.py` extraction (ADR-014) | ✅ DONE (PR #407) |
| 4 | Logging, quality, synthesis, TOCTOU, SSRF gaps (ADR-012) | ✅ DONE |
| 5 | Rust file splits & dedup | ✅ DONE (R5 deferred) |
| 6 | Test coverage: 176 web, 76 Rust, 311 Python | ✅ DONE |
| 7 | Web middleware + cross-platform parity | ✅ DONE (PR #408) |
| 8 | Codebase improvement sweep (Plan 21) | ✅ Wave A, B1-B2 DONE |

## Conventions

- **One active plan per sweep.** Number plans monotonically (`21`, `22`, …).
- **Mark superseded plans** with `> Superseded by #NN` at the top, then move to `archive/`.
- **Plans in `archive/` are read-only.** Don't link new work to them.
- Detailed file-by-file gaps belong in [`AUDIT.md`](AUDIT.md), not in roadmap plans.
- Template: [`checkpoint-_TEMPLATE.md`](checkpoint-_TEMPLATE.md).
