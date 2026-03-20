# Provider Reference

Detailed reference for all resolution providers in `web-doc-resolver`.

## Query Cascade Order

1. `exa_mcp` — Exa MCP tool (free, no API key)
2. `exa` — Exa Search API (requires `EXA_API_KEY`)
3. `tavily` — Tavily Search API (requires `TAVILY_API_KEY`)
4. `serper` — Serper Google Search (requires `SERPER_API_KEY`, 2500 free credits)
5. `duckduckgo` — DuckDuckGo HTML scrape, no key required
6. `mistral_websearch` — Mistral AI web search (requires `MISTRAL_API_KEY`)

## URL Cascade Order

1. `llms_txt` — Fetch `/llms.txt` from domain (free)
2. `jina` — Jina Reader (`r.jina.ai/<url>`), free tier
3. `firecrawl` — Deep extraction (requires `FIRECRAWL_API_KEY`)
4. `direct_fetch` — Direct HTTP GET of the URL (free)
5. `mistral_browser` — Mistral AI browser (requires `MISTRAL_API_KEY`)
6. `duckduckgo` — DuckDuckGo search fallback (free)

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

### duckduckgo
- **Type**: HTML scrape
- **Key required**: No
- **Skip flag**: `--skip duckduckgo`
- **Notes**: Scrapes DDG HTML results page, no official API

### serper
- **Type**: REST API (Google Search)
- **Key required**: `SERPER_API_KEY`
- **Skip flag**: `--skip serper`
- **Notes**: 2500 free credits on signup
- **Missing key**: Provider skipped silently

### mistral_websearch
- **Type**: REST API (Mistral chat with web search)
- **Key required**: `MISTRAL_API_KEY`
- **Skip flag**: `--skip mistral_websearch`
- **Notes**: AI-powered search synthesis

### mistral_browser
- **Type**: REST API (Mistral agent with browser)
- **Key required**: `MISTRAL_API_KEY`
- **Skip flag**: `--skip mistral_browser`
- **Notes**: AI-powered page browsing and extraction

### docling
- **Type**: Document parser
- **Key required**: No (local processing)
- **Skip flag**: `--skip docling`
- **Notes**: Handles PDF, DOCX, PPTX files
- **Auto-routed**: URLs ending in .pdf, .docx, .pptx

### ocr
- **Type**: Image OCR
- **Key required**: No (local processing)
- **Skip flag**: `--skip ocr`
- **Notes**: Handles PNG, JPG images
- **Auto-routed**: URLs ending in .png, .jpg, .jpeg

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
