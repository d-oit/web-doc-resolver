---
name: do-wdr-assets
description: Create screenshots, images, and visual tests for documentation. Use when you need to capture UI screenshots, generate visual assets, create test captures, or update documentation images. Automates browser-based image capture with agent-browser and saves to assets/ folder.
license: MIT
compatibility: Node.js, agent-browser, Chromium
allowed-tools: Bash(agent-browser:*) Read Write
metadata:
  author: d-oit
  version: "0.1.0"
  source: https://github.com/d-oit/do-web-doc-resolver
---

# WDR Assets Skill

Automated screenshot and visual asset generation for documentation.

## When to use this skill

Activate this skill when you need to:
- Capture UI screenshots for documentation
- Generate visual assets for README.md
- Create test captures for release notes
- Update documentation images
- Take before/after screenshots for changes
- Generate visual regression test baselines

## Asset Structure

```
assets/
├── screenshots/
│   ├── homepage.png          # Main UI screenshot
│   ├── help-page.png         # Help page screenshot
│   ├── resolve-flow.png      # Resolution flow demo
│   ├── providers.png         # Provider list screenshot
│   └── release-vX.Y.Z/      # Version-specific captures
│       ├── homepage.png
│       └── new-feature.png
└── README.md                 # Asset documentation
```

## Quick Start

### Capture Homepage

```bash
# Open production site and capture
agent-browser open "https://web-eight-ivory-29.vercel.app"
agent-browser wait --load networkidle
agent-browser screenshot --full assets/screenshots/homepage.png
agent-browser close
```

### Capture with Annotations

```bash
agent-browser open "https://web-eight-ivory-29.vercel.app"
agent-browser wait --load networkidle
agent-browser screenshot --annotate assets/screenshots/homepage-annotated.png
agent-browser close
```

### Release Capture Workflow

```bash
# Create release folder
mkdir -p assets/screenshots/release-v$VERSION

# Capture all pages
./scripts/capture-release.sh $VERSION
```

## Commands

### capture

Capture a single page screenshot.

```bash
agent-browser open <URL>
agent-browser wait --load networkidle
agent-browser screenshot assets/screenshots/<name>.png
agent-browser close
```

### capture-full

Capture full-page screenshot.

```bash
agent-browser open <URL>
agent-browser wait --load networkidle
agent-browser screenshot --full assets/screenshots/<name>.png
agent-browser close
```

### capture-flow

Capture a multi-step flow with screenshots.

```bash
./scripts/capture-flow.sh <flow-name>
```

### capture-release

Capture all pages for a release.

```bash
./scripts/capture-release.sh <version>
```

## Configuration

### Viewport Settings

Default: 1280x720

```bash
agent-browser set viewport 1920 1080    # Desktop HD
agent-browser set viewport 375 812      # iPhone
agent-browser set viewport 1440 900    # Laptop
```

### Screenshot Quality

```bash
agent-browser screenshot --screenshot-format jpeg --screenshot-quality 90
```

## Integration with Docs

### README.md Image References

```markdown
![Web Doc Resolver UI](./assets/screenshots/homepage.png)
```

### Release Notes

```markdown
## What's New in vX.Y.Z

![New Feature](./assets/screenshots/release-vX.Y.Z/new-feature.png)
```

## Automation

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
# Capture screenshots if UI files changed
if git diff --cached --name-only | grep -q "web/"; then
    ./scripts/capture-release.sh "pre-commit"
fi
```

### CI/CD Pipeline

```yaml
- name: Capture screenshots
  run: |
    npm run build
    npm run dev &
    ./scripts/capture-release.sh "ci-${{ github.sha }}"
```

## Best Practices

1. **Consistent viewport**: Use same viewport for comparable screenshots
2. **Wait for load**: Always use `wait --load networkidle` before capture
3. **Version folders**: Use `release-vX.Y.Z/` for release captures
4. **Naming convention**: Use kebab-case for filenames
5. **Full page**: Use `--full` for documentation screenshots
6. **Annotated**: Use `--annotate` for UI documentation

## Related Skills

- `agent-browser`: Browser automation
- `do-wdr-cli`: Rust CLI for web resolution
- `do-web-doc-resolver`: Python resolver
