# Issue #141 Execution Plan

**Created**: 2026-03-25
**Status**: In Progress
**Issue**: https://github.com/d-oit/do-web-doc-resolver/issues/141

## Scope

Implement and verify three linked changes:

1. Provider key gating in UI (paid providers disabled without keys)
2. Custom profile UX (manual toggle switches to `Custom`)
3. Mistral-first query routing (exclude DuckDuckGo when Mistral key is active)

## Parallel Workstreams + Handoff

### Track A - Routing and provider logic
- Update `web/lib/providers.ts` for Mistral helper and free-provider behavior
- Update `web/lib/routing.ts` for Mistral-first ordering and DuckDuckGo exclusion
- Handoff artifact: normalized query provider order rules + unit tests

### Track B - UI/UX and key-gating behavior
- Update `web/app/page.tsx` for key-based button enablement and `Custom` profile behavior
- Add disabled-state hint `(needs key)` for unavailable paid providers
- Handoff artifact: deterministic provider availability logic used by UI and request payload

### Track C - Validation and deployment verification
- Add unit tests for routing/providers
- Add Playwright E2E coverage for gating + custom profile + Mistral override
- Run desktop + tablet + mobile checks
- Handoff artifact: test evidence and deploy verification notes

## Atomic Commit Strategy

- One atomic commit for Issue #141 implementation + tests
- Push branch and monitor GitHub Actions
- If checks fail: apply targeted fix commit(s), push, re-check until green

## Verification Loop

1. `npm run test` in `web/`
2. `npm run test:e2e -- --project=desktop --project=tablet --project=mobile provider-gating.spec.ts`
3. Push and watch GitHub Actions to completion
4. Open PR, fetch deployment URL, run agent-browser click-through on desktop/tablet/mobile

## Completion Criteria

- Paid providers disabled without key, enabled with key
- Profile selector includes and uses `Custom`
- Mistral key removes DuckDuckGo from active query providers and cascade
- Unit + E2E pass locally and in CI
- Deployment verified interactively in browser on desktop/tablet/mobile
