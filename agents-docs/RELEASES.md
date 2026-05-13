# Release Process

Releases follow [Semantic Versioning](https://semver.org/) with conventional commits.

## Version Source Of Truth

The release version is sourced from `pyproject.toml`.

There are 4 canonical version files that MUST always be in sync:

| File | Field |
|------|-------|
| `pyproject.toml` | `[project] version` |
| `cli/Cargo.toml` | `[package] version` |
| `web/package.json` | `"version"` |
| `cli/src/cli.rs` | `#[command(version = "...")]` |

Use `scripts/sync_versions.py` to sync all 4:

```bash
python scripts/sync_versions.py           # check only
python scripts/sync_versions.py --fix     # fix all to match pyproject.toml
python scripts/sync_versions.py --set 1.2.0  # set specific version
```

**Important**: If GitHub release tags drift from manifest versions, sync manifests TO the tags
(not the other way around):

```bash
LATEST_TAG=$(git tag -l "v*.*.*" --sort=-version:refname | head -1)
python scripts/sync_versions.py --set "${LATEST_TAG#v}"
```

## Automated Release Scripts

Use the release script to automate version bumping, changelog generation, and tagging.
It calls `sync_versions.py --set` internally, so all 4 files stay in sync:

### Patch release (0.1.0 → 0.1.1)

```bash
./scripts/release.sh patch
```

### Minor release (0.1.1 → 0.2.0)

```bash
./scripts/release.sh minor
```

### Major release (0.2.0 → 1.0.0)

```bash
./scripts/release.sh major
```

### Specific version

```bash
./scripts/release.sh 1.2.3
```

## Changelog Generation

Generate a changelog for a specific version:

```bash
./scripts/changelog.sh v0.2.0
```

## Release Workflow

1. Ensure all tests pass: `./scripts/quality_gate.sh`
2. Run the release script for the desired version bump.
3. Push tags: `git push --tags`
4. The GitHub Actions `release.yml` workflow will:
   - Build binaries for Linux, macOS, and Windows.
   - Create a GitHub Release with the generated changelog and assets.

## Version Regression Guard

CI enforces a `validate-version` job on every PR: the manifest version in
`pyproject.toml` MUST be >= the latest git tag. This prevents old branches
from overwriting release versions when merged.

If CI fails with "Version regression detected":

```bash
LATEST_TAG=$(git tag -l "v*.*.*" --sort=-version:refname | head -1)
python scripts/sync_versions.py --set "${LATEST_TAG#v}"
```

## History of Version Drift

A previous version regression (PR #270, commit `c283dfa`) merged an old branch
onto v0.3.3, reverting all 4 manifests back to 0.3.1 and deleting CHANGELOG
entries. The regression guard prevents this from recurring.

See [`do-wdr-release` skill](.agents/skills/do-wdr-release/SKILL.md) for more details.
