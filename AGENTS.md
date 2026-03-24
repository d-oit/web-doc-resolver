# AGENTS.md

> **do-web-doc-resolver** — resolves queries or URLs into compact, LLM-ready markdown via a low-cost provider cascade.
> Full detail docs live in [`.agents/skills/do-web-doc-resolver/`](.agents/skills/do-web-doc-resolver/). See [agents.md](https://agents.md) for spec.

## Setup commands

```bash
# Python (primary skill)
pip install -r requirements.txt

# Rust CLI (wdr binary)
cd cli && cargo build --release
# Binary: cli/target/release/wdr

# Web UI (Next.js + Playwright)
cd web && npm install && npx playwright install chromium

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

# Web E2E tests (against deployed Vercel URL)
cd web && npx playwright test --project=desktop

# Quality gate (all checks)
./scripts/quality_gate.sh
```

## Disk space

```bash
# Remove debug build artifacts (~4.9 GB) — keeps release binary
rm -rf cli/target/debug/
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

### Web (Next.js)
- Next.js 15 + React 19, App Router
- Tailwind CSS v4 (CSS-first config in `globals.css`, **requires `postcss.config.mjs`**)
- TypeScript strict mode
- Playwright for E2E tests (`web/tests/e2e/`)
- Deployment via Vercel Git integration (push to `main` → auto-deploy)
- `NEXT_PUBLIC_RESOLVER_URL` env var controls the backend endpoint (defaults to `http://localhost:8000`)

### Commits
- Conventional commits: `feat:`, `fix:`, `docs:`, `ci:`, `test:`, `refactor:`
- Scope in parens where relevant: `feat(cli):`, `fix(exa_mcp):`

## Repository structure

```
do-web-doc-resolver/
├── AGENTS.md              # This file (agent instructions, <150 lines)
├── README.md              # Human-readable docs
├── scripts/
│   ├── resolve.py         # Main Python resolver (<500 LOC)
│   ├── quality_gate.sh    # Pre-commit quality checks
│   ├── pre-commit-hook.sh # Git hook for quality gate
│   └── capture/           # Screenshot capture scripts
│       ├── capture-release.sh
│       ├── capture-flow.sh
│       └── capture-responsive.sh
├── cli/                   # Rust CLI (wdr binary)
│   ├── Cargo.toml
│   └── src/
├── web/                   # Next.js web UI (Vercel deployed)
│   ├── app/               # App Router pages & layout
│   ├── tests/e2e/         # Playwright E2E tests
│   ├── playwright.config.ts
│   ├── postcss.config.mjs # REQUIRED for Tailwind v4
│   └── vercel.json
├── tests/                 # Python test suite
├── assets/                # Visual assets
│   └── screenshots/       # Screenshot images
├── .agents/skills/        # Canonical skill definitions
│   ├── do-web-doc-resolver/  # Python resolver skill
│   ├── wdr-cli/           # Rust CLI skill
│   └── wdr-assets/        # Screenshot/asset skill
├── .blackbox/skills/      # Skill symlinks (Blackbox)
├── .claude/skills/        # Skill symlinks (Claude)
├── .opencode/skills/      # Skill symlinks (OpenCode)
├── agents-docs/            # Reference docs for AGENTS.md
└── .github/workflows/     # CI/CD (ci.yml, release.yml)
```

## Cascade overview

The resolver auto-detects URL vs query and runs a free-first cascade. See [`.agents/skills/do-web-doc-resolver/references/CASCADE.md`](.agents/skills/do-web-doc-resolver/references/CASCADE.md) for the full decision tree.

| Input type | Cascade order |
|---|---|
| **Query** | Exa MCP (free) → Exa SDK → Tavily → Serper → DuckDuckGo (free) → Mistral |
| **URL** | llms.txt (free) → Jina (free) → Firecrawl → Direct fetch (free) → Mistral browser → DuckDuckGo |

Skip providers: `--skip exa_mcp --skip exa` — see [`.agents/skills/do-web-doc-resolver/references/CLI.md`](.agents/skills/do-web-doc-resolver/references/CLI.md).

## Environment variables (all optional)

| Variable | Provider | Notes |
|---|---|---|
| `EXA_API_KEY` | Exa SDK | Exa MCP is free and runs first |
| `TAVILY_API_KEY` | Tavily | Optional comprehensive search |
| `SERPER_API_KEY` | Serper | Google search (2500 free credits) |
| `FIRECRAWL_API_KEY` | Firecrawl | Optional deep extraction |
| `MISTRAL_API_KEY` | Mistral | Optional AI-powered fallback |

Exa MCP, Jina Reader, DuckDuckGo, and direct fetch are always available — **no API key required**.
See [`.agents/skills/do-web-doc-resolver/references/CONFIG.md`](.agents/skills/do-web-doc-resolver/references/CONFIG.md) for full config reference including `cli/config.toml`.

## Security

- Never commit API keys; use environment variables or `.env` (gitignored)
- Never include email addresses in code, configs, or documentation (see `privacy-first` skill)
- Report vulnerabilities via GitHub private advisories (see `SECURITY.md`)
- Rate limit state is persisted to avoid unintentional API hammering

## Skill symlink validation

All skills are defined in `.agents/skills/` (canonical source).
Symlinks in `.blackbox/skills/`, `.claude/skills/`, and `.opencode/skills/` are directory-level symlinks to `.agents/skills/` — no per-skill management needed.

```
.agents/skills/           # Canonical skill definitions (directories)
.blackbox/skills/         # Symlink → ../.agents/skills
.claude/skills/           # Symlink → ../.agents/skills
.opencode/skills/         # Symlink → ../.agents/skills
```

Validated on every commit (pre-commit hook) and in CI (`validate-symlink` job).
Manual check: `python scripts/validate_skill_symlink.py`

## More detail

| Topic | File |
|---|---|
| Full cascade logic | [`.agents/skills/do-web-doc-resolver/references/CASCADE.md`](.agents/skills/do-web-doc-resolver/references/CASCADE.md) |
| All providers & rate limits | [`.agents/skills/do-web-doc-resolver/references/PROVIDERS.md`](.agents/skills/do-web-doc-resolver/references/PROVIDERS.md) |
| CLI usage (Python + Rust) | [`.agents/skills/do-web-doc-resolver/references/CLI.md`](.agents/skills/do-web-doc-resolver/references/CLI.md) |
| Rust CLI architecture | [`.agents/skills/do-web-doc-resolver/references/RUST_CLI.md`](.agents/skills/do-web-doc-resolver/references/RUST_CLI.md) |
| Test structure & markers | [`.agents/skills/do-web-doc-resolver/references/TESTING.md`](.agents/skills/do-web-doc-resolver/references/TESTING.md) |
| Config & env vars | [`.agents/skills/do-web-doc-resolver/references/CONFIG.md`](.agents/skills/do-web-doc-resolver/references/CONFIG.md) |

## Project Documentation

| Topic | File |
|---|---|
| Project overview | [`agents-docs/OVERVIEW.md`](agents-docs/OVERVIEW.md) |
| Development guide | [`agents-docs/DEVELOPMENT.md`](agents-docs/DEVELOPMENT.md) |
| Deployment guide | [`agents-docs/DEPLOYMENT.md`](agents-docs/DEPLOYMENT.md) |

## Skills

| Skill | Location | Description |
|---|---|---|
| do-web-doc-resolver | `.agents/skills/do-web-doc-resolver/` | Python resolver with cascade |
| wdr-cli | `.agents/skills/wdr-cli/` | Rust CLI (wdr binary) |
| wdr-assets | `.agents/skills/wdr-assets/` | Screenshots & visual assets |
| wdr-release | `.agents/skills/wdr-release/` | Release management & Git/GitHub best practices |

## Assets

Screenshots and visual assets are stored in `assets/screenshots/`. See [`assets/README.md`](./assets/README.md) for details.

```bash
# Capture screenshots for release
./scripts/capture/capture-release.sh <version>
```

## Releases

Releases follow [Semantic Versioning](https://semver.org/) with conventional commits.

```bash
# Patch release (0.1.0 → 0.1.1)
./scripts/release.sh patch

# Minor release (0.1.1 → 0.2.0)
./scripts/release.sh minor

# Major release (0.2.0 → 1.0.0)
./scripts/release.sh major

# Specific version
./scripts/release.sh 1.2.3

# Generate changelog
./scripts/changelog.sh v0.2.0
```

See [`wdr-release` skill](.agents/skills/wdr-release/SKILL.md) for full release workflow.

## Deployment (Vercel)

Deployment is automatic via Vercel Git integration — push to `main` and Vercel builds and deploys.

| Setting | Value |
|---------|-------|
| **Production URL** | `https://web-eight-ivory-29.vercel.app/` |
| **Project ID** | `prj_jzHZ0Rc3ilkcmjk7YlHA2NbSJ0lS` |
| **Framework** | Next.js |
| **Deploy trigger** | Push to `main` branch |

### Local Testing (Vercel CLI)

Vercel CLI is for local development only — **not** used in CI/CD.

```bash
cd web
vercel link          # One-time: link to project
vercel pull --yes    # Pull env vars locally
vercel dev           # Local dev server
vercel build --prod  # Verify production build
```

### GitHub Actions

CI runs test/lint/build verification only — no deploy jobs.
Vercel handles deployment automatically via Git integration.

```bash
# CI checks (ci.yml)
- Skill symlink validation
- Python tests + lint
- Rust tests + clippy + fmt
- Web build + lint

# Release checks (release.yml)
- Python + Rust tests
- Build binaries (Linux, macOS, Windows)
- Create GitHub Release
```
