# AGENTS.md

> Primary entry point for AI agents integrating the resolver as a skill.
> Deep reference is in **[agents-docs/](agents-docs/README.md)**.

## Constants

- `MAX_LINES_PER_SOURCE_FILE=500`
- `MAX_LINES_PER_SKILL_MD=250`
- `MAX_LINES_AGENTS_MD=150`

## Repository Structure

```text
./
├── scripts/               # Python resolver core
├── cli/                   # Rust CLI (do-wdr)
├── web/                   # Next.js web UI
├── tests/                 # Python test suite
├── docs/                  # Project documentation
├── agents-docs/           # Agent-specific reference
├── .agents/skills/        # Canonical skill definitions
├── assets/                # Visual assets
└── config.toml            # Optional configuration
```

## Project Documentation

Detailed reference material in `agents-docs/`:

- [Development](agents-docs/DEVELOPMENT.md)
- [Configuration](agents-docs/CONFIG.md)
- [Overview](agents-docs/OVERVIEW.md)
- [Semantic Health](agents-docs/SEMANTIC_HEALTH.md)

## Skills

- `do-web-doc-resolver`: `.agents/skills/do-web-doc-resolver/`
- `anti-ai-slop`: `.agents/skills/anti-ai-slop/`
- `readme-best-practices`: `.agents/skills/readme-best-practices/`
- `skill-creator`: `.agents/skills/skill-creator/`

## Coding Workflow

### Branching & Commits

- Branch naming: `feat/`, `fix/`, `chore/`, `docs/`
- Commit format: Conventional Commits (`type(scope): description`)

### PR Checklist

- `./scripts/quality_gate.sh` passes
- Linting clean (`ruff`, `black`, `cargo fmt`, `cargo clippy`, `npm run lint`)
- No new secrets (verified via Gitleaks)
- `AGENTS.md` updated if structure changed

### Nightly Bridge

The project maintains a solid bridge between Python (Cascade skills) and Rust (wdr CLI).
Every Nightly at 01:00 UTC, the `nightly-bridge.yml` workflow:

1. Rebuilds the Rust CLI and Python environment.
2. Runs the full integration test suite in `tests/integration/`.
3. Verifies LLM-ready Markdown output (YAML frontmatter + structural anchors) from JS-heavy sites.
4. Attempts to fix parsing logic (LaTeX, code blocks) in the Rust resolver if failures are detected.
5. Formats code with `cargo fmt` and `ruff format` before committing.

### Test Commands

- **Python**: `pytest -m "not live"`
- **Rust**: `cd cli && cargo test`
- **Web**: `cd web && npx playwright test --project=desktop`

## Agent Tool Config

No tool-specific directories (`.jules/`, `.cursor/`, etc.) currently exist in the repository root.
