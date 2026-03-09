# web-doc-resolver

🔍 Resolve queries or URLs into compact, LLM-ready markdown using an intelligent, low-cost cascade.

## Overview

This agent skill implements a v4 cascade resolver that prioritizes free and low-cost data sources:

### Query Resolution Cascade
1. **Exa MCP** - FREE search via Model Context Protocol (no API key required!)
2. **Exa highlights** - Token-efficient query resolution using highlights (low-cost)
3. **Tavily** - Fallback for comprehensive search (configurable)
4. **DuckDuckGo** - Free search, always available (no API key)
5. **Mistral** - AI-powered fallback when other methods fail

### URL Resolution Cascade
1. **llms.txt** - Check for structured LLM documentation first (free)
2. **Firecrawl** - Deep extraction (**requires API key**)
3. **Direct HTTP fetch** - Basic content extraction (free)
4. **Mistral browser** - AI-powered fallback when other methods fail

## Features

✅ **Free First**: Exa MCP provides free search without any API key
✅ **Cost-Optimized**: Free sources first, paid APIs only when necessary
✅ **Token-Efficient**: Uses Exa highlights to minimize token usage
✅ **Agent-Ready**: Compatible with [agentskills.io](https://agentskills.io/)
✅ **Flexible**: Most API keys are optional - works with free defaults
✅ **Skip Providers**: Override cascade with `--skip` option
✅ **Well-Tested**: Includes comprehensive test suite and CI/CD
✅ **Self-Learning**: Detects rate limits, credit exhaustion, and adapts automatically
✅ **Error Resilient**: Automatic fallback when providers fail

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
```

## How It Works

### Query Resolution Cascade

```
Query Input
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Exa MCP Search (FREE - no API key required!)            │
│    - Uses Model Context Protocol at https://mcp.exa.ai/mcp  │
│    - JSON-RPC 2.0 over HTTP POST                            │
│    - Rate limit handling: 30s cooldown                       │
│    - On error: continue to next provider                    │
└─────────────────────────────────────────────────────────────┘
    │ (fail)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Exa SDK Search (if EXA_API_KEY set)                     │
│    - Uses highlights for token-efficient results            │
│    - Rate limit handling: 60s cooldown                      │
│    - On error: continue to next provider                    │
└─────────────────────────────────────────────────────────────┘
    │ (fail/unavailable)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Tavily Search (if TAVILY_API_KEY set)                   │
│    - Comprehensive search results                           │
│    - Rate limit handling: 60s cooldown                      │
│    - On error: continue to next provider                    │
└─────────────────────────────────────────────────────────────┘
    │ (fail/unavailable)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. DuckDuckGo Search (FREE - no API key required!)         │
│    - Completely free, no authentication needed               │
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
│    - Probe: https://origin/llms.txt                        │
│    - If found: return structured documentation              │
│    - FREE - no API key required                             │
└─────────────────────────────────────────────────────────────┘
    │ (not found)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Firecrawl Extraction (if FIRECRAWL_API_KEY set)        │
│    - Deep content extraction with markdown output           │
│    - Rate limit handling: 60s cooldown                      │
│    - On rate limit/quota: fallback to next provider         │
│    - On auth error: return None                             │
└─────────────────────────────────────────────────────────────┘
    │ (fail/unavailable)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Direct HTTP Fetch                                        │
│    - Basic content extraction from HTML                     │
│    - FREE - no API key required                             │
└─────────────────────────────────────────────────────────────┘
    │ (fail)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Mistral Browser (if MISTRAL_API_KEY set)               │
│    - Uses Mistral agent with web browsing capability        │
│    - Free tier available                                     │
│    - Rate limit handling: 60s cooldown                      │
└─────────────────────────────────────────────────────────────┘
    │ (fail/unavailable)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. DuckDuckGo Search (fallback)                            │
│    - Search for the URL as a query                          │
│    - FREE - no API key required                             │
└─────────────────────────────────────────────────────────────┘
    │ (fail)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Return Error                                             │
│    - source: "none"                                         │
│    - error: "No resolution method available"               │
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