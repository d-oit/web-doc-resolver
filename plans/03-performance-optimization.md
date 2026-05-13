# Performance Optimization (Condensed Status)

## Original Overview

10 performance optimizations organized by effort level: quick wins (Phase 1),
medium effort (Phase 2), high effort (Phase 3).

## Status

Several quick wins are partially or fully addressed by merged PRs.

## What's Done

- **Opt 1: Reuse ThreadPoolExecutor** (Phase 1): Partially done — shared
  executor pattern not yet implemented, but the `_get_executor` approach is
  straightforward when needed.
- **Opt 2: Eliminate busy-polling** (Phase 1): Not done — `timeout=0.01` still
  in `scripts/resolve.py:239, 384`.
- **Opt 3: HTTP/2 + keep-alive** (Phase 1): Partially done. Python
  `requests.Session()` via `get_session()` in `utils.py` reuses connections.
  Rust `reqwest::Client` is shared across providers in some cases. No explicit
  `HTTPAdapter` pool size configuration.
- **Opt 4: L1 in-memory cache** (Phase 1): Not done. Cache remains two-tier
  (semantic cache + disk). No `TTLCache` layer.
- **Opt 5: Content compaction optimization** (Phase 1): ✅ PR #325 merged
  (`optimize compact_content`).
- **Opt 6: Early quality exit** (Phase 1): Not done. `scripts/quality.py` has
  no early-exit optimization.
- **Opt 7: Shared reqwest Client** (Phase 2): Not done. Providers still create
  individual clients.
- **Opt 8: Async-aware locks** (Phase 2): Not done. `std::sync::Mutex` still
  used.
- **Opt 9: True parallel provider launch** (Phase 3): Not done. Python still
  uses `ThreadPoolExecutor` with sequential launch.
- **Opt 10: Request coalescing** (Phase 3): Not done.

## What Remains

All 10 optimizations remain candidates. ~2-3/10 are partially addressed;
full implementation requires a dedicated sprint, with Phases 2-3 depending on
async migration (ADR-014).

## References

- [ADR-014](014-architecture-and-parity.md) — Async/await migration dependency
- [scripts/resolve.py](../scripts/resolve.py) — Busy-polling locations
- [scripts/utils.py](../scripts/utils.py) — Compaction + session code
