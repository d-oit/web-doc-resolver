# Development Guide

This guide covers development workflows, tools, and best practices.

## Prerequisites

- Python 3.10+
- Node.js 18+
- Rust stable (for CLI development)
- Git

## Setup

### Python Environment

```bash
# Install dependencies
pip install -r requirements.txt

# Install development tools
pip install pytest pytest-asyncio pytest-cov ruff black mypy
```

### Rust CLI

```bash
cd cli
cargo build --release
# Binary: cli/target/release/wdr
```

### Web UI

```bash
cd web
npm install
npx playwright install chromium
```

### Git Hooks

```bash
# Setup pre-commit hooks
./scripts/setup-hooks.sh
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

## Development Workflow

### 1. Python Development

```bash
# Run tests
python -m pytest tests/ -v -m "not live"

# Run with coverage
python -m pytest tests/ -v -m "not live" --cov=scripts --cov-report=html

# Lint and format
ruff check scripts/
black scripts/

# Type checking
mypy scripts/
```

### 2. Rust CLI Development

```bash
cd cli

# Build
cargo build

# Run tests
cargo test

# Lint
cargo clippy -- -D warnings
cargo fmt --check

# Release build
cargo build --release
```

### 3. Web UI Development

```bash
cd web

# Development server
npm run dev

# Build
npm run build

# Run E2E tests
npx playwright test --project=desktop
```

## Testing

### Test Categories

1. **Unit tests**: No external dependencies
2. **Integration tests**: May require some API keys
3. **Live tests**: Require API keys and network

### Running Tests

```bash
# Python unit tests (no API keys)
python -m pytest tests/ -v -m "not live"

# Python live tests (requires API keys)
python -m pytest tests/ -m live -v

# Rust tests
cd cli && cargo test

# Web E2E tests
cd web && npx playwright test --project=desktop

# Quality gate (all checks)
./scripts/quality_gate.sh
```

## Code Style

### Python

- Python 3.10+, async/await throughout
- `ruff` for linting, `black` for formatting
- Type hints on all public functions
- Maximum 500 lines per file
- Docstrings on all public functions and classes

### Rust

- Rust stable, edition 2021
- `cargo fmt` + `cargo clippy -- -D warnings`
- Maximum 500 lines per file
- Each provider in its own module
- Errors via `thiserror`, propagation via `anyhow`

### Web (Next.js)

- Next.js 15 + React 19, App Router
- Tailwind CSS v4 (CSS-first config)
- TypeScript strict mode
- Playwright for E2E tests
- Shared key utility in `web/lib/keys.ts` (imported by page.tsx and settings/page.tsx)
- `react-markdown` for result preview toggle

### Commits

- Conventional commits: `feat:`, `fix:`, `docs:`, `ci:`, `test:`, `refactor:`
- Scope in parens where relevant: `feat(cli):`, `fix(exa_mcp):`

## Configuration

### Environment Variables

Set API keys as needed:
```bash
export EXA_API_KEY="your_key"
export TAVILY_API_KEY="your_key"
export SERPER_API_KEY="your_key"
export FIRECRAWL_API_KEY="your_key"
export MISTRAL_API_KEY="your_key"
```

### Config File

Edit `cli/config.toml` for default settings.

## Debugging

### Python

```bash
# Enable debug logging
export WDR_LOG_LEVEL=DEBUG
export WDR_DEBUG=true

# Run with verbose output
python -m scripts.resolve "query" --log-level DEBUG
```

### Rust

```bash
# Build with debug symbols
cargo build

# Run with debug output
RUST_LOG=debug ./target/debug/wdr resolve "query"
```

## Performance

### Profiling Python

```bash
# Use cProfile
python -m cProfile -o profile.prof -m scripts.resolve "query"

# Analyze with snakeviz
snakeviz profile.prof
```

### Profiling Rust

```bash
# Use cargo flamegraph
cargo flamegraph --bin wdr -- resolve "query"
```

## CI/CD

### GitHub Actions

- Runs on push and pull requests
- Tests Python, Rust, and Web
- Validates skill symlinks
- Runs quality gate

### Quality Gate

```bash
# Run all checks
./scripts/quality_gate.sh

# Includes:
# - Python linting and formatting
# - Rust clippy and fmt
# - Python tests
# - Rust tests
# - Symlink validation
```

## Troubleshooting

### Common Issues

1. **API key not found**: Check environment variables
2. **Provider timeout**: Check network connectivity
3. **Rate limit exceeded**: Wait or use different provider
4. **Import errors**: Check Python path and dependencies

### Getting Help

1. Check logs (stderr for errors)
2. Enable debug mode
3. Run tests to isolate issue
4. Check provider status pages

## Lessons Learned

### Vercel Monorepo Setup
When the Next.js app lives in a subdirectory (`web/`), set the Vercel project's `rootDirectory` via API:
```bash
curl -X PATCH "https://api.vercel.com/v9/projects/{PROJECT_ID}?teamId={TEAM_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rootDirectory":"web"}'
```
Do NOT use `rootDirectory` in a root `vercel.json` — it's not valid there. The setting must be on the Vercel project.

### E2E Test Reliability
- Use `data-testid` attributes for Playwright selectors instead of text-based filters
- Server-side state persistence (localStorage/server sync) can break tests that depend on initial UI state
- E2E tests against stale production deployments will fail — always deploy first or use preview URLs

### Binary Name vs Crate Name
Cargo.toml supports separate names:
- `[package].name` = crate name on crates.io (e.g., `do-wdr`)
- `[[bin]].name` = output binary name (e.g., `wdr`)
This allows short command names while having unique crate names.

### Vercel Production Alias
To point production URL to a specific deployment:
```bash
vercel alias set <deployment-url> <production-domain>
```
Useful when promoting preview deployments to production.
