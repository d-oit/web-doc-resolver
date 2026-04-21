# AGENTS.md

> **do-web-doc-resolver** — resolves queries or URLs into markdown via a low-cost provider cascade.
> Docs in [`.agents/skills/do-web-doc-resolver/`](.agents/skills/do-web-doc-resolver/). See [agents.md](https://agents.md) for spec.

## Setup & Tests

```bash
# Setup
pip install -r requirements.txt
cd cli && cargo build --release
cd web && npm install && npx playwright install chromium

# Run tests
python -m pytest tests/ -v -m "not live"
cd cli && cargo test
cd web && npx playwright test --project=desktop
./scripts/quality_gate.sh
```

## Code style

### Python
- Python 3.10+, async/await throughout, `ruff` + `black`
- Type hints + docstrings required on all public functions
- **Maximum 500 lines per source file** — split into sub-modules if exceeded

### Rust (CLI)
- Rust stable, edition 2024, `cargo fmt` + `clippy -- -D warnings`
- **Maximum 500 lines per source file** — split into sub-modules if exceeded
- Errors via `thiserror`, propagation via `anyhow`

### Web (Next.js)
- Next.js 16 + React 19, Tailwind CSS v4, TypeScript strict mode
- Playwright for E2E tests (`web/tests/e2e/`)
- Deployment via Vercel Git integration (push to `main`)
- Treat grouped npm major updates as high-risk; land them as isolated PRs only after `cd web && npm run lint && npm run build` passes.

## Repository structure

```
./
├── AGENTS.md              # This file (<150 lines)
├── README.md              # Human-readable docs
├── scripts/               # Python logic
├── cli/                   # Rust CLI (do-wdr)
├── web/                   # Next.js web UI
├── tests/                 # Python test suite
├── .agents/skills/        # Canonical skill definitions
└── agents-docs/           # Reference docs for AGENTS.md
```

## Cascade & Security

- Auto-detects URL vs query; runs free-first cascade.
- See [CASCADE.md](.agents/skills/do-web-doc-resolver/references/CASCADE.md).
- Never commit API keys; use env vars.
- No emails in code (see `privacy-first` skill).
- Rate limit state is persisted.

## Project Documentation

| Topic | File |
|---|---|
| Development guide | [`agents-docs/DEVELOPMENT.md`](agents-docs/DEVELOPMENT.md) |
| Configuration | [`agents-docs/CONFIG.md`](agents-docs/CONFIG.md) |
| Deployment guide | [`agents-docs/DEPLOYMENT.md`](agents-docs/DEPLOYMENT.md) |
| Releases | [`agents-docs/RELEASES.md`](agents-docs/RELEASES.md) |
| Assets & Screenshots | [`agents-docs/ASSETS.md`](agents-docs/ASSETS.md) |
| Project overview | [`agents-docs/OVERVIEW.md`](agents-docs/OVERVIEW.md) |
| CI triage heuristics | [`.agents/skills/do-github-pr-sentinel/references/heuristics.md`](.agents/skills/do-github-pr-sentinel/references/heuristics.md) |

## Known Issues

See [CHANGELOG.md](CHANGELOG.md) for current known issues:

| Issue | Description | Status |
|-------|-------------|--------|
| [#251](https://github.com/d-oit/do-web-doc-resolver/issues/251) | Python semantic cache sqlite-vec compatibility | Open |
| [#252](https://github.com/d-oit/do-web-doc-resolver/issues/252) | Deprecated `get_sentence_embedding_dimension` API | Fixed |
| [#253](https://github.com/d-oit/do-web-doc-resolver/issues/253) | Rust semantic-cache security alerts (upstream) | Open |
| [#255](https://github.com/d-oit/do-web-doc-resolver/issues/255) | Dependabot vulnerabilities pending review | Open |
| [#256](https://github.com/d-oit/do-web-doc-resolver/issues/256) | Release workflow out-of-order merge handling | Open |
| [#259](https://github.com/d-oit/do-web-doc-resolver/issues/259) | Python URL resolver needs quality threshold fallback | Open |
| [#260](https://github.com/d-oit/do-web-doc-resolver/issues/260) | Update duckduckgo_search to ddgs package | Fixed |

### Semantic Cache Workaround

Disable semantic cache in CI/tests:
```bash
DO_WDR_SEMANTIC_CACHE=0 python -m pytest tests/ -v -m "not live"
```

### Issue Resolution Workflow

**Full workflow before closing issues:**
1. Apply fix → 2. Dogfood/test → 3. Atomic commit → 4. Push → 5. PR → 6. CI must pass → 7. Merge → 8. Close issue → 9. Update docs/memory

**Do NOT close issues early.** An unmerged fix is not a fixed issue.

## Skills

| Skill | Location | Description |
|---|---|---|
| do-web-doc-resolver | `.agents/skills/do-web-doc-resolver/` | Python resolver with cascade |
| do-wdr-cli | `.agents/skills/do-wdr-cli/` | Rust CLI (do-wdr binary) |
| do-wdr-assets | `.agents/skills/do-wdr-assets/` | Screenshots & visual assets |
| do-wdr-release | `.agents/skills/do-wdr-release/` | Release management |
| do-wdr-ui-component | `.agents/skills/do-wdr-ui-component/` | CSS-only UI components |
| do-wdr-issue-swarm | `.agents/skills/do-wdr-issue-swarm/` | Parallel GitHub issue implementation |
| do-github-pr-sentinel | `.agents/skills/do-github-pr-sentinel/` | Monitor PRs until merged/blocked |
| agent-browser | `.agents/skills/agent-browser/` | Browser automation |
| privacy-first | `.agents/skills/privacy-first/` | Prevent personal data |
| skill-creator | `.agents/skills/skill-creator/` | Create and optimize skills |
| readme-best-practices | `.agents/skills/readme-best-practices/` | GitHub README best practices |
| anti-ai-slop | `.agents/skills/anti-ai-slop/` | Avoid generic AI aesthetic |
| vercel-cli | `.agents/skills/vercel-cli/` | Vercel CLI deployment |
