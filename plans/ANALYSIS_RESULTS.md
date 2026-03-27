# Analysis Results

**Date**: 2026-03-27
**Scope**: Code quality, bugs, improvements, and feature opportunities

---

## Executive Summary

This analysis covers the do-web-doc-resolver codebase including the Python resolver, Rust CLI, and Next.js web UI. Overall code quality is good with passing lint/type checks. Several areas need attention for production readiness.

---

## Critical Issues Found

### 1. Cache Memory Leak (High Priority)

**File**: `/home/doit/projects/web-doc-resolver/web/lib/cache.ts`

The cache has no size limits or LRU eviction. It only evicts expired entries on access:

```typescript
// Current: No max size limit
let store = new Map<string, CacheEntry>();
```

**Impact**: Server memory exhaustion under heavy load.

**Fix**: Add LRU eviction as documented in `ADDITIONAL_IMPROVEMENTS_PLAN.md` section 1.1.1.

---

### 2. Records Module Memory Leak (High Priority)

**File**: `/home/doit/projects/web-doc-resolver/web/lib/records.ts`

Records are stored in memory with no size limits:

```typescript
const store = new Map<string, Record>();
// No limit on store size
```

**Impact**: Memory leak in serverless functions that remain warm.

**Fix**: Add max entries limit with FIFO eviction.

---

### 3. No Input Validation (Medium Priority)

**Files**:
- `/home/doit/projects/web-doc-resolver/web/app/api/resolve/route.ts`
- `/home/doit/projects/web-doc-resolver/web/app/api/ui-state/route.ts`

User input is not validated or sanitized:
- No length limits on query strings
- No URL validation for SSRF protection
- No sanitization of API key inputs

**Fix**: Add Zod validation schemas as documented in `ADDITIONAL_IMPROVEMENTS_PLAN.md` section 4.1.2.

---

## Code Quality Issues

### 4. Type Safety Gaps

**File**: `/home/doit/projects/web-doc-resolver/web/app/api/resolve/route.ts`

Provider response types use implicit `any`:

```typescript
const data = await res.json(); // No type validation
```

**Fix**: Add strict provider response types from `ADDITIONAL_IMPROVEMENTS_PLAN.md` section 4.1.1.

---

### 5. Missing Error Context

**File**: `/home/doit/projects/web-doc-resolver/web/app/api/resolve/route.ts`

Catch blocks silently swallow errors:

```typescript
} catch {
  // No logging, no error details captured
  return null;
}
```

**Impact**: Difficult debugging in production.

**Fix**: Add structured logging per `ADDITIONAL_IMPROVEMENTS_PLAN.md` section 4.2.2.

---

### 6. Circuit Breaker Not Configured

**File**: `/home/doit/projects/web-doc-resolver/web/lib/circuit-breaker.ts`

Circuit breaker uses hardcoded defaults with no external configuration:

```typescript
const DEFAULT_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 300_000; // 5 minutes
```

**Recommendation**: Make these configurable via environment variables.

---

## Accessibility Issues

### 7. Missing ARIA Labels

**File**: `/home/doit/projects/web-doc-resolver/web/app/page.tsx`

Several interactive elements lack proper ARIA attributes:
- Provider toggle buttons lack `aria-pressed`
- Clear button (if implemented) needs `aria-label`
- Copy button needs `aria-live="polite"`

**Fix**: See `ADDITIONAL_IMPROVEMENTS_PLAN.md` section 3.1.1.

---

### 8. No Skip Links

**File**: `/home/doit/projects/web-doc-resolver/web/app/page.tsx`

Missing skip link for keyboard users to bypass sidebar.

**Fix**: Add skip-to-content link per `ADDITIONAL_IMPROVEMENTS_PLAN.md` section 3.1.3.

---

## Performance Opportunities

### 9. Request Deduplication Missing

**File**: `/home/doit/projects/web-doc-resolver/web/app/api/resolve/route.ts`

No deduplication of concurrent identical requests. Multiple clients requesting the same query will trigger separate provider calls.

**Fix**: Add request deduplication per `ADDITIONAL_IMPROVEMENTS_PLAN.md` section 1.2.2.

---

### 10. No React.memo Optimization

**File**: `/home/doit/projects/web-doc-resolver/web/app/page.tsx`

The page component doesn't use `React.memo` or `useCallback` for expensive computations:

```typescript
const handleSubmit = async (e?: React.FormEvent) => { ... }
// No useCallback wrapper
```

**Impact**: Unnecessary re-renders on state changes.

---

## Security Considerations

### 11. No Rate Limiting

**Files**: All API routes

No rate limiting on any endpoints. Vulnerable to:
- Brute force API key discovery
- Resource exhaustion attacks
- Scraping abuse

**Fix**: Implement rate limiting per `ADDITIONAL_IMPROVEMENTS_PLAN.md` section 2.1.2.

---

### 12. SSRF Potential

**File**: `/home/doit/projects/web-doc-resolver/web/app/api/resolve/route.ts`

URL input is not validated for:
- Private IP ranges (10.x, 192.168.x, etc.)
- Internal services (localhost, metadata endpoints)
- Non-HTTP protocols

**Fix**: Add SSRF validation per `ADDITIONAL_IMPROVEMENTS_PLAN.md` section 2.1.1.

---

## Test Coverage Gaps

### 13. No Unit Tests for Providers

**Directory**: `/home/doit/projects/web-doc-resolver/web/tests/`

Only E2E tests exist. No unit tests for:
- Provider functions (Jina, Serper, Tavily, etc.)
- Quality scoring
- Circuit breaker logic
- Cache operations

**Fix**: Add unit tests per `ADDITIONAL_IMPROVEMENTS_PLAN.md` section 6.1.1.

---

### 14. Missing Error Boundary

**File**: `/home/doit/projects/web-doc-resolver/web/app/page.tsx`

No error boundary to catch React rendering errors. A crash in one component will crash the entire page.

**Fix**: Add ErrorBoundary component per `ADDITIONAL_IMPROVEMENTS_PLAN.md` section 4.2.1.

---

## CLI Issues

### 15. Rust CLI Fails Without API Keys

**Command**: `./cli/target/release/do-wdr resolve "react hooks" --profile fast`

**Error**: `Provider error: No query resolution method available`

**Root Cause**: The `fast` profile allows 1 paid provider attempt but no free providers are configured in the cascade order.

**Workaround**: Use `--profile free` which only uses free providers.

---

### 16. Python Resolver Module Import Error

**Command**: `python scripts/resolve.py "what is claude ai"`

**Error**: `ModuleNotFoundError: No module named 'scripts'`

**Fix**: Run with `PYTHONPATH=. python scripts/resolve.py ...`

---

## Minor Issues

### 17. Hardcoded Timeouts

**File**: `/home/doit/projects/web-doc-resolver/web/app/api/resolve/route.ts`

Timeout values are hardcoded:

```typescript
async function fetchWithTimeout(url, options, timeoutMs = 15000)
```

**Recommendation**: Make timeouts configurable via environment variables.

---

### 18. Inconsistent Error Messages

**File**: `/home/doit/projects/web-doc-resolver/web/app/api/resolve/route.ts`

Generic error messages don't help users understand what went wrong:

```typescript
throw new Error("No search results found for query. Try adding API keys for better results.");
```

**Recommendation**: Include which providers were tried and why they failed.

---

## Feature Opportunities

### 19. History Feature Not Implemented

**Plan**: `UI_ENHANCEMENTS_PLAN.md` Phase 4

History feature with Vercel KV storage is planned but not yet implemented. Would provide:
- Save/load/delete past resolutions
- Search history
- 90-day TTL on entries

---

### 20. Keyboard Shortcuts Missing

**Plan**: `ADDITIONAL_IMPROVEMENTS_PLAN.md` section 3.2.1

No keyboard shortcuts for common actions:
- Ctrl+K to focus input
- Escape to clear
- Shortcuts help modal

---

## Recommendations Summary

### Immediate (P0)
1. Fix cache memory leak with LRU eviction
2. Add size limits to records store
3. Add input validation to all API routes

### Short-term (P1)
4. Add rate limiting to prevent abuse
5. Implement SSRF protection
6. Add ARIA labels for accessibility
7. Add unit tests for providers

### Medium-term (P2)
8. Implement history feature
9. Add React.memo optimizations
10. Add error boundaries
11. Implement request deduplication

### Long-term (P3)
12. Add keyboard shortcuts
13. Add performance monitoring
14. Make timeouts/configurable

---

## Files Reviewed

- `/home/doit/projects/web-doc-resolver/web/app/page.tsx` (517 lines)
- `/home/doit/projects/web-doc-resolver/web/app/api/resolve/route.ts` (664 lines)
- `/home/doit/projects/web-doc-resolver/web/lib/cache.ts` (76 lines)
- `/home/doit/projects/web-doc-resolver/web/lib/circuit-breaker.ts` (50 lines)
- `/home/doit/projects/web-doc-resolver/web/lib/keys.ts` (35 lines)
- `/home/doit/projects/web-doc-resolver/web/lib/providers.ts` (159 lines)
- `/home/doit/projects/web-doc-resolver/web/lib/quality.ts` (42 lines)
- `/home/doit/projects/web-doc-resolver/web/lib/records.ts` (49 lines)
- `/home/doit/projects/web-doc-resolver/web/lib/routing.ts` (115 lines)
- `/home/doit/projects/web-doc-resolver/web/lib/ui-state.ts` (106 lines)
- `/home/doit/projects/web-doc-resolver/web/lib/errors.ts` (119 lines)
- `/home/doit/projects/web-doc-resolver/web/app/settings/page.tsx` (159 lines)
- `/home/doit/projects/web-doc-resolver/web/app/api/ui-state/route.ts` (52 lines)
- `/home/doit/projects/web-doc-resolver/web/app/api/key-status/route.ts` (12 lines)
- `/home/doit/projects/web-doc-resolver/web/tests/e2e/app.spec.ts` (636 lines)
- `/home/doit/projects/web-doc-resolver/web/tests/e2e/provider-gating.spec.ts` (185 lines)
- `/home/doit/projects/web-doc-resolver/cli/src/main.rs` (232 lines)
- `/home/doit/projects/web-doc-resolver/cli/src/resolver.rs` (partial)