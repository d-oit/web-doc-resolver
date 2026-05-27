# UI/UX Improvements (Condensed Status)

## Original Overview

10+ UI/UX improvements across Web UI and CLI: cascade progress stepper,
streaming response UI, code highlighting, error recovery, accessibility,
CLI colors, toasts, result cards, history cleanup.

## Status

Partially addressed by merged PRs. Core accessibility and history features
implemented.

## What's Done

The following 5 items have been implemented (4 original + 1 restoration):

- **Keyboard navigation** (Phase 2): ✅ PR #324 merged — search accessibility
  and keyboard navigation improvements.
- **Profile combobox** (Phase 5): ✅ PR #290 merged — accessible profile selector.
- **Active provider indicators**: ✅ PR #291 merged — visual indication of
  active providers in search profile.
- **History state persistence**: ✅ Merged — search and history state
  preserved across navigations.
- **Firecrawl restored to Web UI**: ✅ PR #321 merged — re-enabled Firecrawl
  provider in constants.ts + E2E test.

## What Remains

All other improvements (stepper, streaming UI, code blocks, CLI colors, toasts,
result cards, history cleanup, error recovery UI, tooltips, quick toggles)
remain unimplemented.

## References

- [web/app/page.tsx](../web/app/page.tsx) — Main UI entry point
- [cli/ui/](../cli/ui/) — CLI design system
- [ADR-009](009-cross-runtime-analysis.md) — Web parity gaps
