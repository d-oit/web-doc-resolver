# Automation

## Pre-commit Hook

```bash
# .git/hooks/pre-commit
# Capture screenshots if UI files changed
if git diff --cached --name-only | grep -q "web/"; then
    ./scripts/capture/capture-release.sh "pre-commit"
fi
```

## CI/CD Pipeline

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

## Release Checklist

- [ ] All tests pass (`./scripts/quality_gate.sh`)
- [ ] Screenshots captured (`./scripts/capture/capture-release.sh`)
- [ ] Version bumped in all files
- [ ] Changelog updated
- [ ] Tag created
- [ ] Pushed to remote
- [ ] GitHub release created
- [ ] Assets uploaded

## Long-Running Tasks (60 min+)

Major releases (or releases requiring extensive CI, binary builds, and manual QA) can take >60 minutes. Consider creating checkpoint files in `plans/` after major milestones (version bump → changelog → tag → release).
