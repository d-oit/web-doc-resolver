# Architecture Improvements (Condensed Status)

## Original Overview

Code consolidation between Python and Rust implementations, async/await
optimizations, and architectural abstractions.

## Status

Partially addressed by ongoing work. The detailed plan (476 lines, phases 1-6)
is superseded by ADR-014 and ADR-009.

## What's Done

- **Async-aware locks** (Phase 1): Not yet started. Tokio `RwLock` migration
  remains pending.
- **DashMap integration** (Phase 2): Not started — requires Cargo.toml changes.
- **Provider trait unification** (Phase 3): Not started. `cli/src/providers/`
  uses `#[async_trait]` per-provider but no shared registry yet.
- **Python async migration** (Phase 4): Not started. Python resolver still uses
  `ThreadPoolExecutor`.
- **PyO3 bindings** (Phase 5): Not started. Still uses separate Python/Rust.
- **Config consolidation** (Phase 6): Partially addressed — CLI reads `config.toml`
  via `serde` but doesn't use the `config` crate. Environment variable naming
  aligned to `DO_WDR_*` prefix.

## What Remains

All 6 phases remain to be implemented. See ADR-014 for the highest-priority item
(constants/state extraction, Wave 3).

## References

- [ADR-014](014-architecture-and-parity.md) — DRY consolidation plan
- [ADR-009](009-cross-runtime-analysis.md) — Cross-runtime parity gaps
- [GOAP_FOLLOWUP.md](GOAP_FOLLOWUP.md) — Wave tracking
