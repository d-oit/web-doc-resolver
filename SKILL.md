---
name: web-doc-resolver
description: Resolve a query or URL into compact, LLM-ready markdown using a low-cost cascade. Prioritizes llms.txt for structured docs, uses Exa highlights for query search, falls back to Tavily, and uses Firecrawl for final extraction. Use when you need to fetch documentation, resolve web URLs to markdown, search for technical content, or build context from web sources.
license: MIT
compatibility: Python 3.10+, optional env EXA_API_KEY TAVILY_API_KEY FIRECRAWL_API_KEY MISTRAL_API_KEY
allowed-tools: Bash(python:*) Read
metadata:
  author: d-oit
  version: "1.0.0"
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
- Query documentation APIs (Exa, Tavily, Firecrawl)

## How it works

### For URL inputs

1. **Check llms.txt first**: Probes `https://origin/llms.txt` to find site-provided structured documentation
2. **Parse and fetch**: If llms.txt exists, fetches primary linked docs and optional docs
3. **Fallback extraction**: If no structured docs found, uses Firecrawl to extract markdown
4. **Mistral agent-browser**: Free fallback when Firecrawl has rate limits or insufficient credits

### For query inputs

1. **Exa search**: Uses Exa API with compact highlights for token-efficient results
2. **Tavily fallback**: Calls Tavily only if Exa returns insufficient results
3. **URL resolution**: Resolves top candidate URLs through the same URL pipeline
4. **Firecrawl extraction**: Final fallback when URLs don't yield good markdown
5. **Mistral agent-browser**: Free fallback when Firecrawl is unavailable

See [cascade details](references/CASCADE.md) for the full fallback decision tree.

## Usage

Basic usage:
```bash
python scripts/resolve.py "Rust agent frameworks"
python scripts/resolve.py "https://docs.rs/tokio/latest/tokio/"
```

With options:
```bash
python scripts/resolve.py "query" \
  --min-chars 200 \
  --max-chars 8000 \
  --exa-results 5 \
  --tavily-results 3 \
  --output-limit 10 \
  --log-level INFO
```

## Output format

Returns JSON array of results:
```json
[
  {
    "url": "https://example.com/docs/page",
    "content_markdown": "# Clean content...",
    "source": "llms_txt_doc|exa_highlights|tavily_search|firecrawl",
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
- `EXA_API_KEY`: For Exa search (optional, skipped if absent)
- `TAVILY_API_KEY`: For Tavily search (optional, skipped if absent)
- `FIRECRAWL_API_KEY`: For Firecrawl extraction (optional, skipped if absent)
- `MISTRAL_API_KEY`: For Mistral agent-browser fallback (optional, free tier available)

**Important**: All API keys are optional. The script runs without them and provides placeholder results.

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

## Versioning

This skill uses Git tags as version pins. Reference a specific version:
```
https://raw.githubusercontent.com/d-oit/web-doc-resolver/v1.0.0/SKILL.md
```

Install via any MCP-compatible CLI:
```bash
# Latest
claude skills add github:d-oit/web-doc-resolver

# Pinned to version
claude skills add github:d-oit/web-doc-resolver@v1.0.0
```
