---
name: do-wdr-release
description: Manage releases, versioning, changelogs, and GitHub releases. Use when creating releases, bumping versions, generating changelogs, creating tags, or managing the release workflow. Combines Git and GitHub best practices for professional releases.
license: MIT
compatibility: Git, GitHub CLI (gh), Node.js, Cargo
allowed-tools: Bash(git:*) Bash(gh:*) Read Write
metadata:
  author: d-oit
  version: "0.2.0"
  source: https://github.com/d-oit/do-web-doc-resolver
---

# WDR Release Skill

Automated release management with Git and GitHub best practices.

## When to use this skill

Activate this skill when you need to:

- Create a new release (major/minor/patch)
- Bump version numbers
- Generate changelogs from commits
- Create Git tags
- Create GitHub releases
- Automate release workflows
- Capture release screenshots
- Manage pre-release versions

## Quick Start

### Patch Release (0.1.0 → 0.1.1)

```bash
./scripts/release.sh patch
```

### Minor Release (0.1.1 → 0.2.0)

```bash
./scripts/release.sh minor
```

### Major Release (0.2.0 → 1.0.0)

```bash
./scripts/release.sh major
```

### With Version Number

```bash
./scripts/release.sh 1.2.3
```

## Release Workflow

> **IMPORTANT**: This repo has a CI/CD release workflow (`.github/workflows/release.yml`) that automatically builds cross-platform binaries and creates the GitHub release when a `v*.*.*` tag is pushed. Do **NOT** use `gh release create` manually — it creates an incomplete release without binaries.

### 1. Prepare Release

```bash
# Ensure clean working directory
git status

# Run tests
./scripts/quality_gate.sh
```

### 2. Bump Version

```bash
# Update version in all files
python scripts/sync_versions.py --set $VERSION
```

### 3. Commit & Tag

```bash
git add -A
git commit -m "chore(release): v0.2.0"
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin main --tags
```

### 4. Wait for CI/CD

The tag push triggers `.github/workflows/release.yml` which:
- Runs Python and Rust test suites
- Builds binaries for Linux, macOS, and Windows
- Generates build attestations
- Extracts changelog section from `CHANGELOG.md`
- Creates GitHub release with binaries and install instructions

Monitor progress: `gh run list --workflow=release.yml`

## References

| Topic | File |
|-------|------|
| Commit format & types | [references/conventional-commits.md](references/conventional-commits.md) |
| Version bumping & sync | [references/version-bumping.md](references/version-bumping.md) |
| Changelog generation | [references/changelog-format.md](references/changelog-format.md) |
| CI/CD & pre-commit hooks | [references/automation.md](references/automation.md) |
| Git & GitHub commands | [references/commands-reference.md](references/commands-reference.md) |

## Related Skills

- `do-wdr-assets`: Screenshot capture
- `do-wdr-cli`: Rust CLI
- `do-web-doc-resolver`: Python resolver
