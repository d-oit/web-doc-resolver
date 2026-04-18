# Release Process

Releases follow [Semantic Versioning](https://semver.org/) with conventional commits.

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

## Release Workflow

1. Ensure all tests pass: `./scripts/quality_gate.sh`
2. Run the release script for the desired version bump.
3. Push tags: `git push --tags`
4. The GitHub Actions `release.yml` workflow will:
   - Build binaries for Linux, macOS, and Windows.
   - Create a GitHub Release with the generated changelog and assets.

See [`do-wdr-release` skill](.agents/skills/do-wdr-release/SKILL.md) for more details.
