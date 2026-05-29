# Version Bumping

Follow [Semantic Versioning](https://semver.org/):

| Version | When | Example |
|---------|------|---------|
| **MAJOR** | Breaking changes | 1.0.0 → 2.0.0 |
| **MINOR** | New features (backward compatible) | 1.0.0 → 1.1.0 |
| **PATCH** | Bug fixes (backward compatible) | 1.0.0 → 1.0.1 |

## Pre-release Versions

```bash
# Alpha
./scripts/release.sh 1.0.0-alpha.1

# Beta
./scripts/release.sh 1.0.0-beta.1

# Release Candidate
./scripts/release.sh 1.0.0-rc.1
```

## Version Files

This repository uses 4 canonical version files that MUST always be in sync:

| File | Field | Purpose |
|------|-------|---------|
| `pyproject.toml` | `[project] version` | **Source of truth** (Python package) |
| `cli/Cargo.toml` | `[package] version` | Rust crate version |
| `web/package.json` | `"version"` | NPM package version |
| `cli/src/cli.rs` | `#[command(version = "...")]` | CLI `--version` output |

## Sync All Version Files

```bash
python scripts/sync_versions.py           # check only (exit 1 if drift)
python scripts/sync_versions.py --fix     # auto-fix all 4 targets to pyproject.toml
python scripts/sync_versions.py --set 1.2.0  # set specific version everywhere
```

## Guard Against Version Regression

CI enforces `validate-version` job on every PR: the manifest version in `pyproject.toml` MUST be >= the latest GitHub tag. This prevents old branches from overwriting release versions when merged.

**If CI fails with "Version regression detected"**:

```bash
LATEST_TAG=$(git tag -l "v*.*.*" --sort=-version:refname | head -1)
python scripts/sync_versions.py --set "${LATEST_TAG#v}"
```
