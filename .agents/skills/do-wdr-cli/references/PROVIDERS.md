# WDR CLI Providers Reference

Complete reference for all providers available in the do-wdr CLI.

## Provider Types

Providers are categorized by input type:

| Type | Description |
|------|-------------|
| **Query** | Search providers for query-based resolution |
| **URL** | Extraction providers for URL-based resolution |

## Query Providers

### exa_mcp

| Property | Value |
|----------|-------|
| Type | Query |
| Free | Yes |
| API Key | Not required |
| Endpoint | https://mcp.exa.ai/mcp |
| Description | Exa MCP - free semantic search via Model Context Protocol |

**Usage:**
```bash
do-wdr resolve "query" --provider exa_mcp
```

**Notes:**
- Always tried first for queries (free)
- No API key needed
- Uses MCP protocol for semantic search

---

### exa_sdk

| Property | Value |
|----------|-------|
| Type | Query |
| Free | No |
| API Key | Required (`EXA_API_KEY`) |
| Endpoint | https://api.exa.ai |
| Description | Exa SDK - paid semantic search with highlights |

**Usage:**
```bash
export EXA_API_KEY="your_key"
do-wdr resolve "query" --provider exa_sdk
```

**Notes:**
- Used as fallback when exa_mcp returns insufficient results
- Supports highlights and content extraction
- Requires API key

---

### tavily

| Property | Value |
|----------|-------|
| Type | Query |
| Free | No |
| API Key | Required (`TAVILY_API_KEY`) |
| Endpoint | https://api.tavily.com |
| Description | Tavily - comprehensive search with context |

**Usage:**
```bash
export TAVILY_API_KEY="your_key"
do-wdr resolve "query" --provider tavily
```

**Notes:**
- Good for comprehensive results
- Returns context along with results
- Free tier: 1000 requests/month

---

### serper

| Property | Value |
|----------|-------|
| Type | Query |
| Free | No |
| API Key | Required (`SERPER_API_KEY`) |
| Endpoint | https://google.serper.dev |
| Description | Serper - Google search results |

**Usage:**
```bash
export SERPER_API_KEY="your_key"
do-wdr resolve "query" --provider serper
```

**Notes:**
- Direct Google search results
- Free tier: 2500 credits

---

### duckduckgo

| Property | Value |
|----------|-------|
| Type | Query |
| Free | Yes |
| API Key | Not required |
| Endpoint | HTML scraping |
| Description | DuckDuckGo - privacy-focused search |

**Usage:**
```bash
do-wdr resolve "query" --provider duckduckgo
```

**Notes:**
- Always available (no API key)
- Good fallback when other providers fail
- Moderate rate limits

---

### mistral_websearch

| Property | Value |
|----------|-------|
| Type | Query |
| Free | No |
| API Key | Required (`MISTRAL_API_KEY`) |
| Endpoint | https://api.mistral.ai |
| Description | Mistral AI - AI-powered web search |

**Usage:**
```bash
export MISTRAL_API_KEY="your_key"
do-wdr resolve "query" --provider mistral_websearch
```

**Notes:**
- AI-powered search
- Good for complex queries
- Free tier available

---

## URL Providers

### llms_txt

| Property | Value |
|----------|-------|
| Type | URL |
| Free | Yes |
| API Key | Not required |
| Endpoint | Probes https://origin/llms.txt |
| Description | llms.txt - site-provided structured documentation |

**Usage:**
```bash
do-wdr resolve "https://example.com" --provider llms_txt
```

**Notes:**
- Always tried first for URLs (free)
- Looks for llms.txt at site root
- Returns structured documentation if available

---

### jina

| Property | Value |
|----------|-------|
| Type | URL |
| Free | Yes |
| API Key | Not required |
| Endpoint | https://r.jina.ai |
| Description | Jina Reader - URL to markdown conversion |

**Usage:**
```bash
do-wdr resolve "https://example.com" --provider jina
```

**Notes:**
- Free tier: 20 requests/minute
- Converts any URL to markdown
- Good for documentation sites

---

### firecrawl

| Property | Value |
|----------|-------|
| Type | URL |
| Free | No |
| API Key | Required (`FIRECRAWL_API_KEY`) |
| Endpoint | https://api.firecrawl.dev |
| Description | Firecrawl - full page extraction with JS rendering |

**Usage:**
```bash
export FIRECRAWL_API_KEY="your_key"
do-wdr resolve "https://example.com" --provider firecrawl
```

**Notes:**
- Handles JavaScript-rendered pages
- Free tier: 500 requests/month
- Best for complex pages

---

### direct_fetch

| Property | Value |
|----------|-------|
| Type | URL |
| Free | Yes |
| API Key | Not required |
| Endpoint | Direct HTTP requests |
| Description | Direct Fetch - basic HTML content extraction |

**Usage:**
```bash
do-wdr resolve "https://example.com" --provider direct_fetch
```

**Notes:**
- Basic fallback for simple pages
- No JavaScript support
- Always available

---

### mistral_browser

| Property | Value |
|----------|-------|
| Type | URL |
| Free | No |
| API Key | Required (`MISTRAL_API_KEY`) |
| Endpoint | Mistral agent-browser |
| Description | Mistral Browser - AI-powered browser extraction |

**Usage:**
```bash
export MISTRAL_API_KEY="your_key"
do-wdr resolve "https://example.com" --provider mistral_browser
```

**Notes:**
- AI-powered browser automation
- Handles complex interactions
- Used when other methods fail

---

### docling

| Property | Value |
|----------|-------|
| Type | URL |
| Free | No |
| API Key | Required |
| Endpoint | Docling service |
| Description | Docling - document processing |

**Usage:**
```bash
do-wdr resolve "https://example.com/doc.pdf" --provider docling
```

**Notes:**
- Handles various document formats
- Good for PDFs and structured documents

---

### ocr

| Property | Value |
|----------|-------|
| Type | URL |
| Free | No |
| API Key | Required |
| Endpoint | OCR service |
| Description | OCR - text extraction from images |

**Usage:**
```bash
do-wdr resolve "https://example.com/image.png" --provider ocr
```

**Notes:**
- Extracts text from images
- Good for screenshots and scanned documents

---

## Provider Priority

### Query Resolution

1. `exa_mcp` (free)
2. `exa_sdk` (paid)
3. `tavily` (paid)
4. `serper` (paid)
5. `duckduckgo` (free)
6. `mistral_websearch` (paid)

### URL Resolution

1. `llms_txt` (free)
2. `jina` (free)
3. `firecrawl` (paid)
4. `direct_fetch` (free)
5. `mistral_browser` (paid)

## Skipping Providers

Skip specific providers:

```bash
# Skip paid providers
do-wdr resolve "query" --skip exa_sdk,tavily,serper,mistral_websearch

# Skip specific provider
do-wdr resolve "query" --skip firecrawl

# Use only free providers
do-wdr resolve "query" --skip exa_sdk,tavily,serper,mistral_websearch,mistral_browser
```

## Custom Provider Order

Override default priority:

```bash
do-wdr resolve "query" --providers-order duckduckgo,exa_mcp,tavily
```
