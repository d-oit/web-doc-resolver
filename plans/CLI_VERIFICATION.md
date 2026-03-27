# CLI Verification Report

**Date**: 2026-03-27
**CLI Version**: 0.1.0
**Binary**: `cli/target/release/do-wdr`

## Summary

The CLI has significant discrepancies between the documentation and actual implementation. The most critical issue is that the documentation describes a positional argument interface while the actual CLI uses a subcommand-based interface.

---

## Actual CLI Structure (Verified)

```
Usage: do-wdr [OPTIONS] <COMMAND>

Commands:
  resolve      Resolve a URL or query to markdown documentation
  providers    List available providers
  config       Show configuration
  cache-stats  Show cache statistics

Options:
  -v, --verbose...  Enable verbose logging (-v, -vv, -vvv)
  -h, --help        Print help
  -V, --version     Print version
```

### resolve subcommand

```
Usage: do-wdr resolve [OPTIONS] <INPUT>

Arguments:
  <INPUT>  URL or query to resolve

Options:
  -o, --output <OUTPUT>                    Output file (stdout if not specified)
  -p, --provider <PROVIDER>                Provider to use (auto-detect if not specified)
      --skip <SKIP>                        Skip specific providers (comma-separated)
      --providers-order <PROVIDERS_ORDER>  Custom provider order (comma-separated)
      --max-chars <MAX_CHARS>              Maximum characters in output
      --min-chars <MIN_CHARS>              Minimum characters for valid content
      --profile <PROFILE>                  Execution profile (free, balanced, fast, quality)
      --json                              Output as JSON
      --metrics-json                      Output metrics as JSON
      --metrics-file <METRICS_FILE>        Save metrics to file
      --skip-cache                        Skip semantic cache
      --synthesize                        Synthesize multiple results using AI
      --quality-threshold <QUALITY_THRESHOLD>    Quality threshold for content scoring
      --max-provider-attempts <MAX_PROVIDER_ATTEMPTS>  Maximum provider attempts
      --max-paid-attempts <MAX_PAID_ATTEMPTS>    Maximum paid provider attempts
      --max-total-latency-ms <MAX_TOTAL_LATENCY_MS>  Maximum total latency in milliseconds
      --disable-routing-memory            Disable routing memory
  -h, --help                              Print help
```

---

## Documentation Discrepancies

### 1. Critical: Command Structure Change

| Documentation | Actual CLI |
|---------------|------------|
| `do-wdr "query"` | `do-wdr resolve "query"` |
| `do-wdr "https://example.com"` | `do-wdr resolve "https://example.com"` |
| `do-wdr --help` | `do-wdr --help` (works) but subcommands required for resolve |

**Impact**: All examples in documentation that use positional arguments are incorrect.

**Files affected**:
- `.agents/skills/do-web-doc-resolver/references/RUST_CLI.md`
- `.agents/skills/do-web-doc-resolver/references/CLI.md`
- `.agents/skills/do-wdr-cli/SKILL.md`
- `.agents/skills/do-wdr-cli/references/COMMANDS.md`

### 2. Missing Short Options

Documentation shows short options that don't exist in the CLI:

| Option | Documentation | Actual CLI |
|--------|---------------|------------|
| `--skip` | `-s, --skip` | `--skip` only (no short form) |
| `--max-chars` | `-m, --max-chars` | `--max-chars` only (no short form) |
| `--json` | `-j, --json` | `--json` only (no short form) |
| `--timeout` | `-t, --timeout` | Does not exist |
| `--verbose` | `-v` (standalone) | `-v, --verbose...` (count-based, correct) |

**Correct short options**:
- `-o` for `--output`
- `-p` for `--provider`
- `-v` for `--verbose` (supports `-v`, `-vv`, `-vvv`)

### 3. Missing Features

| Feature | Documentation | Actual CLI |
|---------|---------------|------------|
| `--deep-research` | Mentioned in task | Does not exist |
| `--timeout <SECS>` | Documented | Does not exist |
| `--log-level` | Documented | Does not exist (verbosity only via `-v` count) |
| `completions` command | Documented for bash/zsh/fish | Does not exist |

### 4. Provider Name Differences

| Documentation | Actual CLI |
|---------------|------------|
| `exa_sdk` | `exa` |
| `exa_mcp` | `exa_mcp` (correct) |
| `direct_fetch` | `direct_fetch` (correct) |
| `mistral_websearch` | `mistral_websearch` (correct) |

### 5. Actual Providers List

```
Query providers:
  - exa_mcp: Exa MCP (free, no API key required)
  - exa: Exa SDK (requires EXA_API_KEY)
  - tavily: Tavily search (requires TAVILY_API_KEY)
  - duckduckgo: DuckDuckGo (free, no API key required)
  - mistral_websearch: Mistral web search (requires MISTRAL_API_KEY)

URL providers:
  - llms_txt: Check for llms.txt (free)
  - jina: Jina Reader (free)
  - firecrawl: Firecrawl extraction (requires FIRECRAWL_API_KEY)
  - direct_fetch: Direct HTTP fetch (free)
  - mistral_browser: Mistral browser (requires MISTRAL_API_KEY)
```

### 6. Exit Codes

Documentation claims exit codes 0-6, but actual implementation only uses:
- 0: Success
- 1: Failure (all errors)

**Not implemented**: Network error (3), Rate limit (4), Auth error (5), Cache error (6)

---

## Correct CLI Usage Examples

### Basic Resolution
```bash
# Resolve a URL
do-wdr resolve "https://docs.rs/tokio/latest/tokio/"

# Resolve a query
do-wdr resolve "Rust async runtime comparison"

# JSON output
do-wdr resolve "Python web frameworks" --json
```

### Provider Selection
```bash
# Use specific provider
do-wdr resolve "query" --provider exa_mcp

# Skip providers
do-wdr resolve "query" --skip tavily,serper

# Custom provider order
do-wdr resolve "query" --providers-order duckduckgo,exa_mcp,tavily
```

### Output Options
```bash
# Save to file
do-wdr resolve "https://example.com" --output result.md

# JSON output to file
do-wdr resolve "query" --json --output results.json

# Include metrics
do-wdr resolve "query" --json --metrics-json

# Save metrics to file
do-wdr resolve "query" --metrics-file metrics.json
```

### Performance Profiles
```bash
# Free tier only (no API keys needed)
do-wdr resolve "query" --profile free

# Balanced (default)
do-wdr resolve "query" --profile balanced

# Fast results
do-wdr resolve "query" --profile fast

# High quality results
do-wdr resolve "query" --profile quality
```

### Advanced Options
```bash
# Skip semantic cache
do-wdr resolve "query" --skip-cache

# Synthesize results
do-wdr resolve "query" --synthesize

# Quality threshold
do-wdr resolve "query" --quality-threshold 0.8

# Verbose logging
do-wdr -v resolve "query"        # debug
do-wdr -vv resolve "query"       # trace
```

### Utility Commands
```bash
# List providers
do-wdr providers

# Show config
do-wdr config

# Show cache stats
do-wdr cache-stats

# Version
do-wdr --version
```

---

## Documentation Files Requiring Updates

### Priority 1 (Critical)

1. **`.agents/skills/do-web-doc-resolver/references/RUST_CLI.md`**
   - Lines 74-85: Update basic usage to use `resolve` subcommand
   - Lines 89-106: Remove short options that don't exist (`-s`, `-m`, `-j`, `-t`)
   - Lines 109-128: Update examples to use subcommand syntax

2. **`.agents/skills/do-web-doc-resolver/references/CLI.md`**
   - Lines 69-93: Update Rust CLI section to use subcommand syntax
   - Lines 97-106: Update options table to remove non-existent short options

3. **`.agents/skills/do-wdr-cli/SKILL.md`**
   - Lines 42-67: Update command synopsis to reflect subcommand structure
   - Lines 92-147: Update examples to use `resolve` subcommand

4. **`.agents/skills/do-wdr-cli/references/COMMANDS.md`**
   - Lines 13: Remove invalid `-` in help output table
   - Lines 223-237: Remove `completions` command section (not implemented)

### Priority 2 (Moderate)

5. **`.agents/skills/do-wdr-cli/references/COMMANDS.md`**
   - Lines 201-211: Update exit codes to reflect actual implementation (only 0 and 1)

6. **`.agents/skills/do-wdr-cli/SKILL.md`**
   - Lines 166-178: Update provider table to use correct provider names (`exa` not `exa_sdk`)

### Priority 3 (Minor)

7. **`AGENTS.md`**
   - Lines 74-85: Verify CLI examples are correct
   - The AGENTS.md examples may already use `scripts/resolve.py` which is Python, not Rust CLI

---

## Recommendations

1. **Update all documentation** to use the subcommand syntax (`do-wdr resolve <input>`)

2. **Remove documentation for unimplemented features**:
   - `completions` command
   - `-t, --timeout` option
   - `--log-level` option
   - Exit codes 2-6

3. **Fix provider naming**:
   - Use `exa` instead of `exa_sdk`

4. **Add missing documentation**:
   - `--synthesize` option (exists but not well documented)
   - `--metrics-json` and `--metrics-file` options
   - `--disable-routing-memory` option

5. **Consider implementing** (if needed):
   - `completions` command for shell integration
   - `--timeout` option for request timeout control
   - Specific exit codes for different error types