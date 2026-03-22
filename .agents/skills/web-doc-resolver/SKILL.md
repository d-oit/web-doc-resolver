---
name: do-web-doc-resolver
description: Python implementation for resolving URLs and queries into compact, LLM-ready markdown documentation. Use when you need the Python resolver with full cascade support, quality scoring, circuit breakers, and advanced routing features.
license: MIT
compatibility: Python 3.10+, async/await
allowed-tools: Bash(python:*|wdr:*) Read
metadata:
  author: d-oit
  version: "0.1.0"
  source: https://github.com/d-oit/do-web-doc-resolver
---

# Web Doc Resolver Skill

Python implementation for resolving web URLs and queries into compact, LLM-ready markdown documentation with provider cascade, quality scoring, and advanced routing.

## When to use this skill

Activate this skill when you need to:
- Resolve a URL or query to markdown using Python
- Use the full provider cascade with intelligent routing
- Access quality scoring and content validation features
- Use circuit breaker patterns for provider reliability
- Leverage routing memory for learned provider preferences
- Run as a CLI tool or import as a Python module

## Prerequisites

Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Commands

### CLI Usage

```bash
# Resolve a URL
python scripts/resolve.py "https://docs.rs/tokio"

# Resolve a query
python scripts/resolve.py "Rust async runtime comparison"

# With options
python scripts/resolve.py "query" --log-level INFO --max-chars 5000
```

### Python Module Usage

```python
from scripts.resolve import resolve, resolve_url, resolve_query

# Resolve URL
result = resolve_url("https://docs.rs/tokio")

# Resolve query
result = resolve_query("Rust web frameworks")

# Generic resolve (auto-detects URL vs query)
result = resolve("https://example.com")
result = resolve("Python web frameworks")
```

## Provider Cascade

### Query Resolution Cascade

1. Cache check (24h TTL)
2. Exa MCP (FREE, no API key)
3. Exa SDK (paid, EXA_API_KEY)
4. Tavily (paid, TAVILY_API_KEY)
5. Serper (paid, SERPER_API_KEY)
6. DuckDuckGo (FREE, no API key)
7. Mistral Web Search (paid, MISTRAL_API_KEY)

### URL Resolution Cascade

1. Cache check (24h TTL)
2. Special file type detection (.pdf, .docx, .pptx → Docling; .png, .jpg, .jpeg → OCR)
3. llms.txt probe (FREE)
4. Jina Reader (FREE)
5. Firecrawl (paid, FIRECRAWL_API_KEY)
6. Direct HTTP fetch (FREE)
7. Mistral Browser (paid, MISTRAL_API_KEY)
8. DuckDuckGo fallback (FREE)

## Available Providers

| Provider | Type | Free | Description |
|----------|------|------|-------------|
| `exa_mcp` | Query | Yes | Exa MCP (free, no key) |
| `exa` | Query | No | Exa SDK (requires API key) |
| `tavily` | Query | No | Tavily comprehensive search |
| `serper` | Query | No | Google search via Serper |
| `duckduckgo` | Query | Yes | DuckDuckGo search |
| `mistral_websearch` | Query | No | Mistral AI search |
| `llms_txt` | URL | Yes | llms.txt structured docs |
| `jina` | URL | Yes | Jina Reader |
| `firecrawl` | URL | No | Firecrawl extraction |
| `direct_fetch` | URL | Yes | Direct HTML fetch |
| `mistral_browser` | URL | No | Mistral browser agent |
| `docling` | URL | No | Docling document processing |
| `ocr` | URL | No | OCR text extraction |

## Execution Profiles

| Profile | Max Attempts | Max Paid | Max Latency | Quality Threshold |
|---------|-------------|----------|-------------|-------------------|
| `free` | 3 | 0 | 6,000ms | 0.70 |
| `fast` | 2 | 1 | 4,000ms | 0.60 |
| `balanced` | 4-6 | 1-2 | 9,000-12,000ms | 0.65 |
| `quality` | 6-10 | 3-5 | 15,000-20,000ms | 0.55 |

## Quality Scoring

Content is scored on a 0.0-1.0 scale:

| Signal | Penalty |
|--------|---------|
| Too short (< 500 chars) | -0.35 |
| Missing links | -0.15 |
| Duplicate-heavy | -0.25 |
| Noisy content | -0.20 |

## Error Handling

| Error Type | Detection | Behavior |
|------------|-----------|----------|
| rate_limit | 429, "rate limit" | Set cooldown, skip provider |
| auth_error | 401, 403, "unauthorized" | Log error, skip provider |
| quota_exhausted | 402, "quota", "credits" | Log warning, skip provider |
| network_error | "timeout", "connection" | Log error, skip provider |
| not_found | 404, "not found" | Log error, skip provider |
| provider_5xx | 500-504 | Trip circuit breaker |

## Circuit Breaker

- **Failure threshold**: 3 consecutive failures
- **Cooldown period**: 300 seconds (5 minutes)
- **Behavior**: Provider skipped until cooldown expires
- **Reset**: Successful call resets failure count

## Configuration

### Environment Variables

```bash
# Provider API keys (all optional)
export EXA_API_KEY="your_key"
export TAVILY_API_KEY="your_key"
export SERPER_API_KEY="your_key"
export FIRECRAWL_API_KEY="your_key"
export MISTRAL_API_KEY="your_key"

# Resolver settings
export WEB_RESOLVER_MAX_CHARS=8000
export WEB_RESOLVER_MIN_CHARS=200
export WEB_RESOLVER_TIMEOUT=30
```

## Output Format

### Dictionary Response

```python
{
    "url": "https://example.com/docs",
    "content": "# Documentation\n\n...",
    "source": "exa_mcp",
    "score": 0.87,
    "metrics": {
        "latency_ms": 1234,
        "providers_attempted": ["exa_mcp"],
        "cache_hit": false
    }
}
```

## Skill Structure

```
.agents/skills/web-doc-resolver/
├── SKILL.md              # This file
├── requirements.txt      # Python dependencies
└── references/           # Detailed documentation
    ├── CASCADE.md        # Full cascade decision tree
    ├── CLI.md            # CLI usage (Python + Rust)
    ├── CONFIG.md         # Configuration reference
    ├── PROVIDERS.md      # Provider details
    ├── RUST_CLI.md       # Rust CLI architecture
    └── TESTING.md        # Test structure and markers
```

**Note**: Python scripts are located in the main `scripts/` directory at the project root.

## References

| Topic | File |
|-------|------|
| Full cascade logic | `references/CASCADE.md` |
| CLI usage (Python + Rust) | `references/CLI.md` |
| Configuration & env vars | `references/CONFIG.md` |
| All providers & rate limits | `references/PROVIDERS.md` |
| Rust CLI architecture | `references/RUST_CLI.md` |
| Test structure & markers | `references/TESTING.md` |

## Related Skills

- `wdr-cli`: Rust compiled CLI for faster performance
- `agent-browser`: Browser automation for complex web interactions