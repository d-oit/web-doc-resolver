---
name: web-doc-resolver
description: Resolve a query or URL into compact, LLM-ready markdown using a low-cost cascade. Prioritizes llms.txt for structured docs, uses Exa MCP (free) for query search, falls back to Tavily/Serper/DuckDuckGo, and uses Firecrawl for final extraction. Use when you need to fetch documentation, resolve web URLs to markdown, search for technical content, or build context from web sources.
license: MIT
compatibility: Python 3.10+, optional env EXA_API_KEY TAVILY_API_KEY SERPER_API_KEY FIRECRAWL_API_KEY MISTRAL_API_KEY
allowed-tools: Bash(python:*) Read
metadata:
  author: d-oit
  version: "0.1.0"
  source: https://github.com/d-oit/web-doc-resolver
  changelog: https://github.com/d-oit/web-doc-resolver/releases
---

# Web Documentation Resolver

Resolve query or URL inputs into compact, high-signal markdown for agents and RAG systems.

## When to use this skill

Activate this skill when you need to:
- Fetch and parse documentation from a URL
- Search for technical information across the web
- Build context from web sources
- Extract markdown from websites
- Query documentation APIs (Exa MCP, Exa SDK, Tavily, Serper, Firecrawl)

## How it works

### For URL inputs

1. **Check llms.txt first**: Probes `https://origin/llms.txt` to find site-provided structured documentation
2. **Parse and fetch**: If llms.txt exists, fetches primary linked docs and optional docs
3. **Fallback extraction**: If no structured docs found, uses Firecrawl to extract markdown
4. **Direct fetch**: Basic HTML content extraction (free)
5. **Mistral agent-browser**: Free fallback when Firecrawl has rate limits or insufficient credits
6. **DuckDuckGo search**: Free search fallback (no API key)

### For query inputs

1. **Exa MCP search**: FREE - no API key required, uses Model Context Protocol at https://mcp.exa.ai/mcp
2. **Exa SDK fallback**: Uses Exa API with compact highlights (if EXA_API_KEY is set)
3. **Tavily fallback**: Calls Tavily only if Exa returns insufficient results
4. **Serper fallback**: Google search via Serper API (if SERPER_API_KEY set, 2500 free credits)
5. **DuckDuckGo fallback**: FREE - no API key required, always available
6. **Mistral fallback**: AI-powered search when other methods fail

See [cascade details](agents-docs/CASCADE.md) for the full fallback decision tree.

## Usage

Basic usage:
```bash
python -m scripts.resolve "Rust agent frameworks"
python -m scripts.resolve "https://docs.rs/tokio/latest/tokio/"
```

### Rust CLI (wdr)
```bash
wdr resolve "https://example.com"
wdr resolve "Rust agent frameworks" --json
wdr providers
```

### Web UI
```bash
cd web && npm run dev
# Open http://localhost:3000
```

With options:
```bash
python -m scripts.resolve "query" \
  --min-chars 200 \
  --max-chars 8000 \
  --exa-results 5 \
  --tavily-results 3 \
  --output-limit 10 \
  --log-level INFO
```

Skip specific providers (useful for testing or forcing fallback):
```bash
# Skip Exa MCP to test Tavily/DuckDuckGo/Mistral
python -m scripts.resolve "query" --skip exa_mcp --skip exa

# Use only Mistral
python -m scripts.resolve "query" --skip exa_mcp --skip exa --skip tavily --skip duckduckgo

# Use only DuckDuckGo
python -m scripts.resolve "query" --skip exa_mcp --skip exa --skip tavily --skip mistral
```

Available skip options: `exa_mcp`, `exa`, `tavily`, `serper`, `duckduckgo`, `mistral`

## Output format

Returns JSON array of results:
```json
[
  {
    "url": "https://example.com/docs/page",
    "content_markdown": "# Clean content...",
    "source": "llms_txt_doc|exa_mcp|exa_highlights|tavily_search|firecrawl",
    "score": 0.87
  }
]
```

## Configuration

### Defaults
- MAX_CHARS: 8000
- MIN_CHARS: 200
- EXA_RESULTS: 5
- TAVILY_RESULTS: 3
- OUTPUT_LIMIT: 10

### API Keys (all optional)
Set environment variables for provider access:
- `EXA_API_KEY`: For Exa SDK search (optional, Exa MCP is free and used first)
- `TAVILY_API_KEY`: For Tavily search (optional, skipped if absent)
- `SERPER_API_KEY`: For Serper Google search (optional, 2500 free credits)
- `FIRECRAWL_API_KEY`: For Firecrawl extraction (optional, skipped if absent)
- `MISTRAL_API_KEY`: For Mistral agent-browser fallback (optional, free tier available)

**Important**: All API keys are optional. Exa MCP and DuckDuckGo provide free search without any API key.

## Quality ranking

Results are ranked by:
- Content length (200-8000 chars preferred)
- Presence of headings, lists, code fences
- Low HTML-to-text ratio
- Canonical URL deduplication

## Error handling

- Provider failures never crash the resolver
- Errors emitted as JSON to stdout
- Logs go to stderr
- Graceful degradation when API keys missing
