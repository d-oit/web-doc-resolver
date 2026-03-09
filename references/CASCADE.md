# Cascade Resolution Strategy

This document describes the full cascade fallback decision tree used by web-doc-resolver.

## Overview

The resolver uses a **cost-optimized cascade strategy** that prioritizes free and low-cost data sources before falling back to paid services. This ensures the best possible results while minimizing API costs.

## Query Resolution Cascade

When resolving a **search query** (not a URL), the following cascade is used:

```
Query Input
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Check Cache                                              │
│    - Return cached result if available                      │
│    - Cache TTL: 24 hours                                    │
└─────────────────────────────────────────────────────────────┘
    │ (miss)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Exa MCP Search (FREE - no API key required!)            │
│    - Uses Model Context Protocol at https://mcp.exa.ai/mcp  │
│    - JSON-RPC 2.0 over HTTP POST                            │
│    - Rate limit handling: 30s cooldown                       │
│    - On error: continue to next provider                    │
└─────────────────────────────────────────────────────────────┘
    │ (fail)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Exa SDK Search (if EXA_API_KEY set)                     │
│    - Uses highlights for token-efficient results            │
│    - Rate limit handling: 60s cooldown                      │
│    - On error: continue to next provider                    │
└─────────────────────────────────────────────────────────────┘
    │ (fail/unavailable)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Tavily Search (if TAVILY_API_KEY set)                   │
│    - Comprehensive search results                           │
│    - Rate limit handling: 60s cooldown                      │
│    - On error: continue to next provider                    │
└─────────────────────────────────────────────────────────────┘
    │ (fail/unavailable)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. DuckDuckGo Search (FREE - no API key required!)         │
│    - Completely free, no authentication needed               │
│    - Rate limit handling: 30s cooldown                      │
│    - Always available as fallback                           │
└─────────────────────────────────────────────────────────────┘
    │ (fail)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Mistral Web Search (if MISTRAL_API_KEY set)              │
│    - Uses Mistral chat API with web search                  │
│    - Free tier available                                    │
│    - Rate limit handling: 60s cooldown                      │
└─────────────────────────────────────────────────────────────┘
    │ (fail/unavailable)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Return Error                                             │
│    - source: "none"                                         │
│    - error: "No resolution method available"                │
└─────────────────────────────────────────────────────────────┘
```

## URL Resolution Cascade

When resolving a **URL**, the following cascade is used:

```
URL Input
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Check Cache                                              │
│    - Return cached result if available                      │
│    - Cache TTL: 24 hours                                    │
└─────────────────────────────────────────────────────────────┘
    │ (miss)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Check for llms.txt                                       │
│    - Probe: https://origin/llms.txt                        │
│    - If found: return structured documentation              │
│    - FREE - no API key required                             │
└─────────────────────────────────────────────────────────────┘
    │ (not found)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Firecrawl Extraction (if FIRECRAWL_API_KEY set)        │
│    - Deep content extraction with markdown output           │
│    - Rate limit handling: 60s cooldown                      │
│    - On rate limit/quota: fallback to next provider         │
│    - On auth error: return None                             │
└─────────────────────────────────────────────────────────────┘
    │ (fail/unavailable)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Direct HTTP Fetch                                        │
│    - Basic content extraction from HTML                     │
│    - FREE - no API key required                             │
└─────────────────────────────────────────────────────────────┘
    │ (fail)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Mistral Browser (if MISTRAL_API_KEY set)               │
│    - Uses Mistral agent with web browsing capability        │
│    - Free tier available                                     │
│    - Rate limit handling: 60s cooldown                      │
└─────────────────────────────────────────────────────────────┘
    │ (fail/unavailable)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. DuckDuckGo Search (fallback)                            │
│    - Search for the URL as a query                          │
│    - FREE - no API key required                             │
└─────────────────────────────────────────────────────────────┘
    │ (fail)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Return Error                                             │
│    - source: "none"                                         │
│    - error: "No resolution method available"               │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

### Error Types Detected

| Error Type | Detection Patterns | Behavior |
|------------|---------------------|----------|
| `rate_limit` | 429, "rate limit", "too many requests" | Set cooldown, skip provider |
| `auth_error` | 401, 403, "unauthorized", "forbidden", "invalid api key" | Log error, skip provider |
| `quota_exhausted` | 402, "payment", "credit", "quota", "insufficient" | Log warning, skip provider |
| `network_error` | "timeout", "connection", "network" | Log error, skip provider |
| `not_found` | 404, "not found" | Log error, skip provider |

### Rate Limit Tracking

The resolver maintains an in-memory rate limit tracker:

```python
_rate_limits: dict[str, float] = {}

def _is_rate_limited(provider: str, cooldown: int = 60) -> bool:
    # Returns True if provider is in cooldown period

def _set_rate_limit(provider: str, cooldown: int = 60):
    # Sets cooldown for provider (default 60 seconds)
```

### Provider Cooldowns

| Provider | Default Cooldown |
|----------|------------------|
| Exa MCP | 30 seconds |
| Exa SDK | 60 seconds |
| Tavily | 60 seconds |
| DuckDuckGo | 30 seconds |
| Firecrawl | 60 seconds |
| Mistral | 60 seconds |

## Caching

### Cache Implementation

- **Backend**: `diskcache` (if available), otherwise in-memory
- **Location**: `~/.cache/web-doc-resolver/`
- **TTL**: 24 hours (86400 seconds)
- **Key**: SHA-256 hash of `source:input`

### Cache Key Format

```python
def _cache_key(input_str: str, source: str) -> str:
    hash_input = f"{source}:{input_str}"
    return hashlib.sha256(hash_input.encode()).hexdigest()
```

## API Key Requirements

| Provider | Environment Variable | Required? | Free Tier? |
|----------|---------------------|-----------|------------|
| Exa MCP | None | No | Yes (always free) |
| DuckDuckGo | None | No | Yes (always free) |
| Exa SDK | `EXA_API_KEY` | No | Yes (limited) |
| Tavily | `TAVILY_API_KEY` | No | Yes (limited) |
| Firecrawl | `FIRECRAWL_API_KEY` | No | Yes (limited) |
| Mistral | `MISTRAL_API_KEY` | No | Yes (limited) |

## Best Practices

### For Query Resolution

1. **Exa MCP is the primary**: Free, no API key required, high-quality results
2. **DuckDuckGo as backup baseline**: Always works without API keys
3. **Add Exa SDK for enhanced results**: Token-efficient highlights with API key
4. **Add Tavily for comprehensive search**: More detailed results
5. **Add Mistral for AI-powered search**: Best quality results

### For URL Resolution

1. **llms.txt is always checked first**: Free and structured
2. **Firecrawl for complex sites**: Best extraction quality
3. **Direct HTTP fetch as fallback**: Works for most sites
4. **Mistral as final fallback**: Works when other methods fail

### Cost Optimization

1. **Use caching**: Reduces API calls significantly
2. **Set rate limits**: Prevents quota exhaustion
3. **Cascade properly**: Free providers first
4. **Monitor logs**: Track which providers are being used

## Example Output

### Successful Query Resolution

```json
{
  "source": "exa_mcp",
  "query": "Rust agent frameworks",
  "content": "# Search Results for: Rust agent frameworks\n\n## Tokio\n\nTokio is a popular asynchronous runtime...\n\nSource: https://tokio.rs\n\n---\n\n## Actix\n\nActix is a powerful web framework...",
  "validated_links": ["https://tokio.rs", "https://actix.rs"]
}
```

### Successful URL Resolution

```json
{
  "source": "llms.txt",
  "url": "https://example.com/docs",
  "content": "# Documentation\n\n## Getting Started\n...",
  "validated_links": []
}
```

### Error Response

```json
{
  "source": "none",
  "query": "search query",
  "content": "# Unable to resolve query: search query\n\nAll search methods failed...",
  "error": "No resolution method available"
}
```

## Version History

- **v1.2.0**: Added Exa MCP (free, no API key) as primary search provider
- **v1.1.0**: Added DuckDuckGo free fallback, improved error handling
- **v1.0.0**: Initial cascade implementation with Exa, Tavily, Firecrawl, Mistral