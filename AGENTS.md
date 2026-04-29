# AGENTS.md

> **do-web-doc-resolver** — resolves queries or URLs into clean Markdown via a low-cost provider cascade.
> See [agents.md](https://agents.md) for spec.

## Setup & Tests

```bash
# Setup
pip install -r requirements.txt
cd cli && cargo build --release
cd web && npm install && npx playwright install chromium

# Tests
./scripts/quality_gate.sh
python -m pytest tests/ -v -m "not live"
cd cli && cargo test
cd web && npx playwright test --project=desktop
```

## Coding Workflow

- **Branch naming**: `feat/`, `fix/`, `chore/`, `docs/`
- **Commit format**: Conventional Commits (`type(scope): description`)
- **File size limit**: 500 lines max per source file
- **PR Checklist**:
  - `scripts/quality_gate.sh` passes
  - Documentation updated for new features
  - AGENTS.md updated if project structure changes
  - No new secrets committed

## Repository Structure

```
./
├── scripts/               # Core Python logic
├── cli/                   # Rust CLI (do-wdr)
│   └── ui/                # Design system
├── web/                   # Next.js web UI
├── tests/                 # Python test suite
├── docs/                  # Standards & examples
├── agents-docs/           # Reference for agents
├── .agents/skills/        # Canonical skill definitions
└── assets/                # Visual assets
```

## Project Documentation

Refer to these files for detailed domain knowledge. Do not duplicate content.

| Topic | File |
|---|---|
| Development | [`agents-docs/DEVELOPMENT.md`](agents-docs/DEVELOPMENT.md) |
| Configuration | [`agents-docs/CONFIG.md`](agents-docs/CONFIG.md) |
| Deployment | [`agents-docs/DEPLOYMENT.md`](agents-docs/DEPLOYMENT.md) |
| Releases | [`agents-docs/RELEASES.md`](agents-docs/RELEASES.md) |
| Assets | [`agents-docs/ASSETS.md`](agents-docs/ASSETS.md) |
| Overview | [`agents-docs/OVERVIEW.md`](agents-docs/OVERVIEW.md) |
| Cascade | [`.agents/skills/do-web-doc-resolver/references/CASCADE.md`](.agents/skills/do-web-doc-resolver/references/CASCADE.md) |

## Skills

| Skill | Path |
|---|---|
| do-web-doc-resolver | `.agents/skills/do-web-doc-resolver/` |
| do-wdr-cli | `.agents/skills/do-wdr-cli/` |
| do-wdr-assets | `.agents/skills/do-wdr-assets/` |
| do-wdr-release | `.agents/skills/do-wdr-release/` |
| do-wdr-ui-component | `.agents/skills/do-wdr-ui-component/` |
| do-wdr-issue-swarm | `.agents/skills/do-wdr-issue-swarm/` |
| do-github-pr-sentinel | `.agents/skills/do-github-pr-sentinel/` |
| agent-browser | `.agents/skills/agent-browser/` |
| privacy-first | `.agents/skills/privacy-first/` |
| skill-creator | `.agents/skills/skill-creator/` |
| readme-best-practices | `.agents/skills/readme-best-practices/` |
| anti-ai-slop | `.agents/skills/anti-ai-slop/` |
| vercel-cli | `.agents/skills/vercel-cli/` |
