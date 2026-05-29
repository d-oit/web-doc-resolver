# Plan: Issue #402 — P0 Critical Technical Debt Reduction

## Overview

Implement the 4 P0 critical tasks from the technical debt roadmap (issue #402).
Branch: `feat/402-p0-technical-debt`

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

- Run `pytest -m "not live"` — all tests pass
- Run `./scripts/quality_gate.sh` — clean
- Verify no import errors

## Wave 3: PR Creation

- Create PR with title: `feat(resolve): P0 critical technical debt — ResolverState DI, cascade dedup, exception hardening`
- Monitor GitHub Actions until green
- Close issue #402 with implementation details
