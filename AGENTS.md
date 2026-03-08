<!-- skill: web-doc-resolver v1.0.0 -->
<!-- source: https://github.com/d-oit/web-doc-resolver/tree/v1.0.0 -->

# Agent Instructions

This repository contains the **web-doc-resolver** Agent Skill — a low-cost cascade resolver that fetches and resolves web documentation into compact, LLM-ready markdown.

## Setup (run once)

```bash
# No-install run via uvx (recommended)
uvx web-doc-resolver --help

# Or install directly
pip install -r requirements.txt
```

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
│   └── test_resolve.py   # Basic unit tests
├── .github/workflows/
│   ├── ci.yml            # CI/CD pipeline (lint, test, sample)
│   └── release.yml       # Tag-based release + changelog automation
├── .gitignore            # Python gitignore
└── LICENSE               # MIT license
```

## How It Works

The resolver uses a **cascade strategy** to minimize API calls and token usage:

1. **For URLs**: Probes `llms.txt` first → falls back to Firecrawl if needed
2. **For queries**: Uses Exa highlights first → Tavily fallback → Firecrawl last

This approach:
- Prioritizes site-provided structured docs (llms.txt)
- Uses Exa highlights for token-efficient search
- Calls Tavily only when Exa returns insufficient results
- Scrapes with Firecrawl only as final fallback

## Running the Script

### Prerequisites

- Python 3.10+
- Install dependency: `pip install aiohttp`

### Basic Usage

```bash
# Resolve a query
python scripts/resolve.py "Rust agent frameworks"

# Resolve a URL
python scripts/resolve.py "https://docs.rs/tokio/latest/tokio/"

# With options
python scripts/resolve.py "query" --max-chars 8000 --log-level INFO
```

## Environment Variables (all optional)

| Variable | Provider | Notes |
|---|---|---|
| `EXA_API_KEY` | Exa | Skipped if absent |
| `TAVILY_API_KEY` | Tavily | Skipped if absent |
| `FIRECRAWL_API_KEY` | Firecrawl | Skipped if absent |

## Versioning

This is an [agentskills.io](https://agentskills.io) Agent Skill. Versions are Git tags.

```bash
# Use latest
claude skills add github:d-oit/web-doc-resolver

# Pin to specific version
claude skills add github:d-oit/web-doc-resolver@v1.0.0
```

See [CHANGELOG](https://github.com/d-oit/web-doc-resolver/releases) for release history.
