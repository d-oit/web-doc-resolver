# AGENTS.md — cli/ui/

> **do-web-doc-resolver UI layer** — design system, component specs, and token architecture for the resolver workspace PWA.
> Data-dense workspace tool, not a chat app. Anti-slop, developer-first.

## Overview

`cli/ui/` contains the design system for the do-web-doc-resolver Next.js PWA. Covers design tokens, component specifications, Storybook config, and integration with Google Stitch for screen generation. All UI work maps to GitHub epic issues #69–#74.

## Architecture

### 3-Layer Token System

| Layer | Source | Output | Tool |
|---|---|---|---|
| **Primitives** | Figma Variables | `tokens/primitives.json` | Tokens Studio |
| **Semantic** | Hand-authored | `tokens/semantic.json` | Style Dictionary |
| **Component** | Co-located with components | CSS custom properties in `:root` block | Tailwind v4 |

### Component Structure (CSS-only, no directories)

Components are **single flat `.css` files** in `components/`, not directories with TSX. Each file is self-contained with:
1. `:root {}` block defining `--wdr-{component}-*` tokens
2. BEM classes: `.wdr-{component}`, `.wdr-{component}--variant`, `.wdr-{component}__element`
3. Max **200 lines** per file. Split into `{component}-variants.css` or `{component}-states.css` if exceeded.

```
components/
├── badge.css          # Status indicators, provider labels (#100)
├── button.css         # 5 variants × 3 sizes
├── card.css           # Container with header/body/footer
├── datatable.css      # Dense data tables
├── input.css          # Text, search, select, textarea
├── keyvalue.css       # Metadata & config pair display (#105)
├── markdown-viewer.css # Rendered markdown pane
├── progress.css       # Determinate & indeterminate progress (#107)
├── sidebar.css        # Left nav with sections
├── stepper.css        # Pipeline cascade progress
└── tooltip.css        # Hover/focus supplementary info (#101)
```

### Responsive Strategy

- **Container queries** (`@container`) for component-level responsiveness — not media queries
- Breakpoints define container widths, not viewport: `sm: 320px`, `md: 640px`, `lg: 1024px`, `xl: 1440px`
- Layouts compose via CSS Grid `auto-fill`/`auto-fit`, not fixed breakpoint classes

## Design Decisions

| Decision | Rationale |
|---|---|
| **OKLCH color space** | Perceptually uniform; predictable lightness/darkness scaling; native CSS `oklch()` |
| **Tailwind v4 CSS-first config** | No JS config; `@theme` block in CSS; ships only used utilities; Vite/Rspack native |
| **Container queries** | Components adapt to slot size, not viewport — critical for sidebar/workspace split layouts |
| **RSC-first** | Server components by default; `"use client"` boundary only at interactive leaves (inputs, toggles, modals) |
| **CSS-only components** | Pure CSS with BEM naming. No runtime JS cost. Tokens in `:root`. Interactive behavior via CSS pseudo-classes. |

## File Structure

```
cli/ui/
├── AGENTS.md                  # This file
├── DESIGN.md                  # Full design spec (color, typography, motion, anti-patterns)
├── tokens/
│   ├── primitives.json        # Figma-exported raw values (colors, spacing, radii)
│   ├── semantic.json          # Named aliases (--color-surface, --space-inset-md)
│   ├── design_tokens.css      # 3-layer: primitive → semantic → component (incl. dark mode)
│   ├── typography.css         # Fluid type scale, font stacks
│   ├── spacing.css            # Spacing scale + semantic aliases
│   ├── motion.css             # Durations, easings, keyframes (wdr-shimmer, wdr-pulse-stream)
│   └── build-tokens.sh        # Style Dictionary CLI: JSON → CSS custom properties
├── styles/
│   ├── globals.css            # @theme block, Tailwind directives, token imports
│   └── dark.css               # Dark mode overrides (prefers-color-scheme, forced-colors)
├── components/
│   ├── *.css                  # Flat CSS files (see Component Catalog below)
│   └── README.md              # Component inventory + naming conventions
├── layouts/
│   ├── responsive.css         # Container queries, grid, split pane, app shell
│   └── accessibility.css      # Focus, skip-nav, sr-only, forced-colors, touch targets
├── lib/
│   ├── a11y.ts                # Focus trap, roving tabindex, ARIA helpers
│   └── cn.ts                  # clsx + tailwind-merge utility
├── stories/
│   └── README.md              # Storybook 9 CSF3 setup guide
├── figma/
│   └── tokens-export.json     # Figma Variables → Style Dictionary
└── .storybook/
    ├── main.ts                # CSF 3, autodocs, a11y addon, Chromatic
    └── preview.ts             # Viewports, dark mode decorator, token globals
```

## Component Catalog

### Primitives

| Component | File | Variants | A11y |
|---|---|---|---|
| Button | `button.css` | primary, secondary, ghost, danger, icon; sm/md/lg | focus-visible ring, disabled state |
| Input | `input.css` | text, search, URL, textarea, select; sm/md/lg | label association, error state |
| Badge | `badge.css` | default, success, warning, error, info; dot, pill, dismissible, provider-specific | focus-visible on close |
| Tooltip | `tooltip.css` | top, bottom, left, right | aria-describedby, hover delay 300ms, focus immediate |

### Containers

| Component | File | Variants | A11y |
|---|---|---|---|
| Card | `card.css` | default, interactive, flat, outlined, compact, status-accented | landmark role |
| Sidebar | `sidebar.css` | expanded, collapsed; sections, items, badges | keyboard nav, aria-current |
| Panel | `panel.css` (#102) | horizontal/vertical split, collapsible | separator role, keyboard resize |
| Modal | `modal.css` (#103) | sm/md/lg, fullscreen, confirmation | focus trap, role=dialog, escape dismiss |

### Data Display

| Component | File | Variants | A11y |
|---|---|---|---|
| DataTable | `datatable.css` | default, dense, compact; sortable columns | aria-sort, row selection |
| MarkdownViewer | `markdown-viewer.css` | rendered, with code blocks, tables | semantic HTML |
| CodeBlock | `codeblock.css` (#104) | syntax highlighted, line numbers, copy | code semantics |
| KeyValue | `keyvalue.css` | default, dense, striped, truncated, editable, sectioned | dl/dt/dd with role=term/definition |

### Pipeline / SSE

| Component | File | Variants | A11y |
|---|---|---|---|
| Stepper | `stepper.css` | vertical, horizontal; pending/running/complete/failed/streaming | status announcements |
| StreamIndicator | `streamindicator.css` (#106) | disconnected/connecting/streaming/complete/error | role=status, aria-live=polite |
| ProgressBar | `progress.css` | sm/md/lg; default/success/warning/error; determinate/indeterminate; multi-segment | role=progressbar, aria-valuenow |

### Layout

| Component | File | Purpose |
|---|---|---|
| Stack | `layouts/responsive.css` | Vertical/horizontal stacking with gap |
| Grid | `layouts/responsive.css` | CSS Grid layout with container queries |
| Split | `layouts/responsive.css` | Split pane layout (input/output) |
| Resizable | `resizable.css` (#108) | Split pane with drag handles |

### Navigation

| Component | File | Variants | A11y |
|---|---|---|---|
| Bottom Nav | `bottom-nav.css` (#110) | mobile (<768px) fixed bottom bar | aria-current=page, 44px touch target |
| Icon Rail | `icon-rail.css` (#111) | tablet (768-1024px) collapsed sidebar | roving tabindex, tooltips |

## Component Implementation Pattern

Every component follows this exact structure:

```css
/* Component tokens in :root */
:root {
  --wdr-{component}-{property}: var(--wdr-{semantic-token});
  --wdr-{component}-{variant}-{property}: var(--wdr-{semantic-token});
}

/* Base class */
.wdr-{component} { ... }

/* Size variants */
.wdr-{component}--sm { ... }
.wdr-{component}--md { ... }
.wdr-{component}--lg { ... }

/* Color variants */
.wdr-{component}--success { ... }
.wdr-{component}--error { ... }

/* Sub-elements */
.wdr-{component}__element { ... }

/* States */
.wdr-{component}:hover { ... }
.wdr-{component}:focus-visible { outline: 2px solid var(--wdr-border-focus); outline-offset: 2px; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wdr-{component} { transition: none; animation: none; }
}
```

### Token Naming Convention

```
--wdr-{component}-{element}-{variant}-{state}

Examples:
--wdr-button-bg                    (component + element)
--wdr-button-bg-hover              (component + element + state)
--wdr-button-primary-bg            (component + variant + element)
--wdr-button-primary-bg-hover      (component + variant + element + state)
--wdr-badge-provider-exa-bg        (component + variant + sub-variant + element)
--wdr-kv-key-color                 (component + element + property)
--wdr-progress-track-bg            (component + element + property)
```

## GitHub Issue Implementation Strategy

### Dependency Chain

Issues must be implemented in dependency order. Group by dependency depth for parallel execution:

| Wave | Issues | Dependencies |
|---|---|---|
| 0 | #75 (Tokens) | #69 (infrastructure) |
| 1 | #100, #101, #105, #107 | #75 only |
| 2 | #102, #103, #104, #106, #108 | #75 + #71 or #78 |
| 3 | #77, #78, #109, #110, #111 | #75 + #71 |
| 4 | #76, #79, #80, #81, #82, #83 | #71 |
| 5 | #84, #85, #86, #87 | #71 or #84 |
| 6 | #88, #89, #90, #91 | #69, #72 |
| 7 | #92, #93, #94, #95, #96, #97, #98, #99 | #69, #72, #73, #74 |

### Implementation Workflow

1. `gh issue list --json number,title,body,labels` to get all issues
2. Analyze dependencies from issue body ("Blocked by" lines)
3. Group issues into waves by dependency depth
4. Launch parallel agents per wave (each agent implements one component)
5. Agent writes component CSS + updates components/README.md
6. `git add` + `git commit` per component (atomic commits)
7. `git push` + `gh run watch` to monitor CI
8. `gh issue close <number> --comment "Implemented in <commit>"` on pass

### Agent Handoff Protocol

When launching parallel agents for a wave:
- Each agent receives the full issue description + existing token list
- Agents must read existing components to match conventions
- Agents write files using Write tool (not Edit) for new files
- Agents update README.md to replace issue links with file references
- After all agents complete, verify files exist and commit atomically per component

## Stitch Integration

`stitch/DESIGN.md` follows Google Stitch's format for AI-generated screens:
- Define screens as component compositions with token references
- Stitch reads `DESIGN.md` + `tokens/semantic.json` → generates pixel-consistent Next.js pages
- Run: `stitch generate --design stitch/DESIGN.md --tokens tokens/semantic.json --out app/`

## Figma Workflow

```
Figma Variables → Tokens Studio plugin → tokens/primitives.json
                                          ↓
                              Style Dictionary (build-tokens.sh)
                                          ↓
                              tokens/design_tokens.css (custom properties)
                                          ↓
                              Components reference semantic tokens
```

Never edit `primitives.json` manually — it is a Figma export artifact. Edit `semantic.json` for alias changes.

## Storybook Setup

- **CSF 3** with `satisfies Meta<typeof Component>` typing
- **autodocs** enabled globally — every component auto-generates docs page
- **a11y addon** (`@storybook/addon-a11y`) runs axe-core on every story
- **Chromatic** for visual regression — PR checks block merge on visual diff
- Viewports: `mobile (375px)`, `tablet (768px)`, `desktop (1440px)`

## Accessibility Checklist (WCAG 2.2 AA)

- [ ] All interactive elements keyboard accessible (Tab, Enter, Escape, Arrow)
- [ ] Focus visible on all interactive elements (no `outline: none` without replacement)
- [ ] Color contrast ≥ 4.5:1 text, ≥ 3:1 non-text (OKLCH makes this predictable)
- [ ] `aria-live` regions for async content (provider status, results loading)
- [ ] Skip navigation link for keyboard users
- [ ] Reduced motion respected (`prefers-reduced-motion` → disable transitions)
- [ ] Touch targets ≥ 44×44px on mobile
- [ ] No content conveyed by color alone

## Responsive Breakpoints

| Name | Container Width | Usage |
|---|---|---|
| `sm` | `≥ 320px` | Mobile: single column, collapsed nav |
| `md` | `≥ 640px` | Tablet: two-column, expandable sidebar |
| `lg` | `≥ 1024px` | Desktop: full sidebar + workspace |
| `xl` | `≥ 1440px` | Wide: optional detail pane |

Use `@container (min-width: 640px)` not `@media`. All components must declare `container-type` in their parent.

## Dark Mode Strategy

- Token override approach: `dark.css` redefines semantic tokens under `[data-theme="dark"]`
- OS sync: `prefers-color-scheme: dark` sets `data-theme` on `<html>` by default
- Manual toggle persists to `localStorage`, overrides OS preference
- OKLCH lightness inversion: `oklch(0.95 ...)` surface → `oklch(0.15 ...)` in dark
- All components automatically support dark mode through semantic token references

## Anti-Patterns (Forbidden)

- Comments in code
- Rounded corners > 12px (no "friendly" bubbly cards)
- Gradient backgrounds on functional surfaces
- Animation on layout properties (width, height, margin) — transform/opacity only
- Placeholder-only states (always have content or explicit empty state)
- Chat/conversation UI patterns
- Generic "loading spinner" without context
- Emojis in UI chrome (content only)
- Floating action buttons
- Skeleton screens (use shimmer only for data loading, not page load)

## Deployment

| Environment | URL | Trigger |
|---|---|---|
| **Production** | `https://do-web-doc-resolver.vercel.app` | Vercel native GitHub integration (auto-deploy on push to `main`) |

Vercel deploys via `deploy-ui.yml` GitHub Action on push to `main`. `ci-ui.yml` runs lint/test/typecheck quality gates on PRs.

### Manual Deploy (fallback)

```bash
cd web
vercel login
vercel link
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod --yes
```

### Debugging

```bash
vercel logs <deployment-url>              # build/runtime logs
vercel logs --level error                 # errors only
vercel inspect <url> --logs              # build logs for a deployment
vercel inspect <url> --wait              # wait for deployment to finish
```

`VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are stored as GitHub secrets. Never use `--token` flag — use `VERCEL_TOKEN` env var.

## Testing Strategy

| Type | Tool | Scope |
|---|---|---|
| Unit | Vitest + Testing Library | Props, callbacks, renders |
| a11y | axe-core via `@storybook/addon-a11y` + vitest-axe | Every story and test |
| Visual regression | Chromatic | Every PR, blocks merge on diff |
| E2E (CI) | Playwright | Critical paths on every push to `main` (`ci-ui.yml`) |
| E2E (Release) | Playwright | Runs against deployed URL before GitHub Release (`release.yml`) |

### Release E2E Flow

On tag push (`v*.*.*`), `release.yml` runs:
1. `python-test` + `rust-test` — unit/integration gates
2. `deploy-ui` — deploys to Vercel production, captures URL
3. `e2e-release` — runs `pnpm test:e2e --project=desktop` against the deployed URL (`BASE_URL` env)
4. `build-binaries` — parallel with deploy-ui
5. `release` — creates GitHub Release only after **both** `build-binaries` and `e2e-release` pass

The `BASE_URL` env var overrides the default `https://do-web-doc-resolver.vercel.app` in `playwright.config.ts`. E2E tests must pass before any release is published.

## GitHub Issues Map

### Epics
| # | Title | Scope |
|---|---|---|
| #69 | [Epic] Next.js PWA Infrastructure & Vercel Setup | App scaffold, PWA manifest, deploy |
| #70 | [Epic] Rust CLI wdr WebAssembly & Edge API Integration | Wasm bridge, worker API routes |
| #71 | [Epic] Cross-Device App Shell & Navigation (Anti-Slop UI) | `AppShell`, `NavBar`, layout |
| #72 | [Epic] Resolver Workspace Core View | `InputArea`, `DataTable`, `StatusBar` |
| #73 | [Epic] BYOK API Key Management & Security | `KeyVault`, encrypted storage |
| #74 | [Epic] History & Semantic Cache UI | `HistoryPanel`, search, cache |

### Infrastructure (#69)
| # | Title | Blocked by | Status |
|---|---|---|---|
| #92 | Next.js App Router Scaffold — PWA Manifest & Base Layout | — | pending |
| #93 | CI/CD Pipeline — Lint, Test, Build, Deploy | #69 | pending |
| #94 | Turborepo + pnpm Monorepo Configuration | #69 | pending |

### Wasm & Edge (#70)
| # | Title | Blocked by | Status |
|---|---|---|---|
| #95 | wasm-pack Build Pipeline — Compile Core Resolver to .wasm | #69 | pending |
| #96 | Edge API Route — /api/resolve with SSE Streaming | #70 | pending |
| #97 | TypeScript Wasm Bindings — Client-Side Integration Layer | #70 | pending |

### App Shell (#71)
| # | Title | Blocked by | Status |
|---|---|---|---|
| #75 | Design System Tokens — CSS Custom Properties (OKLCH) | #69 | **done** |
| #76 | Responsive Navigation Shell — Mobile/Tablet/Desktop | #71 | pending |
| #77 | Dark Mode & OS Preference Sync | #71 | pending |
| #78 | Accessibility Foundation — WCAG 2.2 AA Compliance | #71 | pending |

### Workspace (#72)
| # | Title | Blocked by | Status |
|---|---|---|---|
| #79 | Command Bar — Single-line Input with Keyboard Shortcuts | #71 | pending |
| #80 | Execution Profile Selector — Fast/Balanced/Quality | #71 | pending |
| #81 | Pipeline Stepper — SSE Progress Visualization | #79, #71 | pending |
| #82 | Markdown Result Pane — Syntax Highlighting & Copy | #71 | pending |
| #83 | Telemetry Trace Accordion — Latency/Tokens/Provider | #71 | pending |

### Security (#73)
| # | Title | Blocked by | Status |
|---|---|---|---|
| #84 | Provider Settings UI — Masked Key Inputs | #71 | pending |
| #85 | Web Crypto Encryption — AES-GCM Key Storage | #84 | pending |
| #86 | Test Connection — Provider Health Check UI | #84 | pending |
| #87 | CSP Headers & XSS Protection Guards | #85 | pending |

### History (#74)
| # | Title | Blocked by | Status |
|---|---|---|---|
| #88 | Desktop History View — Sortable Data Table | #69 | pending |
| #89 | Mobile History View — Condensed List Cards | #69 | pending |
| #90 | Restore from Cache — Instant Load Action | #88, #72 | pending |
| #91 | Search & Filter Controls — Date/Profile/Provider | #88 | pending |

### Primitives
| # | Title | Blocked by | Status |
|---|---|---|---|
| #100 | Badge Component — Status Indicators & Provider Labels | #75 | **done** (`badge.css`) |
| #101 | Tooltip Component — Hover/Focus Supplementary Info | #75 | **done** (`tooltip.css`) |

### Containers
| # | Title | Blocked by | Status |
|---|---|---|---|
| #102 | Panel Component — Resizable Split Pane & Collapsible Sections | #75, #71 | pending |
| #103 | Modal Component — Confirmation Dialogs & Provider Key Entry | #75, #78 | pending |

### Data Display
| # | Title | Blocked by | Status |
|---|---|---|---|
| #104 | CodeBlock Component — Syntax Highlighting & Line Numbers | #75, #82 | pending |
| #105 | KeyValue Component — Metadata & Config Pair Display | #75 | **done** (`keyvalue.css`) |

### Pipeline
| # | Title | Blocked by | Status |
|---|---|---|---|
| #106 | StreamIndicator Component — SSE Connection Status & Token Rate | #75, #71, #96 | pending |
| #107 | ProgressBar Component — Determinate & Indeterminate Progress | #75 | **done** (`progress.css`) |

### Layout
| # | Title | Blocked by | Status |
|---|---|---|---|
| #108 | Resizable Component — Split Pane with Drag Handles | #75, #71 | pending |

### Design System
| # | Title | Blocked by | Status |
|---|---|---|---|
| #109 | Stitch Integration Spec — AI-Generated Screen Compositions | #75, #71 | pending |
| #110 | Bottom Nav Bar — Mobile Navigation (<768px) | #75, #71 | pending |
| #111 | Icon Rail — Tablet Navigation (768-1024px) | #75, #71, #101 | pending |

### Testing & Docs
| # | Title | Blocked by | Status |
|---|---|---|---|
| #98 | Storybook 9 Setup — Component Documentation & Testing | #75 | pending |
| #99 | Playwright E2E Tests — Critical User Paths | #72, #73, #74 | pending |

All UI work must link to its parent epic issue. Component PRs reference the specific sub-issue.
