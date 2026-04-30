# do-web-doc-resolver

Resolves search queries and URLs into Markdown documents. It uses a multi-stage cascade to prioritize free or low-cost extraction providers.

## Installation

### Python
```bash
pip install -r requirements.txt
```

### Rust CLI
```bash
cd cli
cargo build --release
```

### Web UI
```bash
cd web
npm install
```

## Usage

### Python
```bash
python scripts/resolve.py "https://docs.python.org/3/library/ast.html"
python scripts/resolve.py "how to use python ast module"
```

### Rust CLI
```bash
./cli/target/release/do-wdr "https://react.dev"
```

### Web UI
```bash
cd web && npm run dev
```

## Provider Cascade

The system selects providers based on input type and configured profile.

### Query Cascade
1. **Semantic Cache**: Local SQLite vector storage.
2. **Exa MCP**: Free search via JSON-RPC.
3. **Exa SDK**: Neural search (requires `EXA_API_KEY`).
4. **Tavily / Serper**: API-based search fallbacks.
5. **Mistral Web Search**: LLM-powered search agent.
6. **DuckDuckGo**: Unauthenticated search fallback.

### URL Cascade
1. **Semantic Cache**: Local result retrieval.
2. **llms.txt**: Probes for `/llms.txt` or `/llms-full.txt`.
3. **Jina Reader**: Markdown extraction service.
4. **Firecrawl**: Web scraping for JavaScript-heavy sites.
5. **Direct Fetch**: Local HTML parsing and conversion.
6. **Mistral Browser**: AI-powered browsing for dynamic content.
7. **Docling / OCR**: Processing for PDFs, Office documents, and images.

## Environment Variables

API keys are optional. The tool defaults to free providers if keys are omitted.

| Variable | Provider |
|---|---|
| `EXA_API_KEY` | Exa |
| `TAVILY_API_KEY` | Tavily |
| `SERPER_API_KEY` | Serper |
| `FIRECRAWL_API_KEY` | Firecrawl |
| `MISTRAL_API_KEY` | Mistral (Synthesis and Browser) |

## Testing

### Python
```bash
python -m pytest tests/ -v -m "not live"
```

### Rust
```bash
cd cli && cargo test
```

### Web
```bash
cd web && npx playwright test --project=desktop
```
