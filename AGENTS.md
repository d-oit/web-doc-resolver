# AGENTS.md

> **Primary Integration Guide** — This file is the main entry point for AI
> agents and developers integrating the resolver as a skill. For deep
> technical reference, see **[agents-docs/](agents-docs/README.md)**.
>
> **do-web-doc-resolver** — resolves queries or URLs into clean Markdown via a
> provider cascade.
> Supported by: Claude Code, Windsurf, Gemini CLI, Codex, Copilot, OpenCode,
> Devin, Amp, Zed, Warp, RooCode, Jules
> See [agents.md](https://agents.md) for spec.

## Named Constants

```bash
# File size limits (lines)
readonly MAX_LINES_PER_SOURCE_FILE=500
readonly MAX_LINES_PER_SKILL_MD=250
readonly MAX_LINES_AGENTS_MD=150

# Retry and polling configuration
readonly DEFAULT_MAX_RETRIES=3
readonly DEFAULT_RETRY_DELAY_SECONDS=5
readonly DEFAULT_POLL_INTERVAL_SECONDS=5
readonly DEFAULT_MAX_POLL_ATTEMPTS=12
readonly DEFAULT_TIMEOUT_SECONDS=1800

# Git/PR configuration
readonly MAX_COMMIT_SUBJECT_LENGTH=72
readonly MAX_PR_TITLE_LENGTH=72
```

## Setup

```bash
# Install git pre-commit hooks
./scripts/setup-hooks.sh
```

## Version Management

This repository uses 4 canonical version files that MUST always be in sync:

| File | Field | Purpose |
|------|-------|---------|
| `pyproject.toml` | `[project] version` | **Source of truth** (Python package) |
| `cli/Cargo.toml` | `[package] version` | Rust crate version |
| `web/package.json` | `"version"` | NPM package version |
| `cli/src/cli.rs` | `#[command(version = "...")]` | CLI `--version` output |

### Sync All Version Files

```bash
python scripts/sync_versions.py           # check only (exit 1 if drift)
python scripts/sync_versions.py --fix     # auto-fix all 4 targets to pyproject.toml
python scripts/sync_versions.py --set 1.2.0  # set specific version everywhere
```

### Release Version Bumping

Use the release script — it calls `sync_versions.py` internally:

```bash
./scripts/release.sh patch        # 0.3.3 → 0.3.4 (interactive)
./scripts/release.sh patch --yes  # non-interactive (AI agents / automation)
./scripts/release.sh minor        # 0.3.3 → 0.4.0
./scripts/release.sh major        # 0.3.3 → 1.0.0
```

### Guard Against Version Regression

CI enforces `validate-version` job on every PR: the manifest version in
`pyproject.toml` MUST be >= the latest GitHub tag. This prevents old branches
from overwriting release versions when merged.

**If CI fails with "Version regression detected"**:

```bash
LATEST_TAG=$(git tag -l "v*.*.*" --sort=-version:refname | head -1)
python scripts/sync_versions.py --set "${LATEST_TAG#v}"
```

## Quality Gate (Required Before Commit)

```bash
./scripts/quality_gate.sh # Always run before committing. Fix all errors.
```

### Test Commands

- Python: `pytest -m "not live"`
- Rust: `cd cli && cargo test`
- Web: \`cd web && npx playwright test --project=desktop --project=mobile --project=tablet\`

**Guard Rails:**

- **Temporary Files**: NEVER create temporary files or debug outputs in the
  repository root or source directories. Always use system temporary
  directories (e.g., `/tmp` or via `mktemp`).
- **Secret Scanning**: Gitleaks (`.gitleaks.toml`) is enforced via CI and
  pre-commit hooks to prevent credential leakage.
- **Git Config**: Pre-commit validates git config. If global hooks detected,
  run `git config --global --unset core.hooksPath` or use
  `SKIP_GLOBAL_HOOKS_CHECK=true`.

## Code Style

- Max `${MAX_LINES_PER_SOURCE_FILE}` lines/file;
  `${MAX_LINES_PER_SKILL_MD}`/`SKILL.md`; `${MAX_LINES_AGENTS_MD}`/`AGENTS.md`
- `SKILL.md` must start with frontmatter; No magic numbers - use named constants
- **Reference format**: `` `references/filename.md` - Description ``
- Shell: `shellcheck` (severity=error); Markdown: `markdownlint`;
  Diagrams: `mermaid`
- **Web dependencies**: Use `npm ci --legacy-peer-deps` (see `.npmrc` for Vercel)

## Repository Structure

```text
./
├── scripts/               # Core Python logic
├── cli/                   # Rust CLI (do-wdr)
│   └── ui/                # Design system (tokens, components, Storybook)
├── web/                   # Next.js web UI (Vercel deployment)
├── tests/                 # Python test suite
├── docs/                  # Standards & examples
├── agents-docs/           # Reference for agents
├── .agents/skills/        # Canonical skill definitions
├── .githooks/             # Git hooks (pre-commit, etc.)
├── .github/               # GitHub workflows & templates
└── assets/                # Visual assets
```

### Configuration Files

- `.actrc` - Local CI testing with `act`
- `.gitleaks.toml` - Secret scanning configuration
- `.pre-commit-config.yaml` - Pre-commit hooks configuration
- `commitlint.config.cjs` - Commit message linting
- `markdownlint.toml` - Markdown linting rules

## PR & Commit Instructions

- **Branch naming**: `feat/`, `fix/`, `chore/`, `docs/`
- **Commit format**: Conventional Commits (`type(scope): description`)
  (max `${MAX_PR_TITLE_LENGTH}` chars)
- Branch per feature; One concern per PR; Never commit to `main`

### Commit Type Mapping

| Intent | Type | Scope suggestion |
| --- | --- | --- |
| Security patch / hardening | `fix` | `security` |
| New security feature/control | `feat` | `security` |
| Security-related CI/tooling | `ci` | `security` |

**Allowed types**: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`,
`refactor`, `revert`, `style`, `test`

### PR Checklist

- `scripts/quality_gate.sh` passes
- Linting clean (`ruff`, `black`, `cargo fmt`, `cargo clippy`, `npm run lint`)
- Markdown linting passes (`markdownlint`)
- No new secrets committed (Gitleaks)
- `AGENTS.md` updated if repository structure or skills change
- **Version**: `pyproject.toml` version >= latest GitHub tag (enforced by CI)

## Project Documentation

Detailed technical reference material is located in `agents-docs/`.

| Topic | File |
| --- | --- |
| Reference Index | [agents-docs/README.md](agents-docs/README.md) |
| Development | [agents-docs/DEVELOPMENT.md](agents-docs/DEVELOPMENT.md) |
| Configuration | [agents-docs/CONFIG.md](agents-docs/CONFIG.md) |
| Deployment | [agents-docs/DEPLOYMENT.md](agents-docs/DEPLOYMENT.md) |
| Releases | [agents-docs/RELEASES.md](agents-docs/RELEASES.md) |
| Assets | [agents-docs/ASSETS.md](agents-docs/ASSETS.md) |
| Overview | [agents-docs/OVERVIEW.md](agents-docs/OVERVIEW.md) |
| Semantic Health | [agents-docs/SEMANTIC_HEALTH.md](agents-docs/SEMANTIC_HEALTH.md) |
| Issues | [agents-docs/ISSUES.md](agents-docs/ISSUES.md) |
| Cascade | [.agents/skills/do-web-doc-resolver/references/CASCADE.md](.agents/skills/do-web-doc-resolver/references/CASCADE.md) |

## Skills

| Skill | Path |
| --- | --- |
| do-web-doc-resolver | .agents/skills/do-web-doc-resolver/ |
| do-wdr-cli | .agents/skills/do-wdr-cli/ |
| do-wdr-assets | .agents/skills/do-wdr-assets/ |
| do-wdr-release | .agents/skills/do-wdr-release/ |
| do-wdr-ui-component | .agents/skills/do-wdr-ui-component/ |
| do-wdr-issue-swarm | .agents/skills/do-wdr-issue-swarm/ |
| do-github-pr-sentinel | .agents/skills/do-github-pr-sentinel/ |
| agent-browser | .agents/skills/agent-browser/ |
| privacy-first | .agents/skills/privacy-first/ |
| skill-creator | .agents/skills/skill-creator/ |
| readme-best-practices | .agents/skills/readme-best-practices/ |
| anti-ai-slop | .agents/skills/anti-ai-slop/ |
| vercel-cli | .agents/skills/vercel-cli/ |
| codacy | .agents/skills/codacy/ |

## Security

- **Secret Scanning**: Gitleaks is enforced via CI and pre-commit to prevent
  credential leakage.
- No secrets in commits (use `.env`); Pin Actions to SHA (with `# vX.Y` comment)
- No untrusted MCPs; Report vulnerabilities via Private Advisories

## Agent Guidance

### Core Principles

- **Plan**: Produce written plan, wait for confirmation for non-trivial tasks.
- **Policies**: See `agents-docs/WORKFLOW.md` for Atomic Commit & Pre-Existing
  Issue resolution.
- **Learning**: After work, run `learn` or append discoveries to nearest
  `AGENTS.md`. See `plans/AUDIT.md` → Learnings for accumulated knowledge.
- **Context**: Delegate to sub-agents; Use `/clear`; Load skills only when
  needed.

### Git Failure Recovery

When git commands fail, follow this retry sequence **in order** (skip steps
that don't apply — they're harmless no-ops if run anyway):

```bash
# Step 1: Stash if you have uncommitted changes
git stash

# Step 2: Abort an in-progress rebase if needed
git rebase --abort

# Step 3: Abort an in-progress merge if needed
git merge --abort

# Step 4: Fetch latest origin/main and retry the failed command
git fetch origin main
# retry original command...
```

**Never retry the same failing command more than 3 times.** After 3 failures,
stop and ask the user for help.

### Long-Running Tasks (60 min+)

For tasks expected to take more than 60 minutes:

- Create **checkpoint files** in `plans/` after each major milestone.
- Use descriptive names: `plans/checkpoint-<task>-<step>.md`.
  See `plans/checkpoint-_TEMPLATE.md` for a starting template.
- When resuming after a session boundary, reference the latest checkpoint file
  (e.g., "continue from `plans/checkpoint-ci-fixes-wave3.md`") rather than
  relying on session memory.
- A checkpoint should capture: what was completed, what's in progress, current
  branch/SHA, and the next step to take.

### CI Fix Workflow

Before starting CI fixes, run this diagnostic to identify failing runs:

```bash
gh run list --limit 5 --json conclusion,headBranch,workflowName
```

Then follow this workflow:

1. **Identify** the latest failing runs from the output.
2. **Fix the simplest failure first** — don't tackle multiple failures at once.
3. **Commit and push** after fixing each failure.
4. **Wait for CI** to pass on that commit before moving to the next failure.

This incremental approach prevents compounding issues and makes bisecting
failures straightforward if a fix introduces a new problem.

## Accumulated Learnings

See [`plans/AUDIT.md` → Learnings](plans/AUDIT.md#learnings-captured-2026-05-12) for
historic project patterns (rate limiter design, CI flakiness fixes, config merge).

See `agents-docs/` for detailed reference documentation.

### GOAP PR Orchestration (2026-05-18)

- **Vercel + legacy-peer-deps**: Vercel doesn't pass `--legacy-peer-deps` at build
  time. Add `legacy-peer-deps=true` to `web/.npmrc` to fix ESLint 10 peer conflicts
  on Vercel deployments.
- **Codacy false positives are common**: Validate Codacy review claims before acting.
  3/4 recent reviews contained factual errors (TS 6.0.3 "doesn't exist", sync function
  needs "await", correct `ddgs` import flagged as wrong).
- **`next-env.d.ts` is auto-generated**: Always use `/// <reference` syntax, never
  `import`. Next.js regenerates this file on every build, reverting manual edits.
- **Dependabot major bumps (Next 15→16)**: Close and let dependabot regenerate
  against updated main after feature PRs merge; major bumps need manual testing.
- **`checkRateLimit` is sync**: In-memory rate limiters using `Map` operations
  are deliberately sync — no `await` needed. Only async if Redis-backed.

### TypeScript 6.0.3 / ESLint 10 Upgrade

- **CSS side-effect imports**: TS 6.0.3 blocks `import "./globals.css"` without
  a module declaration. Add `web/app/css.d.ts` with `declare module "*.css"`.
- **ESLint 10 + eslint-config-next**: Peer dep conflict with `@next/eslint-plugin-next`.
  Use `npm ci --legacy-peer-deps` (set in `web/.npmrc` for Vercel).
- **ddgs rename**: `duckduckgo-search` CLI/pkg renamed to `ddgs`. Import: `from ddgs import DDGS`.
  Update all `from duckduckgo_search import DDGS` references + test patches.
- **tsconfig jsx**: Next.js 15 requires `"jsx": "preserve"` — Next.js overrides
  this on every build anyway.

### Cross-Platform Parity

- **Rust `--profile` is wired**: `main.rs:68-84` parses profile string and applies
  budget presets. Was incorrectly flagged as missing in earlier audits.
- **Mobile/tablet Playwright already in CI**: `ci-ui.yml` runs 3 projects
  (desktop, mobile, tablet). Check current CI before flagging gaps.

### Rate Limiter / Quality Scoring

- **Token bucket**: Clamp `capacity` to `max(1.0, ·)` to prevent infinite acquire loops.
- **Quality anchor validation**: Use `all()` with all 4 anchors (SUMMARY,
  TECHNICAL_DETAILS, COMPARISON, CITATIONS) — not `any()` with a subset.
- **Penalty tuning**: Tech docs need more lenient penalties (0.25/0.10/0.15/0.10
  vs legacy 0.35/0.15/0.25/0.20) and duplicate threshold at `//3` not `//2`.
