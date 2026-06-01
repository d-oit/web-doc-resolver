# ADR-009: Cross-Runtime Analysis — Python, Rust CLI, and Web UI Parity

## Status

Referenced

## Context

The project maintains three runtimes: Python (primary development, scripts/),
Rust CLI (high-performance binary, cli/), and Web UI (Next.js, web/). Features
developed in one runtime often lag behind the others, creating a maintenance
burden and inconsistent user experience.

## Decision

Track parity gaps explicitly in a living document (this ADR). Close gaps based
on user impact and maintenance cost:

1. **Rate throttling** → Implement in Rust first (harder to retrofit), port to
   Python, keep in aiohttp for Web.
2. **Quality confidence gate** → Implement in all three simultaneously (shared
   constants).
3. **Routing features** → Python first (fastest iteration), port to Rust + Web
   once stable.

## Completed Parity Items

| Feature | Python | Rust | Web | PR |
|---------|--------|------|-----|----|
| Quality confidence gate | ✅ | ✅ | ✅ | #341 |
| Tiered cache TTL | ✅ | ✅ | N/A | #338 |
| Probabilistic provider skip | ✅ | ✅ | ✅ | #342 |
| Adaptive per-domain reorder | ✅ | ✅ | N/A | #343 |
| Rate throttling (token bucket) | ✅ | ✅ | N/A | #358 |
| Cache pre-warming | ❌ | ✅ | ✅ | #339 |

## Open Parity Gaps

| # | Feature | Python | Rust | Web | Impact |
|---|---------|--------|------|-----|--------|
| P1 | `exa_mcp_mistral` combo | ❌ | ❌ | ✅ | Users of Python/Rust CLI miss this query strategy |
| P2 | Deep research parallel mode | Partial | `--synthesize` only | ✅ | Full parallel mode missing in CLIs |
| P3 | Budget profiles / presets | N/A | `--profile` flag exists, not wired | N/A | Wire Rust flag to presets |
| P4 | Preflight routing | `detect_doc_platform()` | Minimal `detectJsHeavy()` | Minimal | Port advanced routing to Rust/Web |
| P5 | Hedged requests | ✅ | ❌ | ❌ | Performance gap — Python has hedging, Rust/Web sequential |
| P6 | Routing memory persistence | In-memory only | File persistence | N/A | Python loses state on restart |
| M7 | Mobile/tablet Playwright in CI | N/A | N/A | ❌ | Mobile regressions undetected |

## Consequences

- Gaps P4-P5 are the highest priority — they directly affect resolution quality
  and performance.
- P1 is lower priority — few users rely on the exact `exa_mcp_mistral` combo.
- P6 is a correctness issue — routing memory is the primary mechanism for
  learned provider preferences and should be persistent across all runtimes.
- M7 is a CI gap that should be fixed in the next CI pass (see ADR-013).

## References

- [AUDIT.md](AUDIT.md) — Section 4: Cross-Platform Parity
- [GOAP_FOLLOWUP.md](archive/GOAP_FOLLOWUP.md) — Wave implementation tracking
