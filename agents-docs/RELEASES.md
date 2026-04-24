# Release Process

Releases follow [Semantic Versioning](https://semver.org/) with conventional commits.

## Version Source Of Truth

The release version is sourced from the package manifests used by `scripts/release.sh`:

- `pyproject.toml`
- `cli/Cargo.toml`
- `web/package.json`

If GitHub release tags drift from those package versions, align the next release tag to the manifest versions instead of continuing the stale tag line.

## Automated Release Scripts

Use the release script to automate version bumping, changelog generation, and tagging:

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

## Release Guard Rails

**IMPORTANT: Follow this order exactly. Skipping steps creates orphaned releases.**

### Pre-Release Checks (Must ALL Pass)

1. **No Open PRs**: Verify all planned PRs are merged
   ```bash
   gh pr list --state open  # Must be empty
   ```

2. **Quality Gate**: Run and verify all checks pass
   ```bash
   ./scripts/quality_gate.sh
   ```

3. **Lint Clean**: Verify no warnings
   ```bash
   ruff check . && cd cli && cargo clippy -- -D warnings
   ```

4. **CHANGELOG Entry**: Verify entry exists for new version
   ```bash
   grep "## \[$VERSION\]" CHANGELOG.md
   ```

5. **Version Sync**: Verify all manifests match
   ```bash
   grep "^version" pyproject.toml cli/Cargo.toml web/package.json
   ```

### Release Workflow (In Order)

1. **Merge all PRs** to `main` (use `gh pr merge --squash --auto`)
2. **Sync main locally** (`git checkout main && git pull`)
3. **Run quality gate** (`./scripts/quality_gate.sh`)
4. **Add CHANGELOG entry** for new version
5. **Commit changelog** (`git add CHANGELOG.md && git commit`)
6. **Push to main** (`git push origin main`)
7. **Wait for push to complete, then push tag** (`git tag && git push --tags`)
8. **Monitor release workflow** (`gh run list --workflow release.yml`)

### Anti-Patterns (Never Do)

- ❌ **NEVER** create a tag from a feature branch
- ❌ **NEVER** push tags before commits are on `main`
- ❌ **NEVER** skip CHANGELOG validation
- ❌ **NEVER** tag while open PRs exist
- ❌ **NEVER** manually create releases (use `git push --tags`)

## Release Workflow

1. Ensure all tests pass: `./scripts/quality_gate.sh`
2. Merge all open PRs to main: `gh pr merge --squash --auto`
3. Run the release script for the desired version bump.
4. Push commits to main first: `git push origin main`
5. Push tags ONLY after push completes: `git push --tags`
6. The GitHub Actions `release.yml` workflow will:
   - Build binaries for Linux, macOS, and Windows.
   - Create a GitHub Release with the generated changelog and assets.

See [`do-wdr-release` skill](.agents/skills/do-wdr-release/SKILL.md) for more details.
