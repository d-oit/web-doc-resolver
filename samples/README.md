# Sample Files

This directory contains example scripts demonstrating various usage patterns of do-web-doc-resolver.

## Files

### sample_basic.py
Basic usage without API keys. Demonstrates:
- URL resolution using free sources
- Query resolution with free fallbacks
- No API key configuration required

**Usage:**
```bash
python samples/sample_basic.py
```

### sample_with_keys.py
Full cascade with all API keys configured. Demonstrates:
- Checking which API keys are set
- Deep extraction with Firecrawl (requires API key)
- Token-efficient search with Exa
- Comprehensive search with Tavily
- Graceful fallbacks when keys not set

**Usage:**
```bash
# Set your API keys first
export FIRECRAWL_API_KEY="your-key"
export EXA_API_KEY="your-key"
export TAVILY_API_KEY="your-key"
export MISTRAL_API_KEY="your-key"

python samples/sample_with_keys.py
```

## Running the Samples

All samples can be run directly:

```bash
# From project root
python samples/sample_basic.py
python samples/sample_with_keys.py
```

## API Key Requirements

- **No API keys required**: `sample_basic.py` works with zero configuration
- **Optional API keys**: `sample_with_keys.py` works with any combination of keys
- **Firecrawl requires API key**: FIRECRAWL_API_KEY must be set to use Firecrawl features

## Expected Output

Each sample prints:
- Input (URL or query)
- Result length in characters
- Preview of the resolved content
- Status messages about which sources were used

## Troubleshooting

If you encounter errors:

1. **ModuleNotFoundError**: Install dependencies with `pip install -r requirements.txt`
2. **API errors**: Check that your API keys are valid and not rate-limited
3. **No results**: Ensure you have internet connectivity for web-based sources

For more details, see the main [README.md](../README.md) and [AGENTS.md](../AGENTS.md).
