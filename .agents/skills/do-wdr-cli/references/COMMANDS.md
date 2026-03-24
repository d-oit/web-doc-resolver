# WDR CLI Commands Reference

Complete reference for all do-wdr CLI commands and options.

## Global Options

These options apply to all commands:

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Increase verbosity (use multiple times for more) |
| `-V, --version` | Print version information |
 `-h, --help` | Print help information |

## resolve Command

Resolve a URL or query to markdown documentation.

### Synopsis

```bash
do-wdr resolve <INPUT> [OPTIONS]
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `<INPUT>` | URL or query string to resolve | Yes |

### Options

#### Output Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <FILE>` | Write output to file | stdout |
| `--json` | Output as JSON | false |
| `--metrics-json` | Output metrics as JSON | false |
| `--metrics-file <FILE>` | Save metrics to file | none |

#### Provider Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --provider <PROVIDER>` | Use specific provider | auto-detect |
| `--skip <PROVIDERS>` | Skip providers (comma-separated) | none |
| `--providers-order <PROVIDERS>` | Custom provider order | default order |

#### Content Options

| Option | Description | Default |
|--------|-------------|---------|
| `--max-chars <N>` | Maximum output characters | 8000 |
| `--min-chars <N>` | Minimum content length | 200 |

#### Profile Options

| Option | Description | Default |
|--------|-------------|---------|
| `--profile <PROFILE>` | Execution profile | balanced |

Available profiles: `free`, `balanced`, `fast`, `quality`

#### Advanced Options

| Option | Description | Default |
|--------|-------------|---------|
| `--skip-cache` | Skip semantic cache | false |
| `--synthesize` | Synthesize multiple results | false |
| `--quality-threshold <F>` | Quality threshold | none |
| `--max-provider-attempts <N>` | Maximum provider attempts | none |
| `--max-paid-attempts <N>` | Maximum paid attempts | none |
| `--max-total-latency-ms <MS>` | Maximum total latency | none |
| `--disable-routing-memory` | Disable routing memory | false |

### Examples

```bash
# Basic URL resolution
do-wdr resolve "https://docs.rs/tokio/latest/tokio/"

# Query with JSON output
do-wdr resolve "Rust async frameworks" --json

# Use specific provider
do-wdr resolve "query" --provider exa_mcp

# Skip paid providers
do-wdr resolve "query" --skip tavily,serper,firecrawl

# Save to file with metrics
do-wdr resolve "https://example.com" --output docs.md --metrics-file metrics.json

# Free profile (no API keys needed)
do-wdr resolve "query" --profile free

# Synthesize results with AI
do-wdr resolve "query" --synthesize
```

## providers Command

List all available providers and their status.

### Synopsis

```bash
do-wdr providers
```

### Output

Displays a table of providers with:
- Provider name
- Type (query/url)
- Free/paid status
- Availability (based on API keys)
- Description

### Example Output

```
Provider           Type    Free    Available  Description
────────────────────────────────────────────────────────────────────
exa_mcp            Query   Yes     Yes        Exa MCP (free, no key)
exa_sdk            Query   No      No         Exa SDK (requires API key)
tavily             Query   No      Yes        Tavily comprehensive search
duckduckgo         Query   Yes     Yes        DuckDuckGo search
llms_txt           URL     Yes     Yes        llms.txt structured docs
jina               URL     Yes     Yes        Jina Reader
firecrawl          URL     No      No         Firecrawl extraction
direct_fetch       URL     Yes     Yes        Direct HTML fetch
```

## config Command

Show current configuration.

### Synopsis

```bash
do-wdr config
```

### Output

Displays the current configuration including:
- Default settings
- Provider configuration
- API key status (masked)
- Cache settings
- Network settings

### Example Output

```
Configuration:
─────────────────────────────────────────────────
max_chars:           8000
min_chars:           200
profile:             balanced
quality_threshold:   0.7

Providers:
─────────────────────────────────────────────────
exa_mcp:             enabled (free)
exa_sdk:             disabled (no API key)
tavily:              enabled (has API key)
duckduckgo:          enabled (free)

Cache:
─────────────────────────────────────────────────
enabled:             true
ttl_seconds:         3600
```

## cache-stats Command

Show semantic cache statistics.

### Synopsis

```bash
do-wdr cache-stats
```

### Output

Displays cache statistics including:
- Total entries
- Hit rate
- Memory usage
- Oldest/newest entries

### Prerequisites

Requires semantic cache to be enabled (feature `semantic-cache`).

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Network error |
| 4 | Rate limit exceeded |
| 5 | Authentication error |
| 6 | Cache error |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `EXA_API_KEY` | Exa SDK API key |
| `TAVILY_API_KEY` | Tavily API key |
| `SERPER_API_KEY` | Serper API key |
| `FIRECRAWL_API_KEY` | Firecrawl API key |
| `MISTRAL_API_KEY` | Mistral API key |
| `DO_WDR_LOG_LEVEL` | Log level (trace, debug, info, warn, error) |
| `DO_WDR_CONFIG_FILE` | Path to config file |

## Shell Completions

Generate shell completions:

```bash
# Bash
do-wdr completions bash > ~/.bash_completion

# Zsh
do-wdr completions zsh > ~/.zsh/_do-wdr

# Fish
do-wdr completions fish > ~/.config/fish/completions/do-wdr.fish
```
