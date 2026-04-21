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
# Binary: cli/target/release/do-wdr
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

### Dependency Update Policy

- Treat grouped npm major bumps as compatibility work, not routine maintenance.
- Keep npm `major` updates isolated so CI failures point to one package family at a time.
- For any web dependency PR, validate `cd web && npm run lint && npm run build` before merge.
- If a grouped dependency PR fails deterministically, fix or split the dependency set instead of spending flaky-retry budget on CI reruns.

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
export DO_WDR_LOG_LEVEL=DEBUG
export DO_WDR_DEBUG=true

# Run with verbose output
python -m scripts.resolve "query" --log-level DEBUG
```

### Rust

```bash
# Build with debug symbols
cargo build

# Run with debug output
RUST_LOG=debug ./target/debug/do-wdr resolve "query"
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
cargo flamegraph --bin do-wdr -- resolve "query"
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

## Known Issues

### Python Semantic Cache (#251)

The sqlite-vec vec0 virtual table insert syntax is causing cache retrieval failures.

**Symptom**: `query()` returns None even after `store()` succeeds.

**Workaround**: Disable semantic cache in tests:
```bash
DO_WDR_SEMANTIC_CACHE=0 python -m pytest tests/ -v -m "not live"
```

**Investigation needed**: Verify vec0 schema and insert syntax compatibility with sqlite-vec 0.1.9.

### Deprecated sentence-transformers API (#252)

The `get_sentence_embedding_dimension()` method was deprecated in sentence-transformers 5.x.

**Location**: `scripts/semantic_cache.py:180`

**Status**: **Fixed** - Changed to `get_embedding_dimension()`.

### Rust semantic-cache security alerts (#253)

The optional `semantic-cache` feature pulls an upstream-constrained dependency chain with open Rust security alerts.

**Affected**: `chaotic_semantic_memory -> libsql` dependency chain

**Workaround**: Do not enable `semantic-cache` feature in production.

**Tracking**: Upstream issue `d-o-hub/chaotic_semantic_memory#88`

### DuckDuckGo package renamed

The `duckduckgo_search` package is now `ddgs`. This has been updated throughout the codebase.

## Issue Resolution Workflow

**Full workflow before closing GitHub issues:**

1. **Apply fix** - Make code changes
2. **Dogfood/test** - Run the actual feature/code to verify it works locally
3. **Atomic commit** - Single focused commit with conventional commit message
4. **Push branch** - Push to remote
5. **Create PR** - Open pull request
6. **Wait for CI** - All GitHub Actions must pass
7. **Merge PR** - Merge after CI green
8. **Close issue** - Only after merge is complete
9. **Update learnings** - Document what was learned in memory/CHANGELOG

**Do NOT close issues early.** An unmerged fix is not a fixed issue.

Example workflow:
```bash
# 1-2. Apply fix and test locally
python -c "from scripts.semantic_cache import SemanticCache; ..."

# 3. Atomic commit
git add scripts/semantic_cache.py
git commit -m "fix(cache): update deprecated sentence-transformers API"

# 4. Push
git push origin fix-semantic-cache-api

# 5. Create PR
gh pr create --title "Fix deprecated API" --body "Closes #252"

# 6. Wait for CI (use do-github-pr-sentinel skill)
gh pr checks <number> --watch

# 7. Merge after green
gh pr merge <number> --squash

# 8. Close issue (with evidence)
gh issue close 252 --comment "Verified, merged, CI passed."

# 9. Update docs/memory
# Edit CHANGELOG.md, AGENTS.md, etc.
```

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

### Dependency Compatibility Triage
- PR #224 showed that grouped npm major updates can surface upstream incompatibilities rather than repo code regressions.
- `eslint-config-next@16.2.3` currently fails under `eslint@10`, so keep ESLint on `^9.39.4` until the Next.js lint stack supports the new major.
- Evaluate `typescript@6` separately from lint-stack upgrades so type and tooling changes do not get conflated in one PR.

### E2E Test Reliability
- Use `data-testid` attributes for Playwright selectors instead of text-based filters
- Server-side state persistence (localStorage/server sync) can break tests that depend on initial UI state
- E2E tests against stale production deployments will fail — always deploy first or use preview URLs

### UI State + Provider Behavior
- Treat `/api/ui-state` as server-backed persistence (cookie-based) and `localStorage` as fallback; tests should mock both when asserting startup state
- Custom provider selections persist via `selectedProviders` and reload as `profile=custom`; avoid tests that assume profile defaults after a manual provider toggle
- If `exa_mcp` and `mistral` are both selected and a Mistral key exists, query normalization combines them into `exa_mcp_mistral` (not two independent provider runs)
- Automated browser validation can fail on protected Vercel preview links (auth gate/interstitial); use production URL or an unprotected preview URL for CI and scripted checks

### Binary Name vs Crate Name
Cargo.toml supports separate names:
- `[package].name` = crate name on crates.io (e.g., `do-wdr`)
- `[[bin]].name` = output binary name (e.g., `do-wdr`)
This allows short command names while having unique crate names.

### Vercel Production Alias
To point production URL to a specific deployment:
```bash
vercel alias set <deployment-url> <production-domain>
```
Useful when promoting preview deployments to production.
