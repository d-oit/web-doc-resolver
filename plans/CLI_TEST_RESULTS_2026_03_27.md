# Rust CLI (`do-wdr`) Live Test Results — 2026-03-27

**Binary**: `cli/target/release/do-wdr` (9.9 MB, built 2026-03-24)
**API Keys**: EXA, MISTRAL, TAVILY, FIRECRAWL, SERPER (from `web/.env`)
**Version**: 0.3.0

---

## Test Matrix

### Query Providers (Individual `--provider`)

| Provider | Status | Latency | Notes |
|----------|--------|---------|-------|
| `exa_mcp` | ❌ FAIL | 0.2s | **Missing `Accept` header** — Exa MCP requires `Accept: application/json, text/event-stream` |
| `exa` (SDK) | ❌ FAIL | 0.3s | `Payment required` — EXA_API_KEY quota exhausted |
| `tavily` | ✅ PASS | 1.1s | Returns valid content |
| `serper` | ✅ PASS | 0.9s | Works, tracks credits (1/2500) |
| `duckduckgo` | ❌ FAIL | 1.1s | HTML parsing returns 0 results — `parse_ddg_results` fails |
| `mistral_websearch` | ❌ FAIL | 0.2s | `Unauthorized` — MISTRAL_API_KEY rejected |

### URL Providers (Individual `--provider`)

| Provider | Status | Latency | Notes |
|----------|--------|---------|-------|
| `llms_txt` | ✅ PASS | 1.5s | Finds GitHub's llms.txt, returns structured docs |
| `jina` | ✅ PASS | 1.3s | Clean markdown extraction |
| `firecrawl` | ✅ PASS | 4.6s | Deep extraction with JS rendering |
| `direct_fetch` | ❌ FAIL | 0.1s | Network error on some URLs (httpbin.org works) |
| `mistral_browser` | ❌ FAIL | 0.2s | Same auth error as mistral_websearch |

### Profile-Based Cascade (Query: "what is rust programming language")

| Profile | Status | Result | Root Cause |
|---------|--------|--------|------------|
| `free` | ❌ FAIL | "No query resolution method available" | exa_mcp fails (header bug), duckduckgo fails (parser bug) |
| `balanced` | ❌ FAIL | Same | exa_mcp fails, exa exhausted, tavily thin, duckduckgo fails |
| `fast` | ❌ FAIL | Same | Budget too small + all providers fail |
| `quality` | ❌ FAIL | Same | All providers fail or produce "thin content" |

### Profile-Based Cascade (URL: "https://docs.rs")

| Profile | Status | Provider Used | Latency |
|---------|--------|--------------|---------|
| `free` | ✅ PASS | jina | 1.7s |
| `balanced` | ✅ PASS | llms_txt or jina | 1.5–1.9s |

### Special Modes

| Mode | Status | Notes |
|------|--------|-------|
| `--synthesize` | ❌ FAIL | "Invalid synthesis response format" |
| `--json` | ✅ PASS | Correct JSON output format |
| `--providers-order` | ✅ PASS | Custom ordering works |
| `cache-stats` | ✅ PASS | "Semantic cache is disabled" |
| `config` | ✅ PASS | Shows all config values |
| `providers` | ✅ PASS | Lists all providers correctly |

---

## Critical Bugs Found

### BUG-1: exa_mcp — Wrong MCP Protocol (CRITICAL)

**File**: `cli/src/providers/exa_mcp.rs`

**Three issues**:

1. **Missing Accept header**: The `reqwest` client sends `Accept: application/json`, but Exa MCP requires `Accept: application/json, text/event-stream`
2. **Wrong method**: Uses `"exa.search"` instead of `"tools/call"` with `params: { name: "web_search_exa", arguments: { query, numResults } }`
3. **Wrong response parsing**: Response is SSE format (`event: message\ndata: {...}`) but code parses as plain JSON

**Error**: `Not Acceptable: Client must accept both application/json and text/event-stream`

**Working curl** (tested):
```bash
curl -X POST "https://mcp.exa.ai/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"web_search_exa","arguments":{"query":"rust programming","numResults":3}}}'
```

**Fix**: Update exa_mcp.rs to:
- Add `Accept: application/json, text/event-stream` header
- Change method to `"tools/call"` with nested params
- Parse SSE response (strip `event: message\ndata: ` prefix, then parse JSON)

### BUG-2: duckduckgo — HTML Parser Returns 0 Results (CRITICAL)

**File**: `cli/src/providers/duckduckgo.rs`

The `parse_ddg_results` function uses naive line-by-line HTML parsing that fails to extract any results. It looks for `result__url` and `result__snippet` on the same line, but DuckDuckGo's HTML has these on separate lines/elements.

**Fix**: Use a proper HTML parsing approach (e.g., `scraper` crate) or switch to Jina Reader approach (same as web UI — `https://r.jina.ai/https://html.duckduckgo.com/html/?q=...`).

### BUG-3: Quality Gate Rejects Valid Search Results (CRITICAL)

**File**: `cli/src/resolver.rs` line 482-492

The resolver takes `results[0]` (first result only) and quality-scores it. Search providers (serper, tavily, exa) return multiple results where each individual snippet is short (100-200 chars). The quality gate marks these as `too_short` (< 500 chars) → score drops to 0.50 → rejected.

**Evidence**: Serper returns 5 results with 632 total chars, but `results[0].content` is only ~160 chars.

**Fix options**:
1. **Concatenate** all results into one before quality scoring
2. **Lower `too_short` threshold** for query providers (e.g., 100 chars)
3. **Skip quality gate** for search snippets when there are multiple results

### BUG-4: Mistral API Key Unauthorized

**Symptom**: `{"detail":"Unauthorized"}` for both `mistral_websearch` and `mistral_browser`

**Possible causes**:
- Key expired or revoked
- Key is for a different Mistral service tier
- Key format mismatch (33 chars — seems valid)

**Action**: User should verify MISTRAL_API_KEY validity at https://console.mistral.ai

### BUG-5: Exa SDK Quota Exhausted

**Symptom**: `Payment required to access this resource`

**Action**: User should check EXA_API_KEY credits at https://dashboard.exa.ai

### BUG-6: `--synthesize` Fails

**File**: `cli/src/synthesis.rs`

Error: "Invalid synthesis response format" — likely the synthesis code expects a specific Mistral response format that doesn't match, or the Mistral key is unauthorized (same as BUG-4).

---

## Summary

### What Works

| Feature | Status |
|---------|--------|
| URL resolution (llms_txt, jina, firecrawl) | ✅ Excellent |
| CLI UX (--json, --profile, --provider, --providers-order) | ✅ Excellent |
| Config loading (env vars, CLI flags) | ✅ Works |
| Circuit breaker / budget system | ✅ Works (verified via cascade behavior) |
| Serper provider | ✅ Works (with credit tracking) |
| Tavily provider | ✅ Works |

### What's Broken

| Feature | Severity | Effort |
|---------|----------|--------|
| exa_mcp (wrong MCP protocol) | **CRITICAL** — only free query provider is broken | Medium |
| DuckDuckGo (HTML parser broken) | **CRITICAL** — other free query provider broken | Small |
| Quality gate too strict for search results | **CRITICAL** — rejects valid content | Small |
| Mistral providers (key issue) | **HIGH** — user-specific, may work with valid key | N/A (config) |
| Exa SDK (quota exhausted) | **MEDIUM** — user-specific | N/A (config) |
| Synthesize mode | **LOW** — depends on Mistral key | Small |

### Impact Statement

**All query resolution is broken in the default cascade.** The two free providers (exa_mcp, duckduckgo) both have code bugs, paid providers (exa, mistral) have key issues, and the working paid providers (tavily, serper) produce results that get rejected by the quality gate. Only URL resolution works reliably.

### Recommended Fix Priority

1. **Fix exa_mcp MCP protocol** — restores the primary free query provider
2. **Fix quality gate** for search results — allows tavily/serper to succeed in cascade
3. **Fix duckduckgo parser** — restores fallback free query provider
4. **Add serper to default query cascade** — it works and has 2500 free credits
