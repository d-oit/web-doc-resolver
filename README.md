# web-doc-resolver

🔍 Resolve queries or URLs into compact, LLM-ready markdown using an intelligent, low-cost cascade.

## Overview

This agent skill implements a v4 cascade resolver that prioritizes free and low-cost data sources:

1. **llms.txt** - Check for structured LLM documentation first (free)
2. **Exa highlights** - Token-efficient query resolution using highlights (low-cost)
3. **Tavily** - Fallback for comprehensive search (configurable)
4. **Firecrawl** - Last resort for deep extraction (**requires API key**)
5. **Mistral agent-browser** - Free fallback when Firecrawl has rate limits or no credits

## Features

✅ **Cost-Optimized**: Free sources first, paid APIs only when necessary
✅ **Token-Efficient**: Uses Exa highlights to minimize token usage
✅ **Agent-Ready**: Compatible with [agentskills.io](https://agentskills.io/)
✅ **Flexible**: Most API keys are optional - works with free defaults
✅ **Well-Tested**: Includes comprehensive test suite and CI/CD
✅ **Self-Learning**: Detects rate limits, credit exhaustion, and adapts automatically
✅ **Error Resilient**: Automatic fallback to Mistral when Firecrawl fails

## Installation

```bash
# Clone the repository
git clone https://github.com/d-oit/web-doc-resolver.git
cd web-doc-resolver

# Install dependencies
pip install -r requirements.txt
```

## API Keys Configuration

### Required

- **FIRECRAWL_API_KEY** - **Required** for Firecrawl deep extraction. Without this key, Firecrawl will be skipped entirely. Get your key at [firecrawl.dev/pricing](https://www.firecrawl.dev/pricing)

### Optional (Enhances functionality)

- **EXA_API_KEY** - Enables Exa highlights for token-efficient search (falls back to free alternatives)
- **TAVILY_API_KEY** - Enables Tavily comprehensive search (falls back to free alternatives)
- **MISTRAL_API_KEY** - Enables Mistral agent-browser as fallback (free tier available)

### Setting API Keys

```bash
# Linux/macOS
export FIRECRAWL_API_KEY="your-firecrawl-key"  # Required for Firecrawl
export EXA_API_KEY="your-exa-key"              # Optional
export TAVILY_API_KEY="your-tavily-key"        # Optional
export MISTRAL_API_KEY="your-mistral-key"      # Optional

# Windows (PowerShell)
$env:FIRECRAWL_API_KEY="your-firecrawl-key"
$env:EXA_API_KEY="your-exa-key"
$env:TAVILY_API_KEY="your-tavily-key"
$env:MISTRAL_API_KEY="your-mistral-key"
```

## Usage

### Basic Usage (No API Keys)

```python
from scripts.resolve import resolve

# Resolve a URL (uses llms.txt + free fallbacks)
result = resolve("https://example.com")
print(result)

# Resolve a query (uses free search alternatives)
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

### Command Line

```bash
# Resolve a URL
python scripts/resolve.py "https://example.com"

# Resolve a query
python scripts/resolve.py "machine learning tutorials"

# With specific options
python scripts/resolve.py "query" \
  --max-chars 8000 \
  --exa-results 5 \
  --log-level INFO
```

## How It Works

The v4 cascade follows this decision tree:

```
Input (URL or query)
 |
 ├─ Is URL? → Check llms.txt first
 │   ├─ Found? → Return structured content ✓
 │   └─ Not found → Continue to extraction
 │
 ├─ Exa highlights (if API key set)
 │   ├─ Success? → Return highlights ✓
 │   └─ Rate limit/error → Continue
 │
 ├─ Tavily search (if API key set)
 │   ├─ Success? → Return results ✓
 │   └─ Rate limit/error → Continue
 │
 ├─ Firecrawl scrape (ONLY if API key set)
 │   ├─ API key present?
 │   │   ├─ Yes → Try Firecrawl
 │   │   │   ├─ Success? → Return content ✓
 │   │   │   ├─ Rate limit? → Use Mistral fallback
 │   │   │   └─ No credits? → Use Mistral fallback
 │   │   └─ No → Skip Firecrawl, use Mistral
 │   │
 └─ Mistral agent-browser (free fallback)
     └─ Return browser-extracted content ✓
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
python -m pytest tests/test_resolve.py::test_llms_txt_found

# Run with coverage
python -m pytest --cov=scripts tests/

# Test cascade fallbacks
python -m pytest tests/test_resolve.py::test_cascade_with_rate_limits
```

## Sample Files

Check the `samples/` directory for example usage:

- `sample_basic.py` - Basic usage without API keys
- `sample_with_keys.py` - Full cascade with all API keys
- `sample_firecrawl.py` - Firecrawl-specific examples
- `sample_error_handling.py` - Rate limit and error handling demos

## Pricing Information

### Free Tier Options

- **llms.txt**: 100% free, static file check
- **Mistral agent-browser**: Free tier available
- **Basic web scraping**: No API key needed

### Paid Options

- **Exa**: Token-efficient, pay-per-search ([exa.ai/pricing](https://exa.ai/pricing))
- **Tavily**: Comprehensive search, tiered pricing ([tavily.com/pricing](https://tavily.com/))
- **Firecrawl**: Deep extraction, credit-based ([firecrawl.dev/pricing](https://www.firecrawl.dev/pricing))
  - **Requires API key** - No free tier for API access
  - Skipped entirely if `FIRECRAWL_API_KEY` not set

## Related Files

- [`SKILL.md`](SKILL.md) - Full agent skill specification
- [`AGENTS.md`](AGENTS.md) - Agent usage documentation
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

**Note**: This skill prioritizes cost-efficiency and graceful degradation. It works perfectly fine with zero API keys configured, using only free sources (llms.txt, basic scraping, Mistral). API keys enhance functionality but are not required except for Firecrawl, which is completely optional and only activates when its API key is provided.
