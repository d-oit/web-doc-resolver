# Plan: Update ESLint Config for 2026 Best Practices

## Goal ✅ COMPLETED

Prevent DeepSource/minor lint issues in PRs by updating ESLint config to properly handle:

- Playwright test files (global scope functions)
- Build artifacts exclusion (.vercel/output)
- TypeScript strict mode
- Proper globals configuration

## Analysis

Current issues from PR #284/#277:

- DeepSource flagged "Unexpected function declaration in global scope" for test helpers
- Lint ran on .vercel/output build artifacts causing false positives

## Changes Implemented

### 1. Updated `web/eslint.config.mjs`

- Added `.vercel/output/**`, `playwright-report/**`, `test-results/**` to ignores
- Added Vitest globals for unit tests (`tests/**/*.test.ts` excluding `tests/e2e/**`)
- Added Playwright globals for e2e tests with eslint-plugin-playwright
- Configured Playwright-specific rules as warnings (not blocking errors)

### 2. Added `eslint-plugin-playwright` to `web/package.json`

- Installed with --legacy-peer-deps due to eslint 10 compatibility
- Provides Playwright-specific linting for e2e tests

### 3. Key Rules Added

- `playwright/no-focused-test`: error (prevent accidental test.focus)
- `playwright/no-networkidle`: warn (deprecated pattern)
- `playwright/no-useless-not`: warn (prefer toBeHidden())
- Other Playwright best practices as warnings

## Success Criteria ✅ MET

- `npm run lint` passes with 0 errors
- Build artifacts ignored
- Test globals properly configured
- Playwright best practice warnings visible for future fixes