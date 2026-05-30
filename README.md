# do-web-doc-resolver

Resolve queries or URLs into compact, LLM-ready Markdown using an intelligent, low-cost provider cascade.

## Purpose

The Web Doc Resolver turns unstructured web content into high-density Markdown optimized for LLM consumption. It uses a tiered cascade to prioritize free or low-cost data sources before falling back to paid APIs.

## Installation

### Python

Python 3.10 or higher is required.

```bash
pip install -r requirements.txt
```

### Rust CLI

```bash
cd cli
cargo build --release
# Binary available at cli/target/release/do-wdr
```

### Web UI

```bash
cd web
npm install --legacy-peer-deps
```

## Execution

### Python API

```python
from scripts.resolve import resolve
result = resolve("https://example.com")
print(result["content"])
```

### Python CLI

```bash
python -m scripts.cli "search query"
```

### Rust CLI

```bash
./cli/target/release/do-wdr resolve "https://example.com"
```

### Web UI

```bash
cd web
npm run dev
```

## Resolution Cascades

### Query Resolution

1. **Semantic Cache**: In-memory similarity lookup.
2. **Exa MCP**: Free search via Model Context Protocol.
3. **Exa SDK**: Search with highlights (requires `EXA_API_KEY`).
4. **Tavily**: Broad search (requires `TAVILY_API_KEY`).
5. **Serper**: Google search (requires `SERPER_API_KEY`).
6. **DuckDuckGo**: Free fallback search.
7. **Mistral**: AI-powered search (requires `MISTRAL_API_KEY`).

### URL Resolution

1. **Semantic Cache**: Exact URL match lookup.
2. **llms.txt**: Native documentation format probe.
3. **Jina Reader**: Clean Markdown extraction.
4. **Firecrawl**: Deep content extraction (requires `FIRECRAWL_API_KEY`).
5. **Direct HTTP Fetch**: Basic HTML extraction.
6. **Mistral Browser**: AI-powered browsing (requires `MISTRAL_API_KEY`).
7. **DuckDuckGo**: Search fallback for the URL.

## Environment Variables

API keys are optional. The tool defaults to free providers if keys are missing.

| Variable | Provider |
|---|---|
| `EXA_API_KEY` | Exa SDK |
| `TAVILY_API_KEY` | Tavily Search |
| `SERPER_API_KEY` | Serper (Google) |
| `FIRECRAWL_API_KEY` | Firecrawl Extraction |
| `MISTRAL_API_KEY` | Mistral AI |

## Testing

### Python Suite

```bash
python -m pytest tests/ -v -m "not live"
```

### Rust Suite

```bash
cd cli && cargo test
```

### Web UI Suite

```bash
cd web && npx playwright test --project=desktop
```

### Full Quality Gate

```bash
./scripts/quality_gate.sh
```
