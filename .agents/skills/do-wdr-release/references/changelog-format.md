# Changelog Format

## Automatic from Commits

```bash
# Since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline --no-merges

# With conventional commit parsing
./scripts/changelog.sh v0.2.0
```

## Changelog Template

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

### Performance
- **cli**: Optimize semantic cache hit performance

### Dependencies
- Bump tokio in /cli in the cargo-deps group
```

## Release Notes Generation

### Create Release with Notes

```bash
gh release create v0.2.0 \
  --title "Release v0.2.0" \
  --notes-file CHANGELOG.md \
  --assets assets/screenshots/release-v0.2.0/
```

### Auto-generate Release Notes

```bash
gh release create v0.2.0 \
  --generate-notes
```

### Upload Assets

```bash
gh release create v0.2.0 \
  --assets "assets/screenshots/release-v0.2.0/*.png"
```
