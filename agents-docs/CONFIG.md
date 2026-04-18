# Configuration Guide

This guide covers the environment variables and configuration files for do-web-doc-resolver.

## Environment Variables (all optional)

| Variable | Provider | Notes |
|---|---|---|
| `EXA_API_KEY` | Exa SDK | Exa MCP is free and runs first |
| `TAVILY_API_KEY` | Tavily | Optional comprehensive search |
| `SERPER_API_KEY` | Serper | Google search (2500 free credits) |
| `FIRECRAWL_API_KEY` | Firecrawl | Optional deep extraction |
| `MISTRAL_API_KEY` | Mistral | Optional AI-powered fallback |

Exa MCP, Jina Reader, DuckDuckGo, and direct fetch are always available — **no API key required**.

### Resolver Settings

| Variable | Default | Description |
|---|---|---|
| `DO_WDR_LOG_LEVEL` | `INFO` | Logging verbosity (DEBUG, INFO, WARNING, ERROR) |
| `WEB_RESOLVER_MAX_CHARS` | `8000` | Maximum characters in output content |
| `WEB_RESOLVER_MIN_CHARS` | `200` | Minimum content length for a successful result |
| `WEB_RESOLVER_TIMEOUT` | `30` | Default timeout in seconds |
| `WEB_RESOLVER_CACHE_DIR` | `~/.cache/do-web-doc-resolver` | Directory for persistent cache |
| `WEB_RESOLVER_CACHE_TTL` | `86400` | Cache TTL in seconds (default 24h) |

## Config File (Rust CLI)

The Rust CLI looks for `config.toml` in:
1. `~/.config/do-wdr/config.toml`
2. `./config.toml`

### Example config.toml

```toml
max_chars = 8000
profile = "balanced"
skip_providers = ["exa"]

[api_keys]
tavily = "your-key-here"
serper = "your-key-here"
```

## Detailed Reference

See [`.agents/skills/do-web-doc-resolver/references/CONFIG.md`](../.agents/skills/do-web-doc-resolver/references/CONFIG.md) for full config reference.
