# Provider Reference

Detailed reference for all resolution providers in `web-doc-resolver`.

## Provider Cascade Order

Default order (free-first):

1. `exa_mcp` — Exa MCP tool (no API key if MCP configured)
2. `llms_txt` — Fetch `/llms.txt` or `/llms-full.txt` from domain
3. `direct_fetch` — Direct HTTP GET of the URL
4. `jina` — Jina Reader (`r.jina.ai/<url>`), free tier
5. `exa` — Exa Search API (requires `EXA_API_KEY`)
6. `tavily` — Tavily Search API (requires `TAVILY_API_KEY`)
7. `mistral` — Mistral OCR API (requires `MISTRAL_API_KEY`)
8. `duckduckgo` — DuckDuckGo HTML scrape, no key required

## Provider Details

### exa_mcp
- **Type**: MCP tool call
- **Key required**: No (uses MCP session)
- **Skip flag**: `--skip exa_mcp`
- **Notes**: Only available when running inside an MCP-capable agent

### llms_txt
- **Type**: HTTP fetch
- **Key required**: No
- **Endpoints tried**: `https://<domain>/llms.txt`, `https://<domain>/llms-full.txt`
- **Skip flag**: `--skip llms_txt`

### direct_fetch
- **Type**: HTTP GET
- **Key required**: No
- **Min chars**: Configurable via `min_chars` (default: 200)
- **Skip flag**: `--skip direct_fetch`

### jina
- **Type**: Jina Reader proxy
- **Key required**: No (free tier, rate limited)
- **Base URL**: `https://r.jina.ai/`
- **Skip flag**: `--skip jina`
- **Rate limit**: 429 → skip with cooldown logged

### exa
- **Type**: REST API
- **Key required**: `EXA_API_KEY`
- **Skip flag**: `--skip exa`
- **Missing key**: Provider skipped silently

### tavily
- **Type**: REST API
- **Key required**: `TAVILY_API_KEY`
- **Skip flag**: `--skip tavily`
- **Missing key**: Provider skipped silently

### mistral
- **Type**: REST API (OCR)
- **Key required**: `MISTRAL_API_KEY`
- **Skip flag**: `--skip mistral`
- **Use case**: PDF/image-heavy pages

### duckduckgo
- **Type**: HTML scrape
- **Key required**: No
- **Skip flag**: `--skip duckduckgo`
- **Notes**: Scrapes DDG HTML results page, no official API

## Error Handling Per Provider

| HTTP Code | Behaviour |
|-----------|----------|
| 429 | Log warning + cooldown seconds, skip to next |
| 401/403 | Log error, skip provider entirely |
| 5xx | Log warning, skip to next |
| Timeout | Log warning, skip to next |

## Adding a New Provider

1. Implement the `Provider` trait (`src/providers/mod.rs`)
2. Register in `DEFAULT_CASCADE` array
3. Add `--skip <name>` support (automatic via name matching)
4. Add env var check in `Config::from_env()`
5. Add integration test in `tests/providers/`
6. Document here with key/endpoint/skip flag

## Provider Skipping

Providers are skipped when:
- Explicitly passed via `--skip <name>` flag
- API key env var is missing (paid providers only)
- `--providers-order` list does not include them
- Result content is shorter than `min_chars`
