# web-doc-resolver

🔍 Resolve queries or URLs into compact, LLM-ready markdown using an intelligent, low-cost cascade.

## Overview

This agent skill implements a v4 cascade resolver that prioritizes free and low-cost data sources:

### Query Resolution Cascade
1. **Semantic Cache** - Multi-layer cache (URL, Query, Provider)
2. **Exa MCP** - FREE search via Model Context Protocol (no API key required!)
3. **Exa highlights** - Token-efficient query resolution using highlights (low-cost)
4. **Tavily** - Fallback for comprehensive search (configurable)
5. **DuckDuckGo** - Free search, always available (no API key)
6. **Mistral** - AI-powered fallback when other methods fail

### URL Resolution Cascade
1. **Semantic Cache** - Instant retrieval for known URLs
2. **llms.txt / Jina Reader** - Parallel fast-path probes for structured documentation
3. **Firecrawl** - Deep extraction (**requires API key**)
4. **Direct HTTP fetch** - Basic content extraction (free)
5. **Mistral browser** - AI-powered fallback when other methods fail

## Features

✅ **Execution Profiles**: `free`, `balanced`, `fast`, and `quality` modes
✅ **Telemetry & Metrics**: Detailed per-provider latency and cost tracking
✅ **Content Compaction**: Intelligent boilerplate removal and deduplication
✅ **AI Synthesis**: Cohesive research answers synthesized using Mistral
✅ **Parallel Probes**: Concurrent fast-path provider checks for lower latency
✅ **Link Validation**: Automated async HTTP status checks for returned links
✅ **Bias Scoring**: Quality ranking based on domain trust and heuristics
✅ **Document & OCR**: Support for PDF/DOCX via Docling and images via OCR

## Installation

```bash
# Clone the repository
git clone https://github.com/d-oit/web-doc-resolver.git
cd web-doc-resolver

# Install dependencies
pip install -r requirements.txt
```

## API Keys Configuration

### All Keys Are Optional

All API keys are **optional**. The resolver works without any keys by using Exa MCP (free) and DuckDuckGo as free fallbacks.

| Key | Provider | Notes |
|---|---|---|
| `EXA_API_KEY` | Exa SDK | Optional - Exa MCP is free and used first |
| `TAVILY_API_KEY` | Tavily | Optional - comprehensive search |
| `FIRECRAWL_API_KEY` | Firecrawl | Optional - deep extraction |
| `MISTRAL_API_KEY` | Mistral | Optional - AI-powered fallback |

### Free Tier Options

- **Exa MCP**: Always free, no API key required (primary search)
- **DuckDuckGo**: Always free, no API key required (fallback)
- **Mistral**: Free tier available
- **Exa SDK**: Free tier available ([exa.ai/pricing](https://exa.ai/pricing))
- **Tavily**: Free tier available ([tavily.com/pricing](https://tavily.com/))
- **Firecrawl**: Free tier available ([firecrawl.dev/pricing](https://www.firecrawl.dev/pricing))

### Setting API Keys

```bash
# Linux/macOS
export EXA_API_KEY="your-exa-key"              # Optional (Exa MCP is free)
export TAVILY_API_KEY="your-tavily-key"        # Optional
export FIRECRAWL_API_KEY="your-firecrawl-key"  # Optional
export MISTRAL_API_KEY="your-mistral-key"      # Optional

# Windows (PowerShell)
$env:EXA_API_KEY="your-exa-key"
$env:TAVILY_API_KEY="your-tavily-key"
$env:FIRECRAWL_API_KEY="your-firecrawl-key"
$env:MISTRAL_API_KEY="your-mistral-key"
```

## Usage

### Basic Usage (No API Keys)

```python
from scripts.resolve import resolve

# Resolve a URL (uses llms.txt + free fallbacks)
result = resolve("https://example.com")
print(result)

# Resolve a query (uses Exa MCP - free!)
result = resolve("latest AI research papers")
print(result)
```

### With API Keys (Enhanced)

```python
import os
from scripts.resolve import resolve

# Set API keys (Firecrawl required for deep extraction)
os.environ["FIRECRAWL_API_KEY"] = "your-firecrawl-key"
os.environ["EXA_API_KEY"] = "your-exa-key"  # Optional

# Now uses full cascade including Firecrawl
result = resolve("https://complex-site.com")
print(result)
```

### Skip Specific Providers

```python
from scripts.resolve import resolve

# Skip Exa MCP to test fallbacks
result = resolve("query", skip_providers={"exa_mcp", "exa"})

# Use only Mistral
result = resolve("query", skip_providers={"exa_mcp", "exa", "tavily", "duckduckgo"})
```

### Use a Specific Provider Directly

Bypass the cascade and use a single provider:

```python
from scripts.resolve import resolve_direct, ProviderType

# Use Jina Reader directly for a URL
result = resolve_direct("https://example.com", ProviderType.JINA)

# Use Exa MCP directly for a query
result = resolve_direct("python tutorials", ProviderType.EXA_MCP)

# Use DuckDuckGo directly
result = resolve_direct("latest news", ProviderType.DUCKDUCKGO)
```

Available providers:
- **URL providers**: `llms_txt`, `jina`, `firecrawl`, `direct_fetch`, `mistral_browser`, `duckduckgo`
- **Query providers**: `exa_mcp`, `exa`, `tavily`, `duckduckgo`, `mistral_websearch`

### Custom Provider Order

Override the default cascade with your own order:

```python
from scripts.resolve import resolve_with_order, ProviderType

# Use only free providers for URLs (no API keys needed)
result = resolve_with_order(
    "https://example.com",
    [ProviderType.LLMS_TXT, ProviderType.JINA, ProviderType.DIRECT_FETCH]
)

# Use only free providers for queries
result = resolve_with_order(
    "python tutorials",
    [ProviderType.EXA_MCP, ProviderType.DUCKDUCKGO]
)

# Prefer Jina over Firecrawl for URLs
result = resolve_with_order(
    "https://docs.example.com",
    [ProviderType.LLMS_TXT, ProviderType.JINA, ProviderType.DIRECT_FETCH, ProviderType.DUCKDUCKGO]
)
```

### Command Line

```bash
# Resolve a URL
python scripts/resolve.py "https://example.com"

# Resolve a query (uses Exa MCP - free!)
python scripts/resolve.py "machine learning tutorials"

# With specific options
python scripts/resolve.py "query" \
  --max-chars 8000 \
  --log-level INFO \
  --json

# Skip specific providers
python scripts/resolve.py "query" --skip exa_mcp --skip exa

# Use only Mistral
python scripts/resolve.py "query" \
  --skip exa_mcp --skip exa --skip tavily --skip duckduckgo \
  --log-level INFO --json

# Use a specific provider directly
python scripts/resolve.py "https://example.com" --provider jina
python scripts/resolve.py "python tutorials" --provider exa_mcp

# Use a custom provider order
python scripts/resolve.py "https://example.com" --providers-order "llms_txt,jina,direct_fetch"
python scripts/resolve.py "python tutorials" --providers-order "exa_mcp,duckduckgo"
```

## How It Works

### Query Resolution Cascade

```
Query Input
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Exa MCP Search (FREE - no API key required!)             │
│    - Uses Model Context Protocol at https://mcp.exa.ai/mcp  │
│    - JSON-RPC 2.0 over HTTP POST                            │
│    - Rate limit handling: 30s cooldown                      │
│    - On error: continue to next provider                    │
└─────────────────────────────────────────────────────────────┘
    │ (fail)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Exa SDK Search (if EXA_API_KEY set)                      │
│    - Uses highlights for token-efficient results            │
│    - Rate limit handling: 60s cooldown                      │
│    - On error: continue to next provider                    │
└─────────────────────────────────────────────────────────────┘
    │ (fail/unavailable)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Tavily Search (if TAVILY_API_KEY set)                    │
│    - Comprehensive search results                           │
│    - Rate limit handling: 60s cooldown                      │
│    - On error: continue to next provider                    │
└─────────────────────────────────────────────────────────────┘
    │ (fail/unavailable)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. DuckDuckGo Search (FREE - no API key required!)          │
│    - Completely free, no authentication needed              │
│    - Rate limit handling: 30s cooldown                      │
│    - Always available as fallback                           │
└─────────────────────────────────────────────────────────────┘
    │ (fail)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Mistral Web Search (if MISTRAL_API_KEY set)              │
│    - Uses Mistral chat API with web search                  │
│    - Free tier available                                    │
│    - Rate limit handling: 60s cooldown                      │
└─────────────────────────────────────────────────────────────┘
    │ (fail/unavailable)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Return Error                                             │
│    - source: "none"                                         │
│    - error: "No resolution method available"                │
└─────────────────────────────────────────────────────────────┘
```

### URL Resolution Cascade

```
URL Input
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Check for llms.txt                                       │
│    - Probe: https://origin/llms.txt                         │
│    - If found: return structured documentation              │
│    - FREE - no API key required                             │
│    - Cached per origin (1-hour TTL)                         │
└─────────────────────────────────────────────────────────────┘
    │ (not found)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Jina Reader (FREE - https://r.jina.ai/<url>)             │
│    - No API key required, 20 RPM free tier                  │
│    - Returns clean markdown for any public URL              │
│    - Rate limit handling: 60s cooldown                      │
└─────────────────────────────────────────────────────────────┘
    │ (fail)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Firecrawl Extraction (if FIRECRAWL_API_KEY set)          │
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
│ 5. Mistral Browser (if MISTRAL_API_KEY set)                 │
│    - Uses Mistral agent with web browsing capability        │
│    - Free tier available                                    │
│    - Rate limit handling: 60s cooldown                      │
└─────────────────────────────────────────────────────────────┘
    │ (fail/unavailable)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. DuckDuckGo Search (fallback)                             │
│    - Search for the URL as a query                          │
│    - FREE - no API key required                             │
└─────────────────────────────────────────────────────────────┘
    │ (fail)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Return Error                                             │
│    - source: "none"                                         │
│    - error: "No resolution method available"                │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling & Self-Learning

The resolver automatically handles:

- **Rate Limits**: Detects 429 errors and falls back to next source
- **No Credits**: Catches "no credits" errors and uses free alternatives
- **Network Errors**: Graceful degradation through the cascade
- **Invalid Responses**: Validates content before returning
- **Missing API Keys**: Skips paid services when keys not configured

## Testing

```bash
# Run all tests
python -m pytest tests/

# Run specific test
python -m pytest tests/test_resolve.py::TestSkipProviders

# Run with coverage
python -m pytest --cov=scripts tests/

# Test cascade fallbacks
python -m pytest tests/test_resolve.py::TestQueryCascade
```

## Sample Files

Check the `samples/` directory for example usage:

- `sample_basic.py` - Basic usage without API keys
- `sample_with_keys.py` - Full cascade with all API keys

## Pricing Information

### Free Tier Options

- **Exa MCP**: 100% free, no API key required (primary search)
- **llms.txt**: 100% free, static file check
- **DuckDuckGo**: 100% free, always available
- **Mistral**: Free tier available

### Paid Options

- **Exa SDK**: Token-efficient, pay-per-search ([exa.ai/pricing](https://exa.ai/pricing))
- **Tavily**: Comprehensive search, tiered pricing ([tavily.com/pricing](https://tavily.com/))
- **Firecrawl**: Deep extraction, credit-based ([firecrawl.dev/pricing](https://www.firecrawl.dev/pricing))
  - **Requires API key** - No free tier for API access
  - Skipped entirely if `FIRECRAWL_API_KEY` not set

## Related Files

- [`SKILL.md`](SKILL.md) - Full agent skill specification
- [`AGENTS.md`](AGENTS.md) - Agent usage documentation
- [`references/CASCADE.md`](references/CASCADE.md) - Detailed cascade documentation
- [`scripts/resolve.py`](scripts/resolve.py) - Implementation source code
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) - CI/CD pipeline

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure CI passes
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or feature requests, please [open an issue](https://github.com/d-oit/web-doc-resolver/issues).

---

**Note**: This skill prioritizes cost-efficiency and graceful degradation. It works perfectly fine with zero API keys configured, using only free sources (Exa MCP, llms.txt, DuckDuckGo, Mistral free tier). API keys enhance functionality but are not required.
