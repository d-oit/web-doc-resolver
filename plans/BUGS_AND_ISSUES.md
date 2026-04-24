# Pre-Existing Bugs and Issues — CLI/Web

**Last Updated**: 2026-03-27
**Status**: Multiple bugs fixed, remaining are config-dependent or blocked

---

## Summary

| Bug ID | Severity | Component | Status | Effort |
|--------|----------|-----------|--------|--------|
| BUG-1 | CRITICAL | CLI `exa_mcp` | **FIXED** | Medium |
| BUG-2 | CRITICAL | CLI `duckduckgo` | **PARTIAL** | Medium |
| BUG-3 | CRITICAL | CLI Quality Gate | **FIXED** | Small |
| BUG-4 | HIGH | CLI `mistral_*` | Config | N/A |
| BUG-5 | MEDIUM | CLI `exa` SDK | Config | N/A |
| BUG-6 | LOW | CLI `--synthesize` | Blocked | Small |
| BUG-7 | MEDIUM | CLI `duckduckgo` URLs | **FIXED** | Small |

**2026-03-27 Fix Summary**:
- BUG-1: Fixed MCP protocol (Accept header, tools/call method, SSE parsing)
- BUG-3: Fixed quality gate to concatenate search results for scoring
- BUG-7: Fixed URL extraction to decode `uddg=` redirect parameter
- BUG-2: Parser logic fixed, but DuckDuckGo blocks automated requests with CAPTCHA (external limitation, not code bug)

---

## BUG-1: Exa MCP — Wrong MCP Protocol Implementation ✅ FIXED

**Severity**: CRITICAL
**File**: `cli/src/providers/exa_mcp.rs`
**Impact**: Primary free query provider is completely broken

### Problem

Three separate issues:

1. **Missing Accept header**: Exa MCP requires `Accept: application/json, text/event-stream` but code only sends `Accept: application/json`
2. **Wrong JSON-RPC method**: Uses `"exa.search"` instead of `"tools/call"` with proper params structure
3. **Wrong response parsing**: Response is SSE format but code parses as plain JSON

### Error

```
Not Acceptable: Client must accept both application/json and text/event-stream
```

### Solution (IMPLEMENTED)

Update `cli/src/providers/exa_mcp.rs`:

```rust
// Current (broken)
let response = client
    .post("https://mcp.exa.ai/mcp")
    .json(&json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "exa.search",  // WRONG
        "params": { "query": query, "numResults": limit }
    }))
    .send()
    .await?;

// Fixed version
let response = client
    .post("https://mcp.exa.ai/mcp")
    .header("Accept", "application/json, text/event-stream")  // REQUIRED
    .json(&json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",  // CORRECT
        "params": {
            "name": "web_search_exa",
            "arguments": {
                "query": query,
                "numResults": limit
            }
        }
    }))
    .send()
    .await?;

// Parse SSE response
let text = response.text().await?;
// SSE format: "event: message\ndata: {...}\n\n"
let json_str = text
    .lines()
    .find(|l| l.starts_with("data: "))
    .map(|l| &l[6..])
    .unwrap_or("");
let result: ExaResponse = serde_json::from_str(json_str)?;
```

### Verification

```bash
# Working curl (verified 2026-03-27)
curl -X POST "https://mcp.exa.ai/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"web_search_exa","arguments":{"query":"rust programming","numResults":3}}}'
```

---

## BUG-2: DuckDuckGo — HTML Parser Returns Zero Results ⚠️ PARTIAL FIX

**Severity**: CRITICAL
**File**: `cli/src/providers/duckduckgo.rs`
**Impact**: Fallback free query provider has external limitation

### Problem

Two issues:

1. **Naive line-by-line parsing**: The `parse_ddg_results` function looked for `result__url` and `result__snippet` on the same line, but DuckDuckGo's HTML has these on separate lines/elements
2. **Redirect URLs not decoded**: DuckDuckGo uses redirect URLs (`//duckduckgo.com/l/?uddg=ENCODED_URL`) but the parser expected direct URLs

### Status (2026-03-27)

**Code fixes implemented**:
- Added `extract_ddg_url()` function to decode `uddg=` parameter
- Added `extract_ddg_snippet()` and `extract_ddg_title()` functions
- Improved line-by-line parsing logic

**External limitation discovered**: DuckDuckGo blocks automated requests with a CAPTCHA challenge ("Select all squares containing a duck"). This is DuckDuckGo's bot protection, not a bug in our code.

```html
<div class="anomaly-modal__title">Unfortunately, bots use DuckDuckGo too.</div>
<div class="anomaly-modal__description">Please complete the following challenge to confirm this search was made by a human.</div>
```

### Workaround Options

1. Use exa_mcp as primary free query provider (works, no CAPTCHA)
2. Add a browser-based approach (headless browser can solve CAPTCHA)
3. Consider DuckDuckGo Lite API if available

---

## BUG-3: Quality Gate Rejects Valid Search Results ✅ FIXED

**Severity**: CRITICAL
**File**: `cli/src/resolver.rs` (lines 482-492)
**Impact**: Even working providers (tavily, serper) get rejected in cascade

### Problem

The resolver takes only `results[0]` (first result) and quality-scores it. Search providers return multiple results where each individual snippet is short (100-200 chars). The quality gate marks these as `too_short` (< 500 chars) → score drops → rejected.

### Evidence

```
Serper returns 5 results with 632 total chars
But results[0].content is only ~160 chars
→ Marked as "thin_content"
→ Rejected by quality gate
→ Cascade continues to next provider
→ Eventually: "No query resolution method available"
```

### Solution (IMPLEMENTED: Option A)

Concatenate all search results for quality scoring:

```rust
// In resolve_query(), when handling search results:
if results.len() > 1 {
    // Concatenate all snippets for quality scoring
    let combined_content = results
        .iter()
        .filter_map(|r| r.content.as_deref())
        .collect::<Vec<_>>()
        .join("\n\n---\n\n");

    let mut combined = results[0].clone();
    combined.content = Some(combined_content);
    // Now quality score the combined content
}
```

### Verification

```
Before fix: score=0.50, content_len=269, acceptable=false
After fix:  score=0.85, content_len=1325, acceptable=true
```

---

## BUG-4: Mistral API Key Unauthorized

**Severity**: HIGH (User-specific)
**Files**: `cli/src/providers/mistral_*.rs`
**Impact**: `mistral_websearch` and `mistral_browser` providers fail

### Problem

```
{"detail":"Unauthorized"}
```

### Possible Causes

1. Key expired or revoked
2. Key is for a different Mistral service tier
3. Key format mismatch (33 chars — seems valid)

### Solution

**User action required**: Verify `MISTRAL_API_KEY` validity at https://console.mistral.ai

Check:
- Key is active
- Key has correct permissions (web search, browser)
- Account has available credits

---

## BUG-5: Exa SDK Quota Exhausted

**Severity**: MEDIUM (User-specific)
**File**: `cli/src/providers/exa_sdk.rs`
**Impact**: `exa` provider returns "Payment required"

### Problem

```
Payment required to access this resource
```

### Solution

**User action required**: Check `EXA_API_KEY` credits at https://dashboard.exa.ai

Options:
- Upgrade Exa plan
- Wait for quota reset
- Use `exa_mcp` instead (free, but currently broken — see BUG-1)

---

## BUG-6: Synthesize Mode Fails

**Severity**: LOW
**File**: `cli/src/synthesis.rs`
**Impact**: `--synthesize` flag returns error

### Problem

```
Invalid synthesis response format
```

### Root Cause

Depends on Mistral API key (BUG-4). Synthesis requires:
1. Multiple provider results
2. Mistral to combine/synthesize results

### Solution

1. Fix BUG-4 (Mistral API key)
2. Verify synthesis response format matches expected schema
3. Add better error messages

---

## BUG-7: DuckDuckGo Redirect URLs Not Decoded ✅ FIXED

**Severity**: MEDIUM
**File**: `cli/src/providers/duckduckgo.rs`
**Impact**: URL extraction now works correctly

### Problem

DuckDuckGo uses redirect URLs in format:
```
//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com&rut=...
```

The old `extract_ddg_url` function returned this redirect URL as-is, which:
1. Is not a valid HTTP URL (starts with `//`)
2. Would require following the redirect to get the actual target
3. The actual URL is URL-encoded in the `uddg` parameter

### Solution (IMPLEMENTED)

Added `extract_ddg_url()` function to decode the `uddg` parameter:

```rust
fn extract_ddg_url(line: &str) -> Option<String> {
    if let Some(start) = line.find("uddg=") {
        let start = start + 5;
        let end = line[start..]
            .find('&')
            .or_else(|| line[start..].find('"'))
            .or_else(|| line[start..].find("'"))
            .unwrap_or_else(|| line[start..].len().min(500));
        let encoded = &line[start..start + end];
        if let Ok(decoded) = urlencoding::decode(encoded) {
            let url = decoded.to_string();
            if url.starts_with("http://") || url.starts_with("https://") {
                return Some(url);
            }
        }
    }
    None
}
```

---

## Testing Verification

**2026-03-27 Test Results**:

```bash
# Test exa_mcp (FIXED - now works!)
./target/release/do-wdr resolve "Rust async frameworks" --provider exa_mcp
# Result: 5 results, quality score 0.85, accepted

# Test cascade (FIXED - now succeeds!)
./target/release/do-wdr resolve "Rust async frameworks"
# Result: exa_mcp succeeds with quality score 0.85

# Test DuckDuckGo (external limitation - CAPTCHA)
./target/release/do-wdr resolve "Rust async frameworks" --provider duckduckgo
# Result: No results (DuckDuckGo blocks with CAPTCHA)

# Test URL cascade (still works)
./target/release/do-wdr resolve "https://docs.rs/tokio"
# Result: Jina Reader extracts content correctly
```

---

## Related Files

- `cli/src/providers/exa_mcp.rs` — Exa MCP provider
- `cli/src/providers/duckduckgo.rs` — DuckDuckGo provider
- `cli/src/resolver.rs` — Quality gate logic
- `cli/src/providers/mistral_websearch.rs` — Mistral web search
- `cli/src/providers/mistral_browser.rs` — Mistral browser
- `cli/src/synthesis.rs` — Synthesis mode

---

## References

- [CLI_TEST_RESULTS_2026_03_27.md](./CLI_TEST_RESULTS_2026_03_27.md) — Original test results
- [CODEBASE_ANALYSIS_2026_03_27.md](./CODEBASE_ANALYSIS_2026_03_27.md) — Codebase analysis