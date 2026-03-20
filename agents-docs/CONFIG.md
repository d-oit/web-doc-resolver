# Configuration Reference

Layered configuration system for `web-doc-resolver` (Python skill + Rust CLI).

## Configuration Layers (Priority: High to Low)

1. **CLI flags** — highest priority, override everything
2. **Environment variables** — override config file
3. **`config.toml`** — project-level or user-level file
4. **Built-in defaults** — lowest priority

## Environment Variables

### API Keys

| Variable | Provider | Required |
|----------|----------|----------|
| `EXA_API_KEY` | Exa Search API | Only for `exa` provider |
| `TAVILY_API_KEY` | Tavily Search API | Only for `tavily` provider |
| `SERPER_API_KEY` | Serper Google Search | Only for `serper` provider |
| `MISTRAL_API_KEY` | Mistral OCR API | Only for `mistral` provider |
| `FIRECRAWL_API_KEY` | Firecrawl Extraction | Only for `firecrawl` provider |

### Rust CLI Env Vars

| Variable | Description | Default |
|----------|-------------|--------|
| `WDR_PROVIDERS_ORDER` | Comma-separated cascade order | Built-in default |
| `WDR_SKIP` | Comma-separated providers to skip | (none) |
| `WDR_MIN_CHARS` | Min content chars threshold | `200` |
| `WDR_MAX_CHARS` | Max output chars | `8000` |
| `WDR_LOG_LEVEL` | Log level (error/warn/info/debug/trace) | `info` |
| `WDR_CONFIG` | Path to config.toml | auto-discover |
| `WDR_PROFILE` | Execution profile (free/balanced/fast/quality) | `balanced` |
| `WDR_QUALITY_THRESHOLD` | Min quality score | profile-dependent |
| `WDR_MAX_PROVIDER_ATTEMPTS` | Max cascade depth | profile-dependent |
| `WDR_MAX_PAID_ATTEMPTS` | Max paid provider calls | profile-dependent |
| `WDR_MAX_TOTAL_LATENCY_MS` | Total latency ceiling (ms) | profile-dependent |
| `WDR_SEMANTIC_CACHE__ENABLED` | Enable semantic cache | `false` |
| `WDR_SEMANTIC_CACHE__PATH` | Cache database path | `.wdr_cache` |
| `WDR_SEMANTIC_CACHE__THRESHOLD` | Similarity threshold | `0.85` |
| `WDR_SEMANTIC_CACHE__MAX_ENTRIES` | Max cache entries | `10000` |

## config.toml Schema

Default search paths:
1. `./config.toml` (current directory)
2. `~/.config/wdr/config.toml` (user config)
3. `/etc/wdr/config.toml` (system config)

```toml
# config.toml — full example

[resolve]
# Default cascade order (comma-separated)
providers_order = "exa_mcp,llms_txt,direct_fetch,jina,exa,tavily,mistral,duckduckgo"

# Providers to always skip
skip = []

# Minimum chars for a valid result
min_chars = 200

[logging]
# Log level: error | warn | info | debug | trace
level = "info"

# Emit JSON structured logs to stderr
json = false

[providers]
# Per-provider overrides

[providers.jina]
# Jina base URL override (e.g. self-hosted)
base_url = "https://r.jina.ai"

[providers.exa]
# Max results to request
max_results = 5

[providers.tavily]
# Search depth: "basic" | "advanced"
search_depth = "basic"

[providers.mistral]
# Model to use for OCR
model = "mistral-ocr-latest"
```

## Default Values

| Setting | Default |
|---------|---------|
| `providers_order` | `exa_mcp,llms_txt,direct_fetch,jina,exa,tavily,mistral,duckduckgo` |
| `skip` | `[]` |
| `min_chars` | `200` |
| `log.level` | `info` |
| `log.json` | `false` |

## Generating a Default Config

```bash
# Rust CLI
wdr config init
# Writes config.toml to current directory

# View effective (merged) config
wdr config show
```

## Python Skill Config

The Python skill reads only environment variables (no config file).
Pass flags directly on the command line or set env vars before calling:

```bash
export EXA_API_KEY=xxx
export TAVILY_API_KEY=yyy
python -m scripts.resolve "query" --skip mistral
```
