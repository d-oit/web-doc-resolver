# Pre-Existing Bugs and Issues — CLI/Web

**Last Updated**: 2026-03-27
**Status**: Documented for future fixes

---

## Summary

| Bug ID | Severity | Component | Status | Effort |
|--------|----------|-----------|--------|--------|
| BUG-1 | CRITICAL | CLI `exa_mcp` | Open | Medium |
| BUG-2 | CRITICAL | CLI `duckduckgo` | Open | Medium |
| BUG-3 | CRITICAL | CLI Quality Gate | Open | Small |
| BUG-4 | HIGH | CLI `mistral_*` | Config | N/A |
| BUG-5 | MEDIUM | CLI `exa` SDK | Config | N/A |
| BUG-6 | LOW | CLI `--synthesize` | Blocked | Small |
| BUG-7 | MEDIUM | CLI `duckduckgo` URLs | Open | Small |

---

## BUG-1: Exa MCP — Wrong MCP Protocol Implementation

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

### Solution

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

## BUG-2: DuckDuckGo — HTML Parser Returns Zero Results

**Severity**: CRITICAL
**File**: `cli/src/providers/duckduckgo.rs`
**Impact**: Fallback free query provider is completely broken

### Problem

Two issues:

1. **Naive line-by-line parsing**: The `parse_ddg_results` function looks for `result__url` and `result__snippet` on the same line, but DuckDuckGo's HTML has these on separate lines/elements
2. **Redirect URLs not decoded**: DuckDuckGo uses redirect URLs (`//duckduckgo.com/l/?uddg=ENCODED_URL`) but the parser expects direct URLs

### Current (Broken) Code

```rust
fn parse_ddg_results(html: &str, limit: usize) -> Result<Vec<ResolvedResult>, ResolverError> {
    for line in html.lines() {
        if line.contains("result__url") || line.contains("result__snippet") {
            if let Some(url) = extract_ddg_url(line) {
                // This fails because:
                // 1. URL is a redirect: //duckduckgo.com/l/?uddg=https%3A%2F%2F...
                // 2. Result snippets are on different lines
            }
        }
    }
}
```

### Solution Option A: Decode Redirect URLs

```rust
fn extract_ddg_url(line: &str) -> Option<String> {
    // Look for DuckDuckGo redirect URL
    if let Some(start) = line.find("uddg=") {
        let start = start + 5;
        if let Some(end) = line[start..].find('&') {
            let encoded = &line[start..start + end];
            if let Ok(decoded) = urlencoding::decode(encoded) {
                return Some(decoded.to_string());
            }
        }
    }
    None
}

fn parse_ddg_results(html: &str, limit: usize) -> Result<Vec<ResolvedResult>, ResolverError> {
    let mut results = Vec::new();
    let mut current_url: Option<String> = None;
    let mut current_snippet: Option<String> = None;

    for line in html.lines() {
        // Extract URL from redirect link
        if line.contains("result__url") || line.contains("result__a") {
            current_url = extract_ddg_url(line);
        }
        // Extract snippet (may be on different line)
        if line.contains("result__snippet") {
            current_snippet = extract_ddg_snippet(line);
        }
        // Combine when we have both
        if let (Some(url), Some(snippet)) = (&current_url, &current_snippet) {
            results.push(ResolvedResult::new(
                url.clone(),
                Some(snippet.clone()),
                "duckduckgo",
                0.5,
            ));
            current_url = None;
            current_snippet = None;
            if results.len() >= limit {
                break;
            }
        }
    }
    Ok(results)
}
```

### Solution Option B: Use Jina Reader (Recommended)

Use the same approach as the web UI — delegate HTML parsing to Jina Reader:

```rust
async fn search(&self, query: &str, limit: usize) -> Result<Vec<ResolvedResult>, ResolverError> {
    let ddg_url = format!(
        "https://html.duckduckgo.com/html/?q={}",
        urlencoding::encode(query)
    );
    let jina_url = format!("https://r.jina.ai/{}", ddg_url);

    let response = self.client
        .get(&jina_url)
        .header("Accept", "text/markdown")
        .send()
        .await?;

    let markdown = response.text().await?;
    // Parse Jina's markdown output for URLs and snippets
    let results = self.parse_jina_results(&markdown, limit);
    Ok(results)
}
```

### Verification

```bash
# Test DuckDuckGo HTML structure
curl -s "https://html.duckduckgo.com/html/?q=Rust+async" | grep "result__url" | head -3
# Shows: //duckduckgo.com/l/?uddg=https%3A%2F%2Fdoc.rust-lang.org%2F...
```

---

## BUG-3: Quality Gate Rejects Valid Search Results

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

### Solution Option A: Concatenate Results for Search Providers

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

### Solution Option B: Lower Threshold for Query Providers

```rust
// In score_content(), adjust thresholds for search snippets:
let min_chars = if is_query_result {
    100  // Search snippets are naturally short
} else {
    self.config.min_chars  // Default 200
};
```

### Solution Option C: Skip Quality Gate for Multi-Result Searches

```rust
// If provider returns multiple results, accept without quality gate
if results.len() >= 3 {
    // Multiple search results = good coverage
    return Ok(results[0]);
}
```

### Recommended

**Option A** — provides best user experience by giving LLMs more context from multiple search results.

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

## BUG-7: DuckDuckGo Redirect URLs Not Decoded

**Severity**: MEDIUM
**File**: `cli/src/providers/duckduckgo.rs`
**Impact**: Even if parser finds URLs, they're redirect URLs

### Problem

DuckDuckGo uses redirect URLs in format:
```
//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com&rut=...
```

The `extract_ddg_url` function returns this redirect URL as-is, which:
1. Is not a valid HTTP URL (starts with `//`)
2. Would require following the redirect to get the actual target
3. The actual URL is URL-encoded in the `uddg` parameter

### Solution

See BUG-2 Solution A — extract and decode the `uddg` parameter.

---

## Testing Verification

After fixes, run this test matrix:

```bash
# Build release binary
cd cli && cargo build --release

# Test free providers (should work with no API keys)
./target/release/do-wdr resolve "Rust async frameworks" --provider exa_mcp
./target/release/do-wdr resolve "Rust async frameworks" --provider duckduckgo

# Test cascade (should succeed with free providers)
./target/release/do-wdr resolve "Rust async frameworks" --profile free

# Test URL cascade (should still work)
./target/release/do-wdr resolve "https://docs.rs/tokio"
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