# Visual Assets and Screenshots

Screenshots and visual assets are stored in `assets/screenshots/`.

## Captured Screenshots

- `assets/screenshots/flow.png` - Standard resolution flow
- `assets/screenshots/responsive.png` - Mobile and tablet views
- `assets/screenshots/release/` - Version-specific captures

## Capture Scripts

Use these scripts to regenerate screenshots:

### Capture for Release
```bash
./scripts/capture/capture-release.sh <version>
```

### Capture Standard Flow
```bash
./scripts/capture/capture-flow.sh
```

### Capture Responsive Views
```bash
./scripts/capture/capture-responsive.sh
```

## Manual Verification

Before every release, verify the UI components and design system:
1. Run `cd web && npm run dev`
2. Inspect `http://localhost:3000`
3. Run `cd cli/ui && pnpm storybook` to verify atomic components
