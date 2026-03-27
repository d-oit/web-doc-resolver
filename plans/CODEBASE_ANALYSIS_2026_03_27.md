# Codebase Analysis — 2026-03-27

**Scope**: Full codebase (Python, Rust CLI, Web UI) — improvements, bugs, new features
**Version**: 0.3.0 (latest: `b9d7b61`)
**All GitHub issues**: CLOSED (0 open)

---

## 1. Critical: Dead Code / Dual Provider Stack (Web)

### Problem
`web/app/api/resolve/route.ts` (663 lines) contains **duplicate provider implementations** that are never reached. The refactored versions live in `web/lib/resolvers/` (index.ts, query.ts, url.ts — 600 lines total) and are **not imported by `route.ts`**.

**route.ts** defines its own: `extractViaJina`, `extractViaDirectFetch`, `extractViaFirecrawl`, `searchViaSerper`, `searchViaTavily`, `searchViaDuckDuckGoFree`, `searchViaDuckDuckGoLite`, `searchViaMistralWeb`, `searchViaExaMcpWithMistral`, `extractViaMistralBrowser`

**lib/resolvers/** defines identical functions with structured logging via `Logger`, error classification via `classifyError()`, and SSRF validation via `validateUrl()`.

### Impact
- **route.ts is the code that runs** — it processes API requests. The refactored `lib/resolvers/` code with logging, error classification, and SSRF protection is **unused dead code**.
- The refactored code has better quality (logging, error types) but is never called.
- 663 LOC exceeds the 500-line project limit.

### Fix (P0 — HIGH)
Rewrite `route.ts` to import and use `lib/resolvers/` functions. Strip the inline provider definitions. Target: <300 LOC for route.ts.

---

## 2. Critical: Cache & Records Memory Leaks (Web)

### 2.1 Cache — No Size Limit
**File**: `web/lib/cache.ts` — `Map<string, CacheEntry>` with no max size, no LRU eviction.

### 2.2 Records — No Size Limit
**File**: `web/lib/records.ts` — `Map<string, Record>` with no max size. Every successful resolve appends a record forever.

### Impact
Vercel serverless functions that stay warm will accumulate unbounded state.

### Fix (P0 — HIGH)
Add `MAX_ENTRIES` (e.g., 500 for cache, 200 for records) with eviction on insert.

---

## 3. Security: SSRF Protection Not Active (Web)

### Problem
`web/lib/resolvers/index.ts` has `validateUrl()` with private IP blocking — **but it is never called**. The live `route.ts` uses `isUrl()` (regex only) with no SSRF check.

### Impact
Users can resolve internal URLs (127.0.0.1, 10.x, 192.168.x) through the public API.

### Fix (P0 — HIGH)
After route.ts migration (item #1), SSRF protection will be active. If migrating later, add `validateUrl()` call to `route.ts` immediately.

---

## 4. CRITICAL: All CLI Query Resolution is Broken

**See**: [`CLI_TEST_RESULTS_2026_03_27.md`](CLI_TEST_RESULTS_2026_03_27.md) for full test matrix.

### Root Causes (3 compounding bugs)

1. **exa_mcp uses wrong MCP protocol** (`cli/src/providers/exa_mcp.rs`): wrong method (`"exa.search"` vs `"tools/call"`), missing `Accept` header, wrong response parsing (JSON vs SSE). The primary free query provider is completely non-functional.

2. **DuckDuckGo HTML parser returns 0 results** (`cli/src/providers/duckduckgo.rs`): naive line-by-line parsing fails on real HTML. The fallback free query provider is completely non-functional.

3. **Quality gate rejects valid search results** (`cli/src/resolver.rs` line 482): takes only `results[0]` content (~120 char snippet) and marks it `too_short` (< 500 chars). Even working paid providers (tavily, serper) get their results rejected as "thin_content".

### Impact
ALL profiles (free, balanced, fast, quality) fail for queries. Only URL resolution works.

### Fix (P0 — CRITICAL)
1. Fix exa_mcp protocol (SSE + correct method + Accept header)
2. Fix quality gate to concatenate multi-result content before scoring
3. Fix DuckDuckGo to use Jina Reader approach (like web UI does)
4. Add serper to default query cascade (it's missing but works)

---

## 5. Code Quality: Missing Error Context in route.ts

### Problem
All `catch` blocks in route.ts swallow errors:
```typescript
} catch {
  return null;
}
```
No logging, no error classification, no provider summary in responses.

### Impact
Production debugging is impossible. Users see generic "No search results found".

### Fix (P1 — MEDIUM)
Resolved by migrating to `lib/resolvers/` (item #1), which already has structured logging.

---

## 6. Web UI: No Input Validation

### Problem
- No query length limit (DoS via massive input)
- No URL validation for SSRF (see #3)
- API keys sent in request body with no sanitization

### Fix (P1 — MEDIUM)
Add input validation in `route.ts` POST handler:
- Max query length: 10,000 chars
- URL validation via `validateUrl()`
- Trim/sanitize inputs

---

## 7. Web UI: No Rate Limiting

### Problem
All API routes (`/api/resolve`, `/api/ui-state`, `/api/records`, `/api/key-status`) have no rate limiting. 

### Fix (P2 — LOW)
Add Vercel Edge middleware or in-memory token bucket. The `route.ts` handler runs on serverless — use Vercel KV or header-based IP limiting.

---

## 8. Web UI: Accessibility Gaps

### Problem
- Provider toggle buttons lack `aria-pressed` state
- No skip-to-content link for keyboard users
- Copy button lacks `aria-live` announcement
- `<select>` for profile has no visible label association

### Fix (P2 — LOW)
Add ARIA attributes to interactive elements in `page.tsx`.

---

## 9. Test Coverage Gaps

### 9.1 Web: No Unit Tests for Providers
`web/lib/resolvers/` has zero unit tests. Only `web/tests/e2e/` and `web/tests/ui-state.test.ts` exist.

### 9.2 Rust CLI: Only 4 Tests
`cargo test` runs 4 routing tests. No provider mock tests.

### 9.3 Python: Tests Cannot Run
`python -m pytest` fails — `pytest` not installed in current environment.

### Fix (P2 — LOW)
- Add Vitest unit tests for `lib/resolvers/query.ts` and `lib/resolvers/url.ts` (mock fetch)
- Add Rust tests for individual providers with mock HTTP

---

## 10. DX: `fetchWithTimeout` Defined 3 Times

### Problem
`fetchWithTimeout()` is copy-pasted in:
1. `web/app/api/resolve/route.ts` (line 34)
2. `web/lib/resolvers/query.ts` (line 7)
3. `web/lib/resolvers/url.ts` (line 6)

### Fix (P2 — LOW)
Extract to `web/lib/fetch.ts` and import.

---

## New Feature Opportunities

### F1. Markdown Preview (Web UI)

**Value**: Users currently see raw markdown in a `<textarea>`. Rendering it would dramatically improve UX.

**Implementation**:
- Add `react-markdown` + `remark-gfm` for rendered view
- Toggle button: "Raw" / "Preview"
- Syntax highlighting for code blocks via `rehype-highlight`

**Effort**: Small — 1 component, ~50 LOC

---

### F2. Export Options (Web UI)

**Value**: Users can only copy raw text. Add export as:
- `.md` file download
- `.pdf` (via browser print)
- `.json` (full response with metadata)

**Effort**: Small — 3 buttons, ~30 LOC

---

### F3. Batch Resolution (CLI + Web)

**Value**: Resolve multiple URLs/queries in one invocation.

**CLI**: `do-wdr resolve --batch urls.txt`
**Web API**: Accept `queries: string[]` in request body
**Web UI**: Textarea for multi-line input, resolve all

**Effort**: Medium — CLI already has parallel infra, web needs queue UI

---

### F4. Resolution History (Web UI — Planned)

**Status**: Planned in `UI_ENHANCEMENTS_PLAN.md` Phase 4 but not implemented.
**Records module exists** (`web/lib/records.ts`) but is in-memory only — reset on cold start.

**Implementation**:
- Use Vercel KV or localStorage for persistence
- Show history sidebar with search/filter
- Re-resolve from history

**Effort**: Medium

---

### F5. Provider Health Dashboard (Web UI)

**Value**: Show circuit breaker status, success rates, avg latency per provider.

**Implementation**:
- New `/api/health` endpoint exposing circuit breaker state
- Dashboard page with provider cards showing status dots
- Real-time updates via polling

**Effort**: Medium

---

### F6. OpenAPI Spec + Playground

**Value**: Self-documenting API for external consumers.

**Implementation**:
- Generate OpenAPI 3.1 spec from route types
- Embed Swagger UI at `/api-docs`

**Effort**: Small

---

### F7. Webhook / Callback Mode (API)

**Value**: For long-running resolves, accept a callback URL and POST results when done.

**Implementation**:
- Accept `callbackUrl` in request body
- Return `202 Accepted` with job ID
- POST result to callback on completion

**Effort**: Medium

---

### F8. Provider Cost Tracking (Web UI)

**Value**: Show estimated cost per resolution based on provider pricing.

**Implementation**:
- Add cost-per-request estimates to provider definitions
- Show total estimated cost in response metadata
- Running cost counter in UI

**Effort**: Small

---

## Priority Matrix

| # | Item | Priority | Effort | Type |
|---|------|----------|--------|------|
| 4a | Fix CLI exa_mcp MCP protocol | P0 | Medium | Bug |
| 4b | Fix CLI quality gate for search results | P0 | Small | Bug |
| 4c | Fix CLI DuckDuckGo parser | P0 | Small | Bug |
| 4d | Add serper to CLI default query cascade | P0 | Small | Bug |
| 1 | Migrate route.ts to use lib/resolvers/ | P0 | Medium | Bug/Refactor |
| 2 | Cache + Records size limits | P0 | Small | Bug |
| 3 | Activate SSRF protection | P0 | Small | Security |
| 5 | Error context in catch blocks | P1 | — | Fixed by #1 |
| 6 | Input validation | P1 | Small | Security |
| 7 | Rate limiting | P2 | Medium | Security |
| 8 | Accessibility (ARIA) | P2 | Small | UX |
| 9 | Unit tests for providers | P2 | Medium | Quality |
| 10 | DRY fetchWithTimeout | P2 | Small | DX |
| F1 | Markdown preview | P2 | Small | Feature |
| F2 | Export options | P3 | Small | Feature |
| F3 | Batch resolution | P3 | Medium | Feature |
| F4 | Resolution history | P3 | Medium | Feature |
| F5 | Provider health dashboard | P3 | Medium | Feature |
| F6 | OpenAPI spec | P3 | Small | Feature |
| F7 | Webhook/callback mode | P4 | Medium | Feature |
| F8 | Cost tracking | P4 | Small | Feature |

---

## Recommended Implementation Order

### Wave 1 (P0 — Do Now)
1. **Fix CLI query resolution** — exa_mcp protocol, quality gate, DuckDuckGo parser, add serper to cascade
2. **Migrate route.ts** → import from `lib/resolvers/`, delete inline providers
3. **Add cache/records limits** → `MAX_ENTRIES` with eviction
4. **SSRF protection** → comes free with #2

### Wave 2 (P1 — Next Sprint)
4. Fix `fast` profile cascade
5. Add input validation to API routes
6. Add query length limits

### Wave 3 (P2 — Near Term)
7. Provider unit tests (Vitest mocks)
8. ARIA accessibility pass
9. Markdown preview feature
10. Extract shared `fetchWithTimeout`

### Wave 4 (P3 — Backlog)
11. Export options
12. Resolution history persistence
13. Batch resolution
14. Provider health dashboard

---

## Files Reviewed

| File | Lines | Notes |
|------|-------|-------|
| `web/app/api/resolve/route.ts` | 663 | **Bloated** — duplicates lib/resolvers |
| `web/lib/resolvers/index.ts` | 184 | Good — structured, typed |
| `web/lib/resolvers/query.ts` | 245 | Good — has logging |
| `web/lib/resolvers/url.ts` | 171 | Good — has logging |
| `web/lib/cache.ts` | 75 | **No size limit** |
| `web/lib/records.ts` | 48 | **No size limit** |
| `web/lib/circuit-breaker.ts` | 49 | OK — hardcoded thresholds |
| `web/lib/routing.ts` | 114 | OK |
| `web/lib/errors.ts` | 118 | Good — error classification |
| `web/lib/log.ts` | 86 | Good — structured logger |
| `web/lib/quality.ts` | 41 | OK |
| `web/app/page.tsx` | 517 | Exceeds 500-line limit |
| `cli/src/resolver.rs` | 948 | Exceeds 500-line limit |
| `scripts/resolve.py` | 544 | Exceeds 500-line limit |
