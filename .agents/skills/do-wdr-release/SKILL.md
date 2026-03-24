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
# Update version in package.json (web)
# Update version in Cargo.toml (cli)
# Update version in pyproject.toml (python)
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

## Conventional Commits

All commits should follow conventional commit format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(cli): add cache-stats command` |
| `fix` | Bug fix | `fix(web): resolve hydration error` |
| `docs` | Documentation | `docs: update README with examples` |
| `style` | Formatting | `style: fix indentation` |
| `refactor` | Code refactoring | `refactor(providers): simplify cascade` |
| `perf` | Performance | `perf: optimize memory allocation` |
| `test` | Tests | `test: add unit tests for resolver` |
| `build` | Build system | `build: update cargo dependencies` |
| `ci` | CI/CD | `ci: add screenshot capture step` |
| `chore` | Maintenance | `chore: update .gitignore` |

### Scopes

| Scope | Description |
|-------|-------------|
| `cli` | Rust CLI changes |
| `web` | Web UI changes |
| `python` | Python resolver changes |
| `exa_mcp` | Exa MCP provider |
| `tavily` | Tavily provider |
| `duckduckgo` | DuckDuckGo provider |
| `assets` | Visual assets |
| `release` | Release changes |

## Version Bumping

Follow [Semantic Versioning](https://semver.org/):

| Version | When | Example |
|---------|------|---------|
| **MAJOR** | Breaking changes | 1.0.0 → 2.0.0 |
| **MINOR** | New features (backward compatible) | 1.0.0 → 1.1.0 |
| **PATCH** | Bug fixes (backward compatible) | 1.0.0 → 1.0.1 |

### Pre-release Versions

```bash
# Alpha
./scripts/release.sh 1.0.0-alpha.1

# Beta
./scripts/release.sh 1.0.0-beta.1

# Release Candidate
./scripts/release.sh 1.0.0-rc.1
```

## Changelog Generation

### Automatic from Commits

```bash
# Since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline --no-merges

# With conventional commit parsing
./scripts/changelog.sh v0.2.0
```

### Changelog Format

```markdown
# Changelog

## [0.2.0] - 2026-03-21

### Features
- **cli**: Add cache-stats command
- **web**: Add dark mode toggle

### Bug Fixes
- **web**: Resolve hydration error
- **python**: Fix rate limit handling

### Documentation
- Update README with examples
```

## GitHub Release

### Create Release

```bash
gh release create v0.2.0 \
  --title "Release v0.2.0" \
  --notes "Release notes here" \
  --target main
```

### Upload Assets

```bash
gh release create v0.2.0 \
  --assets "assets/screenshots/release-v0.2.0/*.png"
```

### Generate Release Notes

```bash
gh release create v0.2.0 \
  --generate-notes
```

## Release Checklist

- [ ] All tests pass (`./scripts/quality_gate.sh`)
- [ ] Screenshots captured (`./scripts/capture/capture-release.sh`)
- [ ] Version bumped in all files
- [ ] Changelog updated
- [ ] Tag created
- [ ] Pushed to remote
- [ ] GitHub release created
- [ ] Assets uploaded

## Automation

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
# Capture screenshots if UI files changed
if git diff --cached --name-only | grep -q "web/"; then
    ./scripts/capture/capture-release.sh "pre-commit"
fi
```

### CI/CD Pipeline

The release workflow runs tests and builds binaries. Vercel deployment is handled automatically via Git integration (push to `main` → auto-deploy).

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'

jobs:
  python-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - run: pip install -r requirements.txt
      - run: python -m pytest tests/ -v -m "not live"

  rust-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: dtolnay/rust-toolchain@stable
      - run: cd cli && cargo test
      - run: cd cli && cargo clippy -- -D warnings
      - run: cd cli && cargo fmt --check

  build-binaries:
    needs: [python-test, rust-test]
    # ... matrix build for Linux, macOS, Windows

  release:
    needs: [build-binaries]
    steps:
      - uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

**Note**: Web UI deployment is handled by Vercel's Git integration — no deploy job in CI.

## Best Practices

### Git

1. **Commit often**: Small, focused commits
2. **Use conventional commits**: Enables automatic changelog
3. **Sign commits**: `git commit -S` for security
4. **Tag releases**: Semantic versioning tags
5. **Don't rewrite public history**: Avoid force push to main

### GitHub

1. **Draft releases**: Create draft, publish when ready
2. **Release assets**: Include screenshots and binaries
3. **Release notes**: Auto-generate from commits
4. **Pre-releases**: Mark alpha/beta/rc appropriately
5. **Discussion links**: Link to GitHub Discussions

### Versioning

1. **0.x.x**: API unstable, breaking changes expected
2. **1.x.x**: Stable API, follow semver strictly
3. **Pre-release**: Use `-alpha`, `-beta`, `-rc` suffixes
4. **Deprecations**: Note in changelog before removal

## Commands Reference

### Git Commands

```bash
# Create annotated tag
git tag -a v0.2.0 -m "Release v0.2.0"

# List tags
git tag -l "v*"

# Push tags
git push origin --tags

# Delete tag (local and remote)
git tag -d v0.2.0
git push origin :refs/tags/v0.2.0
```

### GitHub Commands

```bash
# Create release
gh release create v0.2.0 --title "v0.2.0" --notes "Release notes"

# List releases
gh release list

# View release
gh release view v0.2.0

# Delete release
gh release delete v0.2.0
```

## Related Skills

- `do-wdr-assets`: Screenshot capture
- `do-wdr-cli`: Rust CLI
- `do-web-doc-resolver`: Python resolver
