# AGENTS.md

> **web-doc-resolver** — resolves queries or URLs into compact, LLM-ready markdown via a low-cost provider cascade.
> Full detail docs live in [`agents-docs/`](./agents-docs/). See [agents.md](https://agents.md) for spec.

## Setup commands

```bash
# Python (primary skill)
pip install -r requirements.txt

# Rust CLI (wdr binary)
cd cli && cargo build --release
# Binary: cli/target/release/wdr

# Git hooks (validates skill symlink on commit + quality gate)
./scripts/setup-hooks.sh
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

## Run tests

```bash
# Python unit tests (no API keys needed)
python -m pytest tests/ -v -m "not live"

# Python live integration tests (requires API keys)
python -m pytest tests/ -m live -v

# Rust CLI tests
cd cli && cargo test

# Rust lint
cd cli && cargo clippy -- -D warnings && cargo fmt --check

# Quality gate (all checks)
./scripts/quality_gate.sh
```

## Code style

### Python
- Python 3.10+, async/await throughout
- `ruff` for linting, `black` for formatting
- Type hints required on all public functions
- **Maximum 500 lines per source file** — split into sub-modules if exceeded
- Docstrings on all public functions and classes

### Rust (CLI)
- Rust stable, edition 2021
- `cargo fmt` + `cargo clippy -- -D warnings` must pass
- **Maximum 500 lines per source file** — split into sub-modules if exceeded
- Each provider in its own module under `cli/src/providers/`
- Errors via `thiserror`, propagation via `anyhow`

### Commits
- Conventional commits: `feat:`, `fix:`, `docs:`, `ci:`, `test:`, `refactor:`
- Scope in parens where relevant: `feat(cli):`, `fix(exa_mcp):`

## Repository structure

```
web-doc-resolver/
├── AGENTS.md              # This file (agent instructions, <150 lines)
├── agents-docs/           # Detailed agent reference docs
│   ├── CASCADE.md         # Full cascade decision trees
│   ├── PROVIDERS.md       # Provider API details & rate limits
│   ├── CLI.md             # Python + Rust CLI usage reference
│   ├── RUST_CLI.md        # Rust CLI architecture & crate stack
│   ├── TESTING.md         # Test structure, markers, live vs unit
│   └── CONFIG.md          # Env vars, config.toml, layered config
├── SKILL.md               # agentskills.io skill definition
├── README.md              # Human-readable docs
├── scripts/resolve.py     # Main Python resolver (<500 LOC)
├── scripts/quality_gate.sh # Pre-commit quality checks
├── scripts/pre-commit-hook.sh # Git hook for quality gate
├── cli/                   # Rust CLI (wdr binary)
│   ├── Cargo.toml
│   └── src/
├── tests/                 # Python test suite
├── references/CASCADE.md  # Legacy → see agents-docs/CASCADE.md
├── .mcp.json              # MCP config for Claude Code / OpenCode
└── .github/workflows/     # CI/CD (ci.yml, release.yml)
```

## Cascade overview

The resolver auto-detects URL vs query and runs a free-first cascade. See [`agents-docs/CASCADE.md`](./agents-docs/CASCADE.md) for the full decision tree.

| Input type | Cascade order |
|---|---|
| **Query** | Exa MCP (free) → Exa SDK → Tavily → DuckDuckGo (free) → Mistral |
| **URL** | llms.txt (free) → Jina (free) → Firecrawl → Direct fetch (free) → Mistral browser → DuckDuckGo |

Skip providers: `--skip exa_mcp --skip exa` — see [`agents-docs/CLI.md`](./agents-docs/CLI.md).

## Environment variables (all optional)

| Variable | Provider | Notes |
|---|---|---|
| `EXA_API_KEY` | Exa SDK | Exa MCP is free and runs first |
| `TAVILY_API_KEY` | Tavily | Optional comprehensive search |
| `FIRECRAWL_API_KEY` | Firecrawl | Optional deep extraction |
| `MISTRAL_API_KEY` | Mistral | Optional AI-powered fallback |

Exa MCP, Jina Reader, DuckDuckGo, and direct fetch are always available — **no API key required**.
See [`agents-docs/CONFIG.md`](./agents-docs/CONFIG.md) for full config reference including `cli/config.toml`.

## Security

- Never commit API keys; use environment variables or `.env` (gitignored)
- Report vulnerabilities via GitHub private advisories (see `SECURITY.md`)
- Rate limit state is persisted to avoid unintentional API hammering

## Skill symlink validation

`.blackbox/skills/web-doc-resolver/SKILL.md` must symlink to root `SKILL.md`.
Validated on every commit (pre-commit hook) and in CI (`validate-symlink` job).
Manual check: `python scripts/validate_skill_symlink.py`

## More detail

| Topic | File |
|---|---|
| Full cascade logic | [`agents-docs/CASCADE.md`](./agents-docs/CASCADE.md) |
| All providers & rate limits | [`agents-docs/PROVIDERS.md`](./agents-docs/PROVIDERS.md) |
| CLI usage (Python + Rust) | [`agents-docs/CLI.md`](./agents-docs/CLI.md) |
| Rust CLI architecture | [`agents-docs/RUST_CLI.md`](./agents-docs/RUST_CLI.md) |
| Test structure & markers | [`agents-docs/TESTING.md`](./agents-docs/TESTING.md) |
| Config & env vars | [`agents-docs/CONFIG.md`](./agents-docs/CONFIG.md) |
