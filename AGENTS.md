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

### Test Commands

- **Python**: `pytest -m "not live"`
- **Rust**: `cd cli && cargo test`
- **Web**: `cd web && npx playwright test --project=desktop`

## Agent Tool Config

No tool-specific directories (`.jules/`, `.cursor/`, etc.) currently exist in the repository root.

## Release Workflow

> **Do NOT use `gh release create` manually.** The CI/CD pipeline handles releases automatically.

### Correct Release Steps

```bash
# 1. Bump versions
python scripts/sync_versions.py --set $VERSION

# 2. Commit
git add -A && git commit -m "chore(release): v$VERSION"

# 3. Tag and push (triggers CI/CD)
git tag -a v$VERSION -m "Release v$VERSION"
git push origin main --tags

# 4. Monitor CI/CD (builds binaries + creates GitHub release)
gh run list --workflow=release.yml
gh run watch <run-id>
```

### What CI/CD Does Automatically

- Runs Python + Rust test suites
- Builds binaries: Linux x86_64, macOS aarch64, Windows x86_64
- Generates build attestations
- Extracts changelog from `CHANGELOG.md`
- Creates GitHub release with binaries + install instructions
