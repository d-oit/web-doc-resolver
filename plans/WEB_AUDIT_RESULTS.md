# Web Codebase Audit Results

**Date**: 2026-03-27
**Auditor**: Claude Code Audit
**Scope**: `web/` directory

---

## Executive Summary

The web codebase demonstrates solid TypeScript practices with strict mode enabled. However, there are **critical security gaps** around SSRF protection and several areas for improvement in accessibility, error handling, and performance optimization.

---

## 1. Security

### Critical Issues

#### SSRF Protection Not Applied in API Route
**File**: `/home/doit/projects/web-doc-resolver/web/app/api/resolve/route.ts`

The API route has a simple URL validation function that only checks format:
```typescript
function isUrl(input: string): boolean {
  return /^https?:\/\/\S+$/i.test(input.trim());
}
```

However, a proper SSRF validation function exists in `lib/resolvers/index.ts` but is NOT imported or used:
```typescript
// lib/resolvers/index.ts - EXISTS but NOT USED
export function validateUrl(url: string): { valid: boolean; error?: string } {
  // Blocks private IPs, localhost, internal addresses
}
```

**Impact**: Attackers can make the server fetch from internal services, AWS metadata endpoints, or other sensitive URLs.

**Fix**: Import and use `validateUrl` in the API route before fetching:
```typescript
import { validateUrl } from "@/lib/resolvers";

// In POST handler:
if (urlMode) {
  const validation = validateUrl(input);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  // ... proceed with fetch
}
```

### High Issues

#### No Rate Limiting on API Endpoints
**Files**: All API routes in `/home/doit/projects/web-doc-resolver/web/app/api/`

No rate limiting middleware exists. The `DELETE` endpoint on `/api/cache` and `/api/records` can be abused.

**Fix**: Add rate limiting via middleware or Vercel Edge Middleware:
```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rateLimit = new Map<string, { count: number; resetAt: number }>();

export function middleware(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 100;

  const entry = rateLimit.get(ip);
  if (entry && entry.resetAt > now && entry.count >= maxRequests) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  // ... increment counter
}
```

#### API Keys Stored in Memory on Server
**File**: `/home/doit/projects/web-doc-resolver/web/lib/keys.ts`

API keys are stored in a module-level variable `inMemoryKeys`:
```typescript
let inMemoryKeys: ApiKeys = {};
```

While this works for serverless functions, keys could persist across warm invocations and potentially leak between requests in some hosting scenarios.

**Recommendation**: Consider encrypting keys at rest or using secure session storage.

### Medium Issues

#### Missing Content Security Policy
**File**: `/home/doit/projects/web-doc-resolver/web/vercel.json`

Has `X-Frame-Options` and `X-XSS-Protection` but missing CSP header:
```json
// Add to headers array:
{ "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" }
```

#### Cookie Security Could Be Strengthened
**File**: `/home/doit/projects/web-doc-resolver/web/app/api/ui-state/route.ts`

Cookie settings are good but could add `partitioned` for cross-site isolation:
```typescript
response.cookies.set(STATE_COOKIE, encoded, {
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 365,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  // Consider adding: partitioned: true for CHIPS
});
```

### Low Issues

#### Error Messages May Leak Internal State
**File**: `/home/doit/projects/web-doc-resolver/web/app/api/resolve/route.ts`

Generic error message at line 661:
```typescript
const message = err instanceof Error ? err.message : "Internal error";
```

Some error messages from providers could contain sensitive information.

**Fix**: Sanitize or categorize errors before returning to client.

---

## 2. Performance

### High Issues

#### No LRU Cache Eviction
**File**: `/home/doit/projects/web-doc-resolver/web/lib/cache.ts`

The cache has TTL-based expiration but no size limit. An attacker could fill memory:
```typescript
let store = new Map<string, CacheEntry>();
```

**Fix**: Implement LRU eviction with max entries:
```typescript
const MAX_ENTRIES = 1000;

export async function set(input: string, source: string, result: unknown, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  if (store.size >= MAX_ENTRIES) {
    // Evict oldest or expired entries
    const oldestKey = store.keys().next().value;
    if (oldestKey) store.delete(oldestKey);
  }
  // ... rest of function
}
```

### Medium Issues

#### Missing React.memo for Provider Buttons
**File**: `/home/doit/projects/web-doc-resolver/web/app/page.tsx`

Provider buttons in the sidebar re-render on every parent state change:
```typescript
{PROVIDERS.map((provider) => {
  // This creates new functions on every render
  return (
    <button
      onClick={() => available && handleProviderToggle(provider.id)}
      // ...
    >
```

**Fix**: Memoize the button component:
```typescript
const ProviderButton = React.memo(function ProviderButton({
  provider,
  isActive,
  isManual,
  available,
  onToggle,
}: {
  provider: UiProvider;
  isActive: boolean;
  isManual: boolean;
  available: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      onClick={() => available && onToggle(provider.id)}
      disabled={!available}
      // ...
    >
      {/* ... */}
    </button>
  );
});
```

#### Missing useCallback for Event Handlers
**File**: `/home/doit/projects/web-doc-resolver/web/app/page.tsx`

Event handlers are recreated on every render:
```typescript
const handleProviderToggle = (providerId: string) => {
  // ...
};
```

**Fix**:
```typescript
const handleProviderToggle = useCallback((providerId: string) => {
  setProfile("custom");
  setSelectedProviders((prev) => {
    // ...
  });
}, [profile]);
```

### Low Issues

#### Inline Object Creation in JSX
**File**: `/home/doit/projects/web-doc-resolver/web/app/page.tsx`

Inline style objects create new references:
```typescript
// These are fine for static values but could be extracted
className={`... ${isManual ? "bg-[#00ff41]..." : ...}`}
```

---

## 3. Accessibility

### High Issues

#### Missing ARIA Labels on Several Interactive Elements
**File**: `/home/doit/projects/web-doc-resolver/web/app/page.tsx`

1. Profile selector dropdown has no accessible name:
```typescript
<select
  value={profile}
  onChange={(e) => { ... }}
  className="..."
>
  // Missing: aria-label="Select profile"
```

2. Max chars input has no label association:
```typescript
<input
  type="number"
  value={maxChars}
  // Label exists but not programmatically associated
```

**Fix**:
```typescript
<label className="flex items-center justify-between min-h-[44px]">
  <span className="text-[11px] text-[#888]">Max chars</span>
  <input
    type="number"
    aria-label="Maximum characters"
    // ...
  />
</label>
```

#### Missing Focus Indicators
**File**: `/home/doit/projects/web-doc-resolver/web/app/globals.css`

No visible focus styles for keyboard navigation. Users cannot see which element is focused.

**Fix** - Add to `globals.css`:
```css
/* Focus visible styles */
:focus-visible {
  outline: 2px solid #00ff41;
  outline-offset: 2px;
}

/* Remove default outline when not using keyboard */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Medium Issues

#### No Skip Links
**File**: `/home/doit/projects/web-doc-resolver/web/app/layout.tsx`

No skip-to-content link for keyboard users to bypass sidebar.

**Fix**:
```typescript
<body>
  <a href="#main-content" className="sr-only focus:not-sr-only">
    Skip to main content
  </a>
  {children}
</body>
```

#### Missing Live Region for Status Updates
**File**: `/home/doit/projects/web-doc-resolver/web/app/page.tsx`

Loading and error states are not announced to screen readers:
```typescript
{providerStatus && (
  <div className="text-[11px] text-[#00ff41] mt-2 animate-pulse">
    {providerStatus}
  </div>
)}
```

**Fix**:
```typescript
<div role="status" aria-live="polite" aria-atomic="true">
  {providerStatus && (
    <div className="...">
      {providerStatus}
    </div>
  )}
</div>
```

### Low Issues

#### Color Contrast Issues
The UI uses `#666` text on `#0c0c0c` background. This has a contrast ratio of approximately 5.3:1, which passes WCAG AA for large text but fails for normal text (requires 4.5:1).

**Files with this issue**:
- `web/app/page.tsx` - multiple instances of `text-[#666]`
- `web/app/settings/page.tsx`
- `web/app/help/page.tsx`

---

## 4. Error Handling

### High Issues

#### No Error Boundary Component
**Files**: All page components

The application lacks any React Error Boundary. Unhandled errors crash the entire app.

**Fix** - Create `web/app/error.tsx`:
```typescript
"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-[#e8e6e3] font-mono p-8">
      <h1 className="text-[24px] font-bold mb-4">Something went wrong</h1>
      <p className="text-[#666] mb-4">{error.message}</p>
      <button
        onClick={reset}
        className="bg-[#00ff41] text-[#0c0c0c] px-4 py-2 text-[13px] font-bold"
      >
        Try again
      </button>
    </main>
  );
}
```

### Medium Issues

#### Empty Catch Blocks
**File**: `/home/doit/projects/web-doc-resolver/web/app/page.tsx`

Multiple empty catch blocks silently swallow errors:
```typescript
useEffect(() => {
  fetch("/api/key-status")
    .then((r) => r.json())
    .then(setKeyStatus)
    .catch(() => {}); // Silent failure

  loadStateFromServer()
    .then((serverState) => { ... })
    .catch(() => {}); // Silent failure
}, []);
```

**Fix** - Log errors in development:
```typescript
.catch((err) => {
  if (process.env.NODE_ENV === "development") {
    console.error("Failed to load key status:", err);
  }
});
```

#### No Structured Error Logging
**File**: `/home/doit/projects/web-doc-resolver/web/lib/log.ts`

The Logger class exists but is not used consistently across the codebase. API routes use `console.error` directly.

**Recommendation**: Use the Logger class consistently or integrate with a service like Sentry.

### Low Issues

#### Error Classification Exists But Unused
**File**: `/home/doit/projects/web-doc-resolver/web/lib/errors.ts`

A comprehensive error classification system exists but is not imported or used in API routes.

---

## 5. TypeScript

### Compliance Status: GOOD

**File**: `/home/doit/projects/web-doc-resolver/web/tsconfig.json`

The project has strict mode enabled:
```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

### Medium Issues

#### Unused Type Exports
**File**: `/home/doit/projects/web-doc-resolver/web/lib/resolvers/index.ts`

The `ProviderFn` type is exported but the file also exists in `app/api/resolve/route.ts` with a duplicate definition:
```typescript
// lib/resolvers/index.ts
export type ProviderFn = (query: string, keys: ProviderKeys, log: Logger) => Promise<string | null>;

// app/api/resolve/route.ts
type ProviderFn = (query: string, keys: ProviderKeys, maxChars: number) => Promise<string | null>;
```

These are incompatible signatures - should consolidate.

#### Any Type Usage
**File**: `/home/doit/projects/web-doc-resolver/web/lib/cache.ts`

```typescript
interface CacheEntry {
  result: unknown;  // Good - using unknown
  expiresAt: number;
}
```

The codebase properly uses `unknown` instead of `any` for the cache.

### Low Issues

#### Inconsistent Return Types
**File**: `/home/doit/projects/web-doc-resolver/web/lib/records.ts`

The `search` function could benefit from more explicit typing:
```typescript
export function search(query: string, limit = 50): Record[] {
  // Good - returns typed array
}
```

---

## 6. Additional Findings

### Missing Files

1. **No `middleware.ts`** - Required for rate limiting and request-level security
2. **No `error.tsx`** - Required for error boundaries in Next.js App Router
3. **No `not-found.tsx`** - Recommended for 404 handling

### Code Organization

The `app/api/resolve/route.ts` file is **664 lines** which exceeds the 500-line limit stated in AGENTS.md. Consider splitting into:
- `lib/resolvers/resolve-handler.ts` - Core resolution logic
- `lib/resolvers/providers.ts` - Provider implementations
- `app/api/resolve/route.ts` - Route handler only

---

## Summary Table

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | 1 | 2 | 2 | 1 |
| Performance | 0 | 1 | 2 | 1 |
| Accessibility | 0 | 2 | 2 | 1 |
| Error Handling | 0 | 1 | 2 | 1 |
| TypeScript | 0 | 0 | 1 | 1 |
| **Total** | **1** | **6** | **9** | **5** |

---

## Priority Fixes

1. **CRITICAL**: Apply SSRF validation in `/api/resolve` route
2. **HIGH**: Add rate limiting middleware
3. **HIGH**: Create error boundary (`error.tsx`)
4. **HIGH**: Implement LRU cache eviction with max entries
5. **HIGH**: Add focus indicators for keyboard navigation
6. **HIGH**: Add ARIA labels to form controls