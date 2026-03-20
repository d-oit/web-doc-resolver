# CLI Usage Reference

Complete usage reference for both the Python skill and the Rust `wdr` CLI.

## Python Skill (scripts/resolve.py)

### Synopsis

```bash
# Recommended (works with package imports):
python -m scripts.resolve <query_or_url> [OPTIONS]

# Installed via pip:
wdr <query_or_url> [OPTIONS]

# Legacy (only works if scripts/ has no package imports):
python scripts/resolve.py <query_or_url> [OPTIONS]
```

### Arguments

| Argument | Description |
|----------|------------|
| `query_or_url` | Search query string or full URL to resolve |

### Options

| Option | Description |
|--------|------------|
| `--skip <provider>` | Skip a provider (repeatable) |
| `--provider <name>` | Use only this provider |
| `--providers-order <list>` | Comma-separated custom cascade order |
| `--min-chars <n>` | Minimum chars for valid result (default: 200) |
| `--json` | Output result as JSON |

### Examples

```bash
# Basic query
python -m scripts.resolve "rust async book"

# Resolve a URL
python -m scripts.resolve "https://example.com"

# Skip paid providers
python -m scripts.resolve "query" --skip exa --skip tavily --skip mistral

# Skip Exa MCP, use SDK path
python -m scripts.resolve "query" --skip exa_mcp

# Custom provider order
python -m scripts.resolve "query" --providers-order "llms_txt,jina,direct_fetch"

# Single provider
python -m scripts.resolve "https://example.com" --provider jina

# JSON output
python -m scripts.resolve "query" --json
```

## Rust CLI (wdr)

### Synopsis

```bash
wdr resolve [OPTIONS] <INPUT>
wdr providers
wdr config
wdr cache-stats
```

### Global Options

| Flag | Short | Description |
|------|-------|------------|
| `--verbose` | `-v` | Increase verbosity (-v, -vv, -vvv) |
| `--version` | | Print version |

### Resolve Options

| Flag | Short | Description |
|------|-------|------------|
| `--output` | `-o` | Write result to file |
| `--provider` | `-p` | Force a single provider |
| `--skip` | | Comma-separated providers to skip |
| `--providers-order` | | Override cascade order |
| `--max-chars` | | Max output characters (default: 8000) |
| `--min-chars` | | Min chars for valid content (default: 200) |
| `--profile` | | Execution profile: free/balanced/fast/quality |
| `--json` | | JSON output to stdout |
| `--metrics-json` | | Print metrics as JSON |
| `--metrics-file` | | Save metrics JSON to file |
| `--skip-cache` | | Bypass semantic cache |
| `--synthesize` | | Aggregate results via AI synthesis |
| `--quality-threshold` | | Min quality score |
| `--max-provider-attempts` | | Limit cascade depth |
| `--max-paid-attempts` | | Limit paid provider calls |
| `--max-total-latency-ms` | | Total latency ceiling (ms) |
| `--disable-routing-memory` | | Ignore learned provider rankings |

### Subcommands

| Subcommand | Description |
|------------|------------|
| `resolve <input>` | Resolve a query or URL (primary command) |
| `providers` | List available providers and their status |
| `config` | Print current effective configuration |
| `cache-stats` | Show semantic cache statistics |

### Examples

```bash
# Basic query
wdr resolve "rust async book"

# Resolve URL
wdr resolve "https://example.com"

# Output as JSON
wdr resolve "query" --json

# Save to file
wdr resolve "https://example.com" -o result.md

# Use profile
wdr resolve "query" --profile free

# Skip providers
wdr resolve "query" --skip exa_mcp,exa

# AI synthesis
wdr resolve "query" --synthesize

# Metrics
wdr resolve "query" --metrics-json

# List providers
wdr providers

# Show config
wdr config
```

## Output Format

### Default (plain text)
Resolved content is printed to **stdout**.
Log messages are printed to **stderr**.

### JSON (`--json`)

```json
{
  "source": "jina",
  "url": "https://example.com",
  "content": "...",
  "chars": 1234
}
```

### Error JSON (all providers failed)

```json
{
  "source": "none",
  "error": "No resolution method available"
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | All providers failed |
| 2 | Configuration error |
| 3 | Invalid arguments |
