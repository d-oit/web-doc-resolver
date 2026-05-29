# Commands Reference

## Git Commands

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

## GitHub Commands

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

## Version Management

```bash
# Sync all version files
python scripts/sync_versions.py

# Set specific version
python scripts/sync_versions.py --set 1.2.0

# Auto-fix drift
python scripts/sync_versions.py --fix
```

## Release Script

```bash
# Patch release (0.1.0 → 0.1.1)
./scripts/release.sh patch

# Minor release (0.1.1 → 0.2.0)
./scripts/release.sh minor

# Major release (0.2.0 → 1.0.0)
./scripts/release.sh major

# Specific version
./scripts/release.sh 1.2.3

# Non-interactive (AI agents / automation)
./scripts/release.sh patch --yes
```
