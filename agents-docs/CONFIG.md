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
| `WEB_RESOLVER_CACHE_TTL` | `86400` | Global fallback cache TTL in seconds |
| `DO_WDR_CACHE_TTL_FIRECRAWL` | `21600` | Firecrawl specific TTL |
| `DO_WDR_CACHE_TTL_EXA` | `14400` | Exa specific TTL |
| `DO_WDR_CACHE_TTL_JINA` | `7200` | Jina specific TTL |
| `DO_WDR_CACHE_TTL_DUCKDUCKGO` | `3600` | DuckDuckGo specific TTL |
| `DO_WDR_CACHE_TTL_LLMS_TXT` | `28800` | LLMS_TXT specific TTL |
| `DO_WDR_CACHE_TTL_SYNTHESIS` | `43200` | Synthesis specific TTL |
| `DO_WDR_CACHE_TTL_DEFAULT` | `3600` | Tiered fallback TTL |

## Config File (Rust CLI)

The Rust CLI looks for `config.toml` in:
1. `~/.config/do-wdr/config.toml`
2. `./config.toml`

### Example config.toml

```toml
max_chars = 8000
profile = "balanced"
skip_providers = ["exa"]

[cache.ttl]
firecrawl = 21600   # 6 hours
exa = 14400        # 4 hours
jina = 7200         # 2 hours
duckduckgo = 3600   # 1 hour
llms_txt = 28800    # 8 hours
synthesis = 43200   # 12 hours
default = 3600      # fallback for any unlisted provider

[api_keys]
tavily = "your-key-here"
serper = "your-key-here"
```

## Detailed Reference

See [`.agents/skills/do-web-doc-resolver/references/CONFIG.md`](../.agents/skills/do-web-doc-resolver/references/CONFIG.md) for full config reference.
