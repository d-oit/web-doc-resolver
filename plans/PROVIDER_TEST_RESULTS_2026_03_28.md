# Provider Test Results - 2026-03-28

## Environment Setup

The CLI does **not** automatically load `.env` files. You must source it manually:

```bash
# From the repository root directory
set -a && source .env && set +a
```

Or export variables directly:
```bash
export TAVILY_API_KEY="your_key"
export SERPER_API_KEY="your_key"
# etc.
```

## Available API Keys in .env

| Key Name | Used By | Status |
|----------|---------|--------|
| `TAVILY_API_KEY` | `tavily` provider | ✅ Working |
| `FIRECRAWL_API_KEY` | `firecrawl` provider | ✅ Working |
| `SERPER_API_KEY` | `serper` provider | ✅ Working (2499/2500 credits) |
| `MISTRAL_API_KEY` | `mistral_websearch`, `mistral_browser` | ✅ Working |
| `NVIDIA_API_KEY` | Not used by CLI | N/A |

## Query Provider Test Results

### Test Command
```bash
# From the repository root directory
set -a && source .env && set +a
cd cli && cargo build --release
./target/release/do-wdr resolve "rust async" --provider <provider> --json
```

### Results

| Provider | API Key Required | Status | Score | Latency |
|----------|-----------------|--------|-------|---------|
| `exa_mcp` | No (free) | ✅ Working | 0.70 | ~1.1s |
| `tavily` | `TAVILY_API_KEY` | ✅ Working | 0.99 | ~0.5s |
| `serper` | `SERPER_API_KEY` | ✅ Working | 0.80 | ~0.2s |
| `duckduckgo` | No (free) | ✅ Working | 0.50 | ~0.4s |
| `mistral_websearch` | `MISTRAL_API_KEY` | ✅ Working | 0.80 | ~1.5s |

## URL Provider Test Results

### Test Command (URL Providers)
```bash
# From cli directory (after building)
cd cli && ./target/release/do-wdr resolve "https://docs.rs/tokio" --provider <provider> --json
```

### Results

| Provider | API Key Required | Status | Score |
|----------|-----------------|--------|-------|
| `jina` | No (free) | ✅ Working | 0.95 |
| `firecrawl` | `FIRECRAWL_API_KEY` | ✅ Working | 0.95 |
| `llms_txt` | No (free) | ✅ Working (if available) | varies |

## Cascade Mode Debug Trace

### How Cascade Works

```bash
# From repo root
cd cli && RUST_LOG=do_wdr_lib=trace ./target/release/do-wdr resolve "rust web frameworks"
```

**Output:**
```
DEBUG do_wdr_lib::resolver: Planned 5 providers for query: ["exa_mcp", "exa", "tavily", "duckduckgo", "mistral_websearch"]
TRACE do_wdr_lib::resolver: Trying provider 0: exa_mcp (paid=false)
TRACE do_wdr_lib::resolver: Provider exa_mcp returned in 1075ms: 5 results
DEBUG do_wdr_lib::resolver: Provider exa_mcp quality: score=0.85, acceptable=true, content_len=1390
```

### Cascade Order (Query)

1. **exa_mcp** (free, no key) - First tried, succeeds if quality >= 0.65
2. **exa** (paid, requires `EXA_API_KEY`) - Skipped if not configured
3. **tavily** (paid, requires `TAVILY_API_KEY`)
4. **duckduckgo** (free, no key) - Uses Jina Reader proxy
5. **mistral_websearch** (paid, requires `MISTRAL_API_KEY`)

### Cascade Order (URL)

1. **llms_txt** (free) - Checks for `/llms.txt` on the domain
2. **jina** (free) - Uses `r.jina.ai` reader
3. **firecrawl** (paid, requires `FIRECRAWL_API_KEY`)
4. **direct_fetch** (free) - Direct HTTP fetch
5. **mistral_browser** (paid, requires `MISTRAL_API_KEY`)

## DuckDuckGo Implementation Details

### Problem
DuckDuckGo HTML endpoint blocks automated requests with CAPTCHA:
```
<div class="anomaly-modal__title">Unfortunately, bots use DuckDuckGo too.</div>
```

### Solution
Use Jina Reader as a proxy to bypass CAPTCHA:

```
Original URL:  https://html.duckduckgo.com/html/?q=rust+async
Proxy URL:     https://r.jina.ai/https://html.duckduckgo.com/html/?q=rust+async
```

### Debug Trace

```bash
# From repo root
cd cli && RUST_LOG=trace ./target/release/do-wdr resolve "rust web frameworks" --provider duckduckgo
```

**Output:**
```
DEBUG reqwest::connect: starting new connection: https://r.jina.ai/
DEBUG hyper_util::client::legacy::connect::http: connecting to 104.26.11.242:443
DEBUG hyper_util::client::legacy::connect::http: connected to 104.26.11.242:443
```

### How It Works

1. CLI constructs DDG HTML URL: `https://html.duckduckgo.com/html/?q=QUERY`
2. Prepends Jina Reader URL: `https://r.jina.ai/`
3. Jina fetches DDG and converts to markdown
4. CLI parses markdown for results:
   - Looks for `## [Title](URL)` headings
   - Extracts URLs from DDG redirect links (`uddg=` parameter)
   - Decodes URL-encoded redirect URLs

## Single Provider Mode

Use `--provider` flag to test a specific provider:

```bash
# From cli directory
cd cli && ./target/release/do-wdr resolve "query" --provider exa_mcp
cd cli && ./target/release/do-wdr resolve "query" --provider tavily
cd cli && ./target/release/do-wdr resolve "https://url" --provider jina
```

## Cascade Mode (Default)

Without `--provider` flag, the resolver uses the cascade:

```bash
# From cli directory
cd cli && ./target/release/do-wdr resolve "rust async frameworks"
```

**Flow:**
1. Auto-detects input type (URL vs Query)
2. Plans provider order based on:
   - Profile settings (free, balanced, fast, quality)
   - API key availability
   - Provider health (circuit breaker)
3. Tries providers in order until:
   - Quality score >= threshold (default 0.65)
   - All providers exhausted

## Quality Scoring

| Signal | Penalty |
|--------|---------|
| Too short (< 500 chars) | -0.35 |
| Missing links | -0.15 |
| Duplicate-heavy | -0.25 |
| Noisy content | -0.20 |

**Threshold:** 0.65 (configurable via `--quality-threshold`)

## Logging Levels

```bash
# From cli directory
cd cli && RUST_LOG=info ./target/release/do-wdr resolve "query"

# Provider decisions
cd cli && RUST_LOG=do_wdr_lib=debug ./target/release/do-wdr resolve "query"

# Full trace (including HTTP)
cd cli && RUST_LOG=trace ./target/release/do-wdr resolve "query"

# Only resolver logic
cd cli && RUST_LOG=do_wdr_lib::resolver=trace ./target/release/do-wdr resolve "query"
```

## Test Commands Summary

```bash
# Load environment (from repo root)
set -a && source .env && set +a

# Build release binary
cd cli && cargo build --release

# Test cascade (auto-selects best provider)
./target/release/do-wdr resolve "rust web frameworks"

# Test specific query providers
./target/release/do-wdr resolve "rust async" --provider exa_mcp --json
./target/release/do-wdr resolve "rust async" --provider tavily --json
./target/release/do-wdr resolve "rust async" --provider serper --json
./target/release/do-wdr resolve "rust async" --provider duckduckgo --json
./target/release/do-wdr resolve "rust async" --provider mistral_websearch --json

# Test specific URL providers
./target/release/do-wdr resolve "https://docs.rs/tokio" --provider jina --json
./target/release/do-wdr resolve "https://docs.rs/tokio" --provider firecrawl --json

# Debug cascade decisions (from cli directory)
RUST_LOG=do_wdr_lib=trace ./target/release/do-wdr resolve "query" 2>&1 | grep -E "Trying|returned|quality"
```

## Related Files

- `cli/src/resolver.rs` - Cascade logic and quality scoring
- `cli/src/providers/duckduckgo.rs` - Jina Reader proxy implementation
- `cli/src/providers/exa_mcp.rs` - Exa MCP protocol implementation
- `plans/BUGS_AND_ISSUES.md` - Fixed bugs documentation
- `plans/PROGRESS_UPDATE.md` - Project progress