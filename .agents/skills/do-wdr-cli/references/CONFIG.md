# WDR CLI Configuration Reference

Complete reference for do-wdr CLI configuration options.

## Configuration Sources

Configuration is loaded in the following order (later overrides earlier):

1. **Hardcoded defaults**
2. **Config file** (`cli/config.toml`)
3. **Environment variables**
4. **CLI arguments**

## Config File Location

Default: `cli/config.toml`

Override with: `DO_WDR_CONFIG_FILE` environment variable

## Config File Structure

```toml
# cli/config.toml

[defaults]
max_chars = 8000
min_chars = 200
profile = "balanced"
quality_threshold = 0.7
log_level = "info"

[providers]
# Provider enable/disable
exa_mcp = true
exa_sdk = true
tavily = true
serper = true
duckduckgo = true
mistral_websearch = true
llms_txt = true
jina = true
firecrawl = true
direct_fetch = true
mistral_browser = true
docling = false
ocr = false

# Provider order (comma-separated)
providers_order = ["exa_mcp", "exa_sdk", "tavily", "serper", "duckduckgo"]

# Skip providers (comma-separated)
skip_providers = []

[providers.exa_sdk]
timeout = 10
max_retries = 3

[providers.tavily]
timeout = 15
max_results = 5

[providers.firecrawl]
timeout = 30
wait_for_js = true

[providers.mistral]
model = "mistral-small-latest"
temperature = 0.7

[cache]
enabled = true
ttl_seconds = 3600
max_entries = 1000

[network]
timeout = 30
connect_timeout = 10
max_connections = 100

[output]
colorize = true
progress = true

[routing]
enabled = true
memory_size = 100
```

## Environment Variables

### Provider API Keys

| Variable | Provider | Required | Description |
|----------|----------|----------|-------------|
| `EXA_API_KEY` | exa_sdk | No | Exa SDK API key |
| `TAVILY_API_KEY` | tavily | No | Tavily API key |
| `SERPER_API_KEY` | serper | No | Serper API key |
| `FIRECRAWL_API_KEY` | firecrawl | No | Firecrawl API key |
| `MISTRAL_API_KEY` | mistral_* | No | Mistral API key |

### Runtime Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DO_WDR_LOG_LEVEL` | Log level | `info` |
| `DO_WDR_CONFIG_FILE` | Config file path | `cli/config.toml` |
| `DO_WDR_CACHE_DIR` | Cache directory | `.cache/do-wdr` |

## CLI Options Override

CLI arguments override all other configuration:

```bash
# Override max chars
do-wdr resolve "query" --max-chars 10000

# Override profile
do-wdr resolve "query" --profile quality

# Skip providers
do-wdr resolve "query" --skip tavily

# Custom provider order
do-wdr resolve "query" --providers-order duckduckgo,exa_mcp
```

## Execution Profiles

Profiles provide preset configurations:

### free

Uses only free providers:
- exa_mcp, duckduckgo, llms_txt, jina, direct_fetch

```bash
do-wdr resolve "query" --profile free
```

### balanced

Balances speed and quality:
- Uses all available providers
- Default profile

```bash
do-wdr resolve "query" --profile balanced
```

### fast

Prioritizes speed:
- Fewer provider attempts
- Lower timeout values
- Skip slow providers

```bash
do-wdr resolve "query" --profile fast
```

### quality

Prioritizes quality:
- More provider attempts
- Higher quality thresholds
- Use synthesis

```bash
do-wdr resolve "query" --profile quality
```

## Quality Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `quality_threshold` | Minimum quality score (0.0-1.0) | 0.7 |
| `max_provider_attempts` | Max providers to try | unlimited |
| `max_paid_attempts` | Max paid providers to try | unlimited |
| `max_total_latency_ms` | Max total latency | unlimited |

## Cache Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `enabled` | Enable semantic cache | true |
| `ttl_seconds` | Cache entry TTL | 3600 |
| `max_entries` | Max cache entries | 1000 |

## Network Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `timeout` | Request timeout (seconds) | 30 |
| `connect_timeout` | Connection timeout (seconds) | 10 |
| `max_connections` | Max concurrent connections | 100 |

## Routing Memory

The routing memory learns which providers work best for different types of queries:

| Setting | Description | Default |
|---------|-------------|---------|
| `enabled` | Enable routing memory | true |
| `memory_size` | Max entries to remember | 100 |
| `disable_routing_memory` | CLI flag to disable | false |

```bash
# Disable routing memory
do-wdr resolve "query" --disable-routing-memory
```

## Examples

### Minimal Config

```toml
[defaults]
max_chars = 8000
min_chars = 200
```

### Production Config

```toml
[defaults]
max_chars = 10000
min_chars = 500
profile = "quality"
quality_threshold = 0.8

[providers]
exa_mcp = true
exa_sdk = true
tavily = true
duckduckgo = true
llms_txt = true
jina = true

[cache]
enabled = true
ttl_seconds = 7200
max_entries = 5000

[network]
timeout = 60
max_connections = 200
```

### Development Config

```toml
[defaults]
max_chars = 5000
profile = "free"

[providers]
# Disable paid providers
exa_sdk = false
tavily = false
firecrawl = false
mistral_websearch = false
mistral_browser = false

[cache]
enabled = false

[output]
colorize = true
progress = true
```

## Validation

The CLI validates configuration at startup:

- Profile must be valid (free, balanced, fast, quality)
- Quality threshold must be 0.0-1.0
- Timeouts must be positive
- Max values must be positive

Invalid configuration will result in an error message with details.
