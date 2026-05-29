# Configuration

Configuration is loaded from (in order):

1. CLI arguments
2. Environment variables
3. `cli/config.toml`
4. Defaults

## Environment Variables

```bash
# Provider API keys (all optional)
export EXA_API_KEY="your_key"
export TAVILY_API_KEY="your_key"
export SERPER_API_KEY="your_key"
export FIRECRAWL_API_KEY="your_key"
export MISTRAL_API_KEY="your_key"
```

## Resolver Settings

```bash
# Maximum output characters
export WEB_RESOLVER_MAX_CHARS=8000

# Minimum content length
export WEB_RESOLVER_MIN_CHARS=200

# Request timeout in seconds
export WEB_RESOLVER_TIMEOUT=30
```

## Config File

Create `cli/config.toml` for persistent settings:

```toml
[defaults]
profile = "free"
max_chars = 8000

[providers]
exa_mcp = { enabled = true }
tavily = { enabled = false }
```

## Verbose Logging

Use `-v` flags for debugging:

```bash
# Info level
do-wdr resolve "query" -v

# Debug level
do-wdr resolve "query" -vv

# Trace level
do-wdr resolve "query" -vvv
```
