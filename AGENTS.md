<!-- skill: web-doc-resolver v1.3.0 -->
<!-- source: https://github.com/d-oit/web-doc-resolver/tree/v1.3.0 -->

# Agent Instructions

This repository contains the **web-doc-resolver** Agent Skill — a low-cost cascade resolver that fetches and resolves web documentation into compact, LLM-ready markdown.

## Setup (run once)

```bash
# No-install run via uvx (recommended)
uvx web-doc-resolver --help

# Or install directly
pip install -r requirements.txt

# Setup git hooks (validates skill symlink on commit)
./scripts/setup-hooks.sh
```

## Skill Symlink Validation

The skill definition in `.blackbox/skills/web-doc-resolver/SKILL.md` must always point to the root `SKILL.md` file. This is validated:

- **On every commit** via pre-commit hook
- **In CI** via `validate-symlink` job
- **Manually** via `python scripts/validate_skill_symlink.py`

If the symlink is broken or points to the wrong location, commits and CI will fail.

## Repository Structure

```
web-doc-resolver/
├── SKILL.md              # Agent skill definition (agentskills.io format)
├── AGENTS.md             # This file - project-level context
├── README.md             # Human-readable project documentation
├── .mcp.json             # MCP server config for Claude Code / OpenCode
├── scripts/
│   └── resolve.py        # Main resolver script (async Python)
├── references/
│   └── CASCADE.md        # Full cascade fallback decision tree
├── tests/
│   └── test_resolve.py   # Comprehensive unit tests
├── .github/workflows/
│   ├── ci.yml            # CI/CD pipeline (lint, test, sample)
│   └── release.yml       # Tag-based release + changelog automation
├── .gitignore            # Python gitignore
└── LICENSE               # MIT license
```

## How It Works

The resolver uses a **cascade strategy** to minimize API calls and token usage:

### URL Resolution Cascade
1. **llms.txt** (cached per origin, 1-hour TTL) - FREE
2. **Jina Reader** (r.jina.ai) - FREE, no API key
3. **Firecrawl** - deep extraction (requires API key)
4. **Direct HTTP fetch** - FREE
5. **Mistral browser** - AI-powered fallback
6. **DuckDuckGo search** - FREE fallback

### Query Resolution Cascade
1. **Exa MCP** - FREE via Model Context Protocol (no API key!)
2. **Exa SDK** - token-efficient highlights (optional API key)
3. **Tavily** - comprehensive search (optional API key)
4. **DuckDuckGo** - FREE, always available
5. **Mistral websearch** - AI-powered fallback

## Running the Script

### Prerequisites

- Python 3.10+
- Install dependencies: `pip install -r requirements.txt`

### Basic Usage

```bash
# Resolve a query (uses Exa MCP - FREE!)
python scripts/resolve.py "Rust agent frameworks"

# Resolve a URL
python scripts/resolve.py "https://docs.rs/tokio/latest/tokio/"

# With options
python scripts/resolve.py "query" --max-chars 8000 --log-level INFO --json
```

### Use a Specific Provider Directly

Bypass the cascade and use a single provider:

```bash
# Use Jina Reader directly for a URL
python scripts/resolve.py "https://example.com" --provider jina

# Use Exa MCP directly for a query
python scripts/resolve.py "python tutorials" --provider exa_mcp

# Use DuckDuckGo directly
python scripts/resolve.py "latest news" --provider duckduckgo
```

Available providers:
- **URL providers**: `llms_txt`, `jina`, `firecrawl`, `direct_fetch`, `mistral_browser`, `duckduckgo`
- **Query providers**: `exa_mcp`, `exa`, `tavily`, `duckduckgo`, `mistral_websearch`

### Custom Provider Order

Override the default cascade with your own order:

```bash
# Use only free providers for URLs (no API keys needed)
python scripts/resolve.py "https://example.com" --providers-order "llms_txt,jina,direct_fetch"

# Use only free providers for queries
python scripts/resolve.py "python tutorials" --providers-order "exa_mcp,duckduckgo"

# Prefer Jina over Firecrawl
python scripts/resolve.py "https://docs.example.com" --providers-order "llms_txt,jina,direct_fetch,duckduckgo"
```

### Skip Specific Providers

```bash
# Skip Exa MCP to test fallbacks
python scripts/resolve.py "query" --skip exa_mcp --skip exa

# Use only Mistral
python scripts/resolve.py "query" --skip exa_mcp --skip exa --skip tavily --skip duckduckgo

# Use only DuckDuckGo
python scripts/resolve.py "query" --skip exa_mcp --skip exa --skip tavily --skip mistral
```

### Python API

```python
from scripts.resolve import (
    resolve,
    resolve_direct,
    resolve_with_order,
    ProviderType,
    DEFAULT_URL_PROVIDERS,
    DEFAULT_QUERY_PROVIDERS,
)

# Default cascade
result = resolve("https://example.com")

# Use a specific provider directly
result = resolve_direct("https://example.com", ProviderType.JINA)
result = resolve_direct("python tutorials", ProviderType.EXA_MCP)

# Custom provider order
result = resolve_with_order(
    "https://example.com",
    [ProviderType.LLMS_TXT, ProviderType.JINA, ProviderType.DIRECT_FETCH]
)

# Use only free providers for queries
result = resolve_with_order(
    "python tutorials",
    [ProviderType.EXA_MCP, ProviderType.DUCKDUCKGO]
)
```

## Environment Variables (all optional)

| Variable | Provider | Notes |
|---|---|---|
| `EXA_API_KEY` | Exa SDK | Optional - Exa MCP is free and used first |
| `TAVILY_API_KEY` | Tavily | Optional - comprehensive search |
| `FIRECRAWL_API_KEY` | Firecrawl | Optional - deep extraction |
| `MISTRAL_API_KEY` | Mistral | Optional - AI-powered fallback |

**Note**: Exa MCP, Jina Reader, and DuckDuckGo are always available as free fallbacks (no API key required).

## Versioning

This is an [agentskills.io](https://agentskills.io) Agent Skill. Versions are Git tags.

