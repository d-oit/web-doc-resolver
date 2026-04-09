# <img width="48" height="48" alt="image" src="https://github.com/user-attachments/assets/69413312-89b1-42b4-9f86-bce6903864fb" /> do-web-doc-resolver

**Resolve queries or URLs into compact, LLM-ready markdown using an intelligent, low-cost cascade**

## Overview

This project implements a v4 cascade resolver with Python core, Rust CLI, and web UI that prioritizes free and low-cost data sources.

## Overview

This project implements a v4 cascade resolver with Python core, Rust CLI, and web UI that prioritizes free and low-cost data sources:

### Query Resolution Cascade
1. **Semantic Cache** - Multi-layer cache (URL, Query, Provider)
2. **Exa MCP** - FREE search via Model Context Protocol (no API key required!)
3. **Exa SDK** - Token-efficient query resolution using highlights (low-cost)
4. **Tavily** - Comprehensive search (configurable)
5. **Serper** - Google search via Serper API (2500 free credits)
6. **DuckDuckGo** - Free search, always available (no API key)
7. **Mistral** - AI-powered fallback when other methods fail

### URL Resolution Cascade
1. **Semantic Cache** - Instant retrieval for known URLs
2. **llms.txt / Jina Reader** - Parallel fast-path probes for structured documentation
3. **Firecrawl** - Deep extraction (requires API key)
4. **Direct HTTP fetch** - Basic content extraction (free)
5. **Mistral browser** - AI-powered fallback when other methods fail
6. **DuckDuckGo** - Free search fallback (no API key)

## Features

- **Three Interfaces**: Python library, Rust CLI (`do-wdr`), and Next.js web UI
- **Execution Profiles**: `free`, `balanced`, `fast`, and `quality` modes
- **Telemetry & Metrics**: Detailed per-provider latency and cost tracking
- **Content Compaction**: Intelligent boilerplate removal and deduplication
- **AI Synthesis**: Cohesive research answers synthesized using Mistral
- **Parallel Probes**: Concurrent fast-path provider checks for lower latency
- **Link Validation**: Automated async HTTP status checks for returned links
- **Bias Scoring**: Quality ranking based on domain trust and heuristics
- **Document & OCR**: Support for PDF/DOCX via Docling and images via OCR
- **Semantic Cache**: Feature-gated similarity cache (Turso/libsql-backed)
- **Circuit Breakers**: Per-provider failure tracking with cooldowns
- **Routing Memory**: Per-domain provider success/latency learning
- **Web UI**: Browser-based resolver with dark mode, PWA support, and help/FAQ
- **Result Canonicalization**: Normalizes and deduplicates search hits with card-based previews and per-result actions

## Installation

### Python (Primary)

```bash
git clone https://github.com/d-oit/do-web-doc-resolver.git
cd do-web-doc-resolver
pip install -r requirements.txt
```

### Rust CLI

```bash
cd cli && cargo build --release
# Binary: cli/target/release/do-wdr
```

### Web UI

```bash
cd web && npm install && npx playwright install chromium
```

### Git Hooks

```bash
./scripts/setup-hooks.sh
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

## Configuration

All API keys are **optional**. The resolver works without any keys by using free providers (Exa MCP, llms.txt, DuckDuckGo).

| Variable | Provider | Notes |
|---|---|---|
| `EXA_API_KEY` | Exa SDK | Optional - Exa MCP is free and runs first |
| `TAVILY_API_KEY` | Tavily | Optional - comprehensive search |
| `SERPER_API_KEY` | Serper | Optional - Google search (2500 free credits) |
| `FIRECRAWL_API_KEY` | Firecrawl | Optional - deep extraction |
| `MISTRAL_API_KEY` | Mistral | Optional - AI-powered fallback |

### Setting API Keys

```bash
# Linux/macOS
export EXA_API_KEY="your-exa-key"
export TAVILY_API_KEY="your-tavily-key"
export SERPER_API_KEY="your-serper-key"
export FIRECRAWL_API_KEY="your-firecrawl-key"
export MISTRAL_API_KEY="your-mistral-key"

# Windows (PowerShell)
$env:EXA_API_KEY="your-exa-key"
$env:TAVILY_API_KEY="your-tavily-key"
$env:SERPER_API_KEY="your-serper-key"
$env:FIRECRAWL_API_KEY="your-firecrawl-key"
$env:MISTRAL_API_KEY="your-mistral-key"
```

Rust CLI supports `config.toml` or `DO_WDR_*` env vars. See [`.agents/skills/do-web-doc-resolver/references/CONFIG.md`](.agents/skills/do-web-doc-resolver/references/CONFIG.md) for full reference.

## Usage

### Python API

#### Basic Usage (No API Keys)

```python
from scripts.resolve import resolve

# Resolve a URL (uses llms.txt + free fallbacks)
result = resolve("https://example.com")

# Resolve a query (uses Exa MCP - free!)
result = resolve("latest AI research papers")
```

#### Skip Specific Providers

```python
from scripts.resolve import resolve

result = resolve("query", skip_providers={"exa_mcp", "exa"})
```

#### Use a Specific Provider Directly

```python
from scripts.resolve import resolve_direct, ProviderType

result = resolve_direct("https://example.com", ProviderType.JINA)
result = resolve_direct("python tutorials", ProviderType.EXA_MCP)
result = resolve_direct("latest news", ProviderType.DUCKDUCKGO)
```

Available providers:
- **URL providers**: `llms_txt`, `jina`, `firecrawl`, `direct_fetch`, `mistral_browser`, `duckduckgo`
- **Query providers**: `exa_mcp`, `exa`, `tavily`, `serper`, `duckduckgo`, `mistral_websearch`

#### Custom Provider Order

```python
from scripts.resolve import resolve_with_order, ProviderType

result = resolve_with_order(
    "https://example.com",
    [ProviderType.LLMS_TXT, ProviderType.JINA, ProviderType.DIRECT_FETCH]
)

result = resolve_with_order(
    "python tutorials",
    [ProviderType.EXA_MCP, ProviderType.DUCKDUCKGO]
)
```

### Python CLI

```bash
# Resolve a URL
python -m scripts.cli "https://example.com"

# Resolve a query
python -m scripts.cli "machine learning tutorials"

# With options
python -m scripts.cli "query" --max-chars 8000 --json --log-level INFO

# Skip providers
python -m scripts.cli "query" --skip exa_mcp --skip exa

# Use a specific provider
python -m scripts.cli "https://example.com" --provider jina

# Custom provider order
python -m scripts.cli "https://example.com" --providers-order "llms_txt,jina,direct_fetch"
```

### Rust CLI (`do-wdr`)

```bash
# Build the CLI
cd cli && cargo build --release

# Resolve a URL or query
./target/release/do-wdr resolve "https://example.com"
./target/release/do-wdr resolve "machine learning tutorials"

# Output as JSON
./target/release/do-wdr resolve "query" --json

# Save to file
./target/release/do-wdr resolve "https://example.com" -o result.md

# Use execution profile
./target/release/do-wdr resolve "query" --profile free    # No paid providers
./target/release/do-wdr resolve "query" --profile fast    # Low latency
./target/release/do-wdr resolve "query" --profile quality # Best results

# Skip providers
./target/release/do-wdr resolve "query" --skip exa_mcp,exa

# AI synthesis from multiple providers
./target/release/do-wdr resolve "query" --synthesize

# Metrics output
./target/release/do-wdr resolve "query" --metrics-json

# List available providers
./target/release/do-wdr providers

# Show current config
./target/release/do-wdr config
```

### Web UI

```bash
# Development
cd web && npm run dev
# Open http://localhost:3000

# Production
# https://web-eight-ivory-29.vercel.app
```

The web UI provides a browser-based interface with:
- Collapsible configuration sidebar (profile, providers, advanced options)
- Profile-based provider selection with visual active indicators
- Collapsible API keys section for paid providers
- All UI state persisted to localStorage (sidebar, profile, providers, options)
- Text input for URLs or search queries
- Card-based result display with per-link copy/open actions plus a raw markdown toggle
- Inline toggles for deep research, skip cache, and max character presets
- Dark mode support
- Help & FAQ page (`/help`)
- PWA support for installable app

## How It Works

### Query Resolution Cascade

```
Query Input
    |
    v
+-------------------------------------------------------------+
| 1. Exa MCP Search (FREE - no API key required!)             |
|    - Uses Model Context Protocol at https://mcp.exa.ai/mcp  |
|    - JSON-RPC 2.0 over HTTP POST                            |
|    - Rate limit handling: 30s cooldown                      |
|    - On error: continue to next provider                    |
+-------------------------------------------------------------+
    | (fail)
    v
+-------------------------------------------------------------+
| 2. Exa SDK Search (if EXA_API_KEY set)                      |
|    - Uses highlights for token-efficient results            |
|    - Rate limit handling: 60s cooldown                      |
|    - On error: continue to next provider                    |
+-------------------------------------------------------------+
    | (fail/unavailable)
    v
+-------------------------------------------------------------+
| 3. Tavily Search (if TAVILY_API_KEY set)                    |
|    - Comprehensive search results                           |
|    - Rate limit handling: 60s cooldown                      |
|    - On error: continue to next provider                    |
+-------------------------------------------------------------+
    | (fail/unavailable)
    v
+-------------------------------------------------------------+
| 4. Serper Search (if SERPER_API_KEY set)                    |
|    - Google search results via Serper API                   |
|    - 2500 free credits                                      |
|    - Rate limit handling: 60s cooldown                      |
|    - On error: continue to next provider                    |
+-------------------------------------------------------------+
    | (fail/unavailable)
    v
+-------------------------------------------------------------+
| 5. DuckDuckGo Search (FREE - no API key required!)          |
|    - Completely free, no authentication needed              |
|    - Rate limit handling: 30s cooldown                      |
|    - Always available as fallback                           |
+-------------------------------------------------------------+
    | (fail)
    v
+-------------------------------------------------------------+
| 6. Mistral Web Search (if MISTRAL_API_KEY set)              |
|    - Uses Mistral chat API with web search                  |
|    - Free tier available                                    |
|    - Rate limit handling: 60s cooldown                      |
+-------------------------------------------------------------+
    | (fail/unavailable)
    v
+-------------------------------------------------------------+
| 7. Return Error                                             |
|    - source: "none"                                         |
|    - error: "No resolution method available"                |
+-------------------------------------------------------------+
```

### URL Resolution Cascade

```
URL Input
    |
    v
+-------------------------------------------------------------+
| 1. Check for llms.txt                                       |
|    - Probe: https://origin/llms.txt                         |
|    - If found: return structured documentation              |
|    - FREE - no API key required                             |
|    - Cached per origin (1-hour TTL)                         |
+-------------------------------------------------------------+
    | (not found)
    v
+-------------------------------------------------------------+
| 2. Jina Reader (FREE - https://r.jina.ai/<url>)             |
|    - No API key required, 20 RPM free tier                  |
|    - Returns clean markdown for any public URL              |
|    - Rate limit handling: 60s cooldown                      |
+-------------------------------------------------------------+
    | (fail)
    v
+-------------------------------------------------------------+
| 3. Firecrawl Extraction (if FIRECRAWL_API_KEY set)          |
|    - Deep content extraction with markdown output           |
|    - Rate limit handling: 60s cooldown                      |
|    - On rate limit/quota: fallback to next provider         |
|    - On auth error: return None                             |
+-------------------------------------------------------------+
    | (fail/unavailable)
    v
+-------------------------------------------------------------+
| 4. Direct HTTP Fetch                                        |
|    - Basic content extraction from HTML                     |
|    - FREE - no API key required                             |
+-------------------------------------------------------------+
    | (fail)
    v
+-------------------------------------------------------------+
| 5. Mistral Browser (if MISTRAL_API_KEY set)                 |
|    - Uses Mistral agent with web browsing capability        |
|    - Free tier available                                    |
|    - Rate limit handling: 60s cooldown                      |
+-------------------------------------------------------------+
    | (fail/unavailable)
    v
+-------------------------------------------------------------+
| 6. DuckDuckGo Search (fallback)                             |
|    - Search for the URL as a query                          |
|    - FREE - no API key required                             |
+-------------------------------------------------------------+
    | (fail)
    v
+-------------------------------------------------------------+
| 7. Return Error                                             |
|    - source: "none"                                         |
|    - error: "No resolution method available"                |
+-------------------------------------------------------------+
```

## Error Handling & Self-Learning

The resolver automatically handles:

- **Rate Limits**: Detects 429 errors and falls back to next source
- **No Credits**: Catches "no credits" errors and uses free alternatives
- **Network Errors**: Graceful degradation through the cascade
- **Invalid Responses**: Validates content before returning
- **Missing API Keys**: Skips paid services when keys not configured
- **Circuit Breakers**: Per-provider failure tracking with cooldowns
- **Negative Cache**: TTL-based cache of failed provider/target pairs
- **Routing Memory**: Per-domain provider success rate learning

## Testing

### Python

```bash
# Unit tests (no API keys needed)
python -m pytest tests/ -v -m "not live"

# Live integration tests (requires API keys)
python -m pytest tests/ -m live -v

# With coverage
python -m pytest --cov=scripts tests/
```

### Rust CLI

```bash
cd cli && cargo test

# Lint
cd cli && cargo clippy -- -D warnings && cargo fmt --check
```

### Web UI

```bash
cd web && npx playwright test --project=desktop

# With UI
cd web && npx playwright test --ui
```

### Quality Gate (All Checks)

```bash
./scripts/quality_gate.sh
```

## Repository Structure

```
do-web-doc-resolver/
├── AGENTS.md              # Agent instructions
├── README.md              # This file
├── scripts/
│   ├── resolve.py         # Main Python resolver
│   ├── quality_gate.sh    # Pre-commit quality checks
│   └── setup-hooks.sh     # Git hook installer
├── cli/                   # Rust CLI (do-wdr binary)
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs        # Entry point
│       ├── cli.rs         # Clap CLI definition
│       ├── config.rs      # Config loading (TOML + env)
│       ├── resolver/       # Cascade orchestrator
│       ├── providers/     # 13 provider modules
│       └── ...            # quality, metrics, synthesis, etc.
├── web/                   # Next.js web UI (Vercel)
│   ├── app/
│   │   ├── page.tsx       # Resolver form
│   │   └── help/page.tsx  # Help & FAQ
│   ├── tests/e2e/         # Playwright E2E tests
│   └── vercel.json        # Deployment config
├── tests/                 # Python test suite
├── .agents/skills/        # Canonical skill definitions
│   └── do-web-doc-resolver/
│       ├── SKILL.md       # Main skill file
│       └── references/    # Detailed reference docs
│           ├── CASCADE.md  # Full cascade decision trees
│           ├── PROVIDERS.md # Provider API details
│           ├── CLI.md      # CLI usage reference
│           ├── RUST_CLI.md # Rust CLI architecture
│           ├── TESTING.md  # Test structure
│           └── CONFIG.md   # Config reference
└── .github/workflows/     # CI/CD pipelines
```

## Related Files

- [`AGENTS.md`](AGENTS.md) - Agent instructions
- [`.agents/skills/do-web-doc-resolver/`](.agents/skills/do-web-doc-resolver/) - Skill definition and reference docs
- [`scripts/resolve.py`](scripts/resolve.py) - Python resolver source
- [`cli/src/`](cli/src/) - Rust CLI source

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Run `./scripts/quality_gate.sh` before submitting
5. Submit a pull request

## Assets & Screenshots

Screenshots and visual assets are stored in `assets/screenshots/`. See [assets/README.md](./assets/README.md) for details.

### Capturing Screenshots

```bash
# Capture for current version
./scripts/capture/capture-release.sh

# Capture for specific version
./scripts/capture/capture-release.sh 1.0.0

# Capture resolution flow
./scripts/capture/capture-flow.sh resolve

# Capture responsive views
./scripts/capture/capture-responsive.sh
```

## License

MIT License - see LICENSE file for details.

## Support

For issues, questions, or feature requests, please [open an issue](https://github.com/d-oit/do-web-doc-resolver/issues).

---

**Note**: This project prioritizes cost-efficiency and graceful degradation. It works perfectly fine with zero API keys configured, using only free sources (Exa MCP, llms.txt, DuckDuckGo). API keys enhance functionality but are not required. The Rust CLI and Web UI provide fast native and browser-based interfaces to the same resolver core.
