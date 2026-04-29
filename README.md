<div align="center">

<img src="assets/logo.png" alt="do-web-doc-resolver logo" width="320"/>

# do-web-doc-resolver

**Low-cost provider cascade for resolving queries and URLs into clean Markdown.**
Zero-config by default: works without API keys using free sources like Exa MCP, llms.txt, and DuckDuckGo.

[![CI](https://github.com/d-oit/do-web-doc-resolver/actions/workflows/ci.yml/badge.svg)](https://github.com/d-oit/do-web-doc-resolver/actions)
[![Release](https://img.shields.io/github/v/release/d-oit/do-web-doc-resolver?color=6366f1&label=release)](https://github.com/d-oit/do-web-doc-resolver/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-06b6d4.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10%2B-3776ab?logo=python&logoColor=white)](https://www.python.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[**Live Demo**](https://do-web-doc-resolver.vercel.app) · [**Documentation**](docs/) · [**Report Bug**](https://github.com/d-oit/do-web-doc-resolver/issues) · [**Request Feature**](https://github.com/d-oit/do-web-doc-resolver/issues)

</div>

---

## Why do-web-doc-resolver?

- **Zero-config mode**: Functions immediately using free providers without requiring API keys.
- **Self-healing**: Employs circuit breakers and per-domain routing memory to handle provider failures.
- **LLM-optimized**: Produces compact, deduplicated Markdown with YAML frontmatter and structural anchors.
- **Multi-interface**: Unified core accessible via Python library, Rust CLI, and Next.js Web UI.

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/d-oit/do-web-doc-resolver.git
cd do-web-doc-resolver
pip install -r requirements.txt

# Resolve a URL
python scripts/resolve.py "https://docs.python.org/3/library/ast.html"

# Resolve a search query
python scripts/resolve.py "how to use python ast module"
```

---

## Architecture

### Provider Cascade

The resolver detects input types and executes a free-first cascade to minimize cost while maintaining quality.

#### Query Resolution
1. **Semantic Cache**: Instant retrieval of previously resolved concepts.
2. **Exa MCP**: Free JSON-RPC search.
3. **Exa SDK**: Advanced search (requires `EXA_API_KEY`).
4. **Tavily / Serper**: Comprehensive search fallbacks.
5. **DuckDuckGo**: General web search fallback.
6. **Mistral Web Search**: LLM-powered search agent.

#### URL Resolution
1. **llms.txt**: Probes for structured LLM-ready documentation.
2. **Jina Reader**: Fast Markdown extraction from public URLs.
3. **Firecrawl**: Deep extraction for complex or JS-heavy sites.
4. **Direct Fetch**: Local HTML-to-Markdown fallback.
5. **Docling / OCR**: Handles PDFs and images.
6. **Mistral Browser**: AI-powered browsing for dynamic content.

---

## Installation

### Python Resolver
```bash
pip install -r requirements.txt
```

### Rust CLI (do-wdr)
```bash
cd cli
cargo build --release
# Binary location: cli/target/release/do-wdr
```

### Web UI (Next.js)
```bash
cd web
npm install
npm run dev
```

---

## Configuration

All API keys are optional. The tool defaults to free providers if keys are missing.

| Variable | Provider | Description |
|---|---|---|
| `EXA_API_KEY` | Exa | High-quality neural search |
| `TAVILY_API_KEY` | Tavily | Specialized LLM search |
| `SERPER_API_KEY` | Serper | Google Search API |
| `FIRECRAWL_API_KEY` | Firecrawl | Web scraping and crawling |
| `MISTRAL_API_KEY` | Mistral | Synthesis and agentic browsing |

---

## Testing

### Python
```bash
# Run unit tests
python -m pytest tests/ -v -m "not live"

# Run all tests (requires API keys)
python -m pytest tests/ -v
```

### Rust
```bash
cd cli && cargo test
```

### Web
```bash
cd web && npx playwright test --project=desktop
```

### Full Quality Gate
```bash
./scripts/quality_gate.sh
```

---

## Repository Structure

```
do-web-doc-resolver/
├── scripts/               # Core Python resolution logic
├── cli/                   # Rust-based CLI and Design System
├── web/                   # Next.js frontend (Vercel)
├── tests/                 # Python test suite
├── docs/                  # Documentation standards and examples
├── agents-docs/           # Extended documentation for agents
├── .agents/skills/        # Reusable agent skills
└── assets/                # Logos and screenshots
```

---

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feat/my-feature`).
3. Ensure all checks pass: `./scripts/quality_gate.sh`.
4. Submit a pull request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**Note**: This project prioritizes cost-efficiency. It functions without API keys using free sources (Exa MCP, llms.txt, DuckDuckGo). API keys enhance results but are not required for core functionality.
