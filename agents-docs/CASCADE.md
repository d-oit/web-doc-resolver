# Cascade Decision Trees

> Part of [`agents-docs/`](../agents-docs/). Back to [`AGENTS.md`](../AGENTS.md).

The resolver auto-detects whether input is a URL or a query, then runs the appropriate free-first cascade.

## Query Resolution Cascade

```
Query Input
    |
    v
1. Exa MCP (FREE - no API key, JSON-RPC 2.0 over HTTPS)
   https://mcp.exa.ai/mcp
   Rate limit: 30s cooldown on 429
   On error: continue to next
    |
    v (fail)
2. Exa SDK (if EXA_API_KEY set)
   Uses highlights for token-efficient results
   Rate limit: 60s cooldown
   On error: continue
    |
     v (fail / no key)
3. Tavily (if TAVILY_API_KEY set)
   Comprehensive search results
   Rate limit: 60s cooldown
   On error: continue
     |
     v (fail / no key)
4. Serper (if SERPER_API_KEY set)
   Google search results via Serper API
   2500 free credits
   Rate limit: 60s cooldown
   On error: continue
     |
     v (fail / no key)
5. DuckDuckGo (FREE - always available)
   HTML scraping, no auth needed
   Rate limit: 30s cooldown
    |
     v (fail)
6. Mistral websearch (if MISTRAL_API_KEY set)
   Mistral chat API with web_search tool
   Free tier available
   Rate limit: 60s cooldown
     |
     v (all fail)
7. Return error: source="none"
```

## URL Resolution Cascade

```
URL Input
    |
    v
1. llms.txt check (FREE)
   Probe: https://{origin}/llms.txt
   Cached per origin, 1-hour TTL
   On miss: continue
    |
    v (not found)
2. Jina Reader (FREE)
   GET https://r.jina.ai/{url}
   20 RPM free tier, no API key
   Rate limit: 60s cooldown
    |
    v (fail)
3. Firecrawl (if FIRECRAWL_API_KEY set)
   POST https://api.firecrawl.dev/v1/scrape
   Deep content extraction
   On 401/403: return None (skip)
   On 429/quota: continue to next
    |
    v (fail / no key)
4. Direct HTTP fetch (FREE)
   Plain GET + basic HTML-to-text strip
   Always available fallback
    |
    v (fail)
5. Mistral browser (if MISTRAL_API_KEY set)
   Mistral agent with web_browser tool
   Free tier available
    |
    v (fail / no key)
6. DuckDuckGo search fallback (FREE)
   Search for URL as a query string
    |
    v (all fail)
7. Return error: source="none"
```

## Skip providers

Use `--skip <provider>` to remove a provider from the cascade:

```bash
# Skip Exa MCP, force SDK path
python -m scripts.resolve "query" --skip exa_mcp

# Skip all paid, use only free
python -m scripts.resolve "query" --skip exa --skip tavily --skip mistral
```

## Custom order

Use `--providers-order` to fully override the cascade:

```bash
python -m scripts.resolve "https://example.com" --providers-order "llms_txt,jina,direct_fetch"
python -m scripts.resolve "query" --providers-order "exa_mcp,duckduckgo"
```

## Error handling

| Condition | Behaviour |
|---|---|
| 429 / rate limit | Log warning, note cooldown seconds, skip to next provider |
| 401 / 403 auth | Log error, skip provider entirely |
| Content too short (`< min_chars`) | Skip result, try next provider |
| All providers fail | Return `{"source": "none", "error": "No resolution method available"}` |
| Network timeout | Treat as provider failure, continue cascade |

See also: [`PROVIDERS.md`](./PROVIDERS.md) for per-provider API details.
