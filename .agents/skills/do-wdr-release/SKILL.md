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

### 1. Prepare Release

```bash
# Ensure clean working directory
git status

# Run tests
./scripts/quality_gate.sh

# Capture screenshots
./scripts/capture/capture-release.sh $VERSION
```

### 2. Bump Version

```bash
# Update version in all files
python scripts/sync_versions.py --set $VERSION
```

### 3. Generate Changelog

```bash
# From conventional commits
git log --oneline --no-merges v0.1.0..HEAD

# Or use changelog generator
./scripts/changelog.sh v0.2.0
```

### 4. Create Tag

```bash
git add -A
git commit -m "chore(release): v0.2.0"
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin main --tags
```

### 5. Create GitHub Release

```bash
gh release create v0.2.0 \
  --title "Release v0.2.0" \
  --notes-file CHANGELOG.md \
  --assets assets/screenshots/release-v0.2.0/
```

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
