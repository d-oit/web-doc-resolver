# Plan: Issue #402 — P0 Critical Technical Debt Reduction

## Overview

Implement the 4 P0 critical tasks from the technical debt roadmap (issue #402).
Branch: `feat/402-p0-technical-debt`
PR: <https://github.com/d-oit/do-web-doc-resolver/pull/409>

## Wave 0: ADR Documents (No code deps)

| Task | File | Status |
|------|------|--------|
| ADR-014: Replace Monkey-Patching with DI | `docs/adr/ADR-014-replace-monkey-patching-with-di.md` | Done |
| ADR-015: Unified Cascade Architecture | `docs/adr/ADR-015-unified-cascade-architecture.md` | Done |
| ADR-016: State Management Strategy | `docs/adr/ADR-016-state-management-strategy.md` | Done |

## Wave 1: Code Changes (Parallel)

### P0-1: ResolverState Dataclass + Dependency Injection

- **File**: `scripts/state.py` — Add `ResolverState` dataclass
- **File**: `scripts/resolve.py` — Own state instance, inject into sub-modules
- **File**: `scripts/_query_resolve.py` — Accept state via parameter or module reference
- **File**: `scripts/_url_resolve.py` — Accept state via parameter or module reference
- **Status**: Done

### P0-2: Cascade Deduplication

- **New file**: `scripts/_cascade.py` — Shared `cascade_stream()` generator
- **File**: `scripts/_query_resolve.py` — Refactor to use shared cascade
- **File**: `scripts/_url_resolve.py` — Refactor to use shared cascade
- **Status**: Done

### P0-3: Exception Handling Improvement

- **File**: `scripts/providers_impl.py` — Narrow exception types where possible
- **Status**: Done

### P0-4: Atexit Handler for Executor

- **File**: `scripts/state.py` — Add `atexit.register()` for clean shutdown
- **Status**: Done

## Wave 2: Verification

- Run `pytest -m "not live"` — 348 passed, 1 skipped
- Run `./scripts/quality_gate.sh` — all checks passed
- Verify no import errors — all OK
- Rust CLI tests — 96 passed
- Web lint + typecheck — passed

## Wave 3: PR Creation & Review

- PR created: <https://github.com/d-oit/do-web-doc-resolver/pull/409>
- Issue #402 closed with implementation details
- All 5 CI workflows green (CI, CI UI, Gitleaks, Integration Tests, Auto Resolve)

## Wave 4: Review Fixes

| Issue | Fix | Commit |
|-------|-----|--------|
| `_shutdown_executor` left `_state.executor` stale | Added `_state.executor = None` in shutdown | `6d6b067` |
| f-string in `_cascade.py` logger | Changed to `%s` formatting per convention | `6d6b067` |

## Final Metrics

- **Net code reduction**: -223 lines (321 deleted, 98 added in code files)
- **New file**: `scripts/_cascade.py` (171 lines)
- **Refactored**: `_query_resolve.py` 255 → 133 lines, `_url_resolve.py` 307 → 176 lines
- **All CI green**: Python (3.11/3.12/3.13), Rust, Web lint/typecheck/build/E2E
