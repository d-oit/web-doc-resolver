# ADR-011: Cache Pre-warming — Follow-up PR from Scope Creep Extraction

## Status

Proposed

## Context

Cache pre-warming was originally implemented in PR #341 as part of the quality
confidence gate feature. During review, Codacy flagged it as scope creep with
two critical issues:

1. **CLI lifecycle bug**: `tokio::spawn` makes pre-warming non-functional
   because the process exits before spawned tasks complete (Codacy F3).
2. **Web excessive API usage**: `prewarmCache` fires 20 concurrent requests on
   every mount and every `apiKeys` change (Codacy F4).

Extracted to separate PR per [ADR-010](archive/10-pr341-quality-gate-fixes.md).

## GOAP

### Goal

Implement cache pre-warming as a standalone feature with correct CLI lifecycle
management, throttled web integration, comprehensive tests, and config
documentation.

### Preconditions

- PR #341 (`feat/routing-quality-gate-...`) is merged to `main`
- New branch `feat/cache-prewarming` created from `main`
- No existing `cli/src/startup.rs`, `PrewarmConfig`, or prewarm web code remains
  (they were removed in the quality gate PR)

### Actions

#### Wave 1: Rust CLI — Module & Config

| ID | File | Action |
|----|------|--------|
| C1 | `cli/src/startup.rs` | Create module with `prewarm_cache(resolver, config)` using `JoinSet` (NOT `tokio::spawn`). Key behavior: await all pre-warm tasks before returning, respect `prewarm.enabled`, use semaphore for concurrency control. |
| C2 | `cli/src/config.rs` | Add `PrewarmConfig` struct with fields: `enabled: bool` (default: `true`), `top_n_domains: usize` (default: `20`), `profile: Profile` (default: `"balanced"`), `max_concurrency: usize` (default: `4`). Nest under `RoutingConfig.prewarm`. |
| C3 | `cli/src/lib.rs` | Add `pub mod startup;` |
| C4 | `cli/src/main.rs` | In `handle_resolve`, after creating resolver, await `startup::prewarm_cache(resolver, config)` with `JoinSet` so the process lives until pre-warming completes. |
| C5 | `cli/src/routing_memory.rs` | Re-add `top_domains(&self, n: usize) -> Vec<String>` method — returns top N domains by attempt count. |
| C6 | `config.toml` | Add `[routing.prewarm]` section with defaults. |

#### Wave 2: Web — Throttled Pre-warming

| ID | File | Action |
|----|------|--------|
| W1 | `web/lib/records.ts` | Add `getTopDomains(n: number): Promise<string[]>` — reads from localStorage records, ranks by frequency, returns top N hostnames. |
| W2 | `web/app/page.tsx` | Add `prewarmCache` as a **single-trigger** function (not in `useEffect` deps). **Fix the bug**: remove `apiKeys` from dependency array. Add `localStorage` throttle (e.g., `wdr-prewarm-last-run` timestamp, max once per hour). Call on mount only, not on re-render. |
| W3 | `web/app/page.tsx` | Add `useEffect` with `[]` deps that calls prewarmCache once on mount. |

#### Wave 3: Tests

| ID | File | Action |
|----|------|--------|
| T1 | `cli/tests/startup_prewarm.rs` | Test `prewarm_cache` logic: verify top domains are fetched, prewarm respects `enabled=false`, empty domains list is handled gracefully. |
| T2 | `cli/tests/startup_semaphore.rs` | Test concurrency limits: verify max_concurrency is respected, deadlocks don't occur, all tasks complete within expected time. |
| T3 | `scripts/_query_resolve.py` / Python tests | Add integration test verifying prewarm-triggered cache entries are usable. |

#### Wave 4: Documentation

| ID | Action |
|----|--------|
| D1 | Update `config.toml` comments explaining prewarm settings |
| D2 | Add prewarm section to `cli/README.md` or relevant docs |
| D3 | Update `agents-docs/CONFIG.md` with `[routing.prewarm]` section |

### Key Design Decisions

1. **`JoinSet` over `tokio::spawn`** (Codacy F3):
   - `JoinSet` ensures all pre-warm tasks complete before the process exits
   - Tasks run concurrently but the caller awaits them
   - Contrast: `tokio::spawn` detaches tasks — process exits immediately

2. **Single-trigger throttle** (Codacy F4):
   - `localStorage` timestamp prevents pre-warming more than once per hour
   - `useEffect` with `[]` deps (not `[apiKeys]`) prevents re-triggers
   - No re-fetch on config changes

3. **Semaphore concurrency control**:
   - Default `max_concurrency: 4` to avoid API rate limits
   - Each domain gets resolved with the configured profile
   - Respects circuit breakers and negative cache

### Risk Assessment

| Risk | Mitigation |
|------|------------|
| Pre-warming consumes API quota unnecessarily | Throttle to 1/hour + respect `enabled=false` default |
| CLI process exits before pre-warm completes | `JoinSet` ensures all tasks complete |
| Web pre-warming exposes API keys in fetch body | Already handled: `apiKeys` passed in request body (existing pattern) |
| Startup module conflicts with other features | Clean module boundary — only depends on `Resolver` + `Config` |
| `top_domains` is empty on first run | Guard: skip pre-warm if no domains tracked |

### Postconditions

1. `cargo test` passes (all Rust tests)
2. `pytest -m "not live"` passes
3. `cargo clippy -- -D warnings` — clean
4. Web app loads without excessive API calls (verified via DevTools network tab)
5. CLI pre-warming works: first resolve after cold start triggers background warming

### Future Considerations

- **Layered pre-warming**: Pre-warm not just top domains but also recently accessed URLs
- **Scheduled pre-warming**: Cron-triggered pre-warm for high-value domains
- **Metrics**: Track pre-warm hit rate (how many user requests hit pre-warmed cache)
