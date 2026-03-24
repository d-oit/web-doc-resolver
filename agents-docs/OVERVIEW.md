# Project Overview

This document provides an overview of the do-web-doc-resolver project.

## Purpose

do-web-doc-resolver resolves queries or URLs into compact, LLM-ready markdown via a low-cost provider cascade. It prioritizes free providers and falls back to paid options only when necessary.

## Key Components

### 1. Python Resolver (`scripts/resolve.py`)

The main Python implementation that:
- Auto-detects URL vs query inputs
- Runs provider cascade with fallback logic
- Ranks and filters results
- Outputs JSON array of results

### 2. Rust CLI (`cli/`)

A compiled binary (`do-wdr`) that:
- Provides fast CLI access
- Mirrors Python functionality
- Supports cross-platform builds

### 3. Web UI (`web/`)

Next.js web interface that:
- Provides browser-based access with provider pill selection
- Vercel env var → localStorage fallback for API keys
- Key status API endpoint (booleans only, no key exposure)
- Shared key utility (`web/lib/keys.ts`) with `resolveKeySource()`
- Markdown preview toggle on results
- ⌘K keyboard shortcut to focus input
- Lightweight session history (last 10 queries)
- Dedicated settings page at `/settings` with source badges
- Deploys to Vercel

## Provider Cascade

### Query Input
1. Exa MCP (free)
2. Exa SDK (paid)
3. Tavily (paid)
4. Serper (paid)
5. DuckDuckGo (free)
6. Mistral (paid)

### URL Input
1. llms.txt probe (free)
2. Jina Reader (free)
3. Firecrawl (paid)
4. Direct fetch (free)
5. Mistral agent-browser (paid)
6. DuckDuckGo search (free)

## Architecture Principles

1. **Free-first**: Always try free providers before paid ones
2. **Graceful degradation**: Never crash on provider failure
3. **Quality ranking**: Results ranked by content quality metrics
4. **Configurable**: All parameters configurable via env vars or config file

## Development Workflow

1. **Local development**: Python for rapid iteration
2. **CLI distribution**: Rust binary for end users
3. **Web access**: Next.js for browser-based usage
4. **Testing**: Unit, integration, and live test suites

## File Structure

```
do-web-doc-resolver/
├── scripts/resolve.py       # Main Python resolver
├── cli/                     # Rust CLI
│   ├── Cargo.toml
│   └── src/
├── web/                     # Next.js web UI
│   ├── app/
│   │   ├── page.tsx         # Homepage (pills, preview, ⌘K, history)
│   │   ├── settings/page.tsx # API key management with source badges
│   │   └── api/
│   │       ├── resolve/     # Main resolver endpoint
│   │       └── key-status/  # Boolean key status endpoint
│   ├── lib/keys.ts          # Shared key utility
│   └── tests/e2e/
├── tests/                   # Python test suite
├── .agents/skills/          # Skill definitions
│   └── web-doc-resolver/
├── agents-docs/             # Project documentation
└── AGENTS.md               # Agent instructions
```
