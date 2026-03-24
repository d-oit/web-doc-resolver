# DESIGN.md — do-web-doc-resolver

## Identity

**Name:** do-web-doc-resolver (do-wdr)
**Nature:** Developer tool — CLI + optional web frontend
**Philosophy:** Deterministic, data-dense, anti-slop. No chat bubbles. No "how can I help you?" No decorative animation. Every pixel serves information or action.

## Design Principles

1. **Information density over white space** — Developers scan, not read. Compact rows, monospace data, inline status indicators.
2. **Deterministic states** — UI reflects pipeline state (pending → running → complete | failed), not decorative transitions.
3. **Keyboard-first** — All interactions reachable via keyboard. Tab order is logical. Focus rings are visible and intentional.
4. **Progressive disclosure** — Show status at glance. Expand for detail. Never bury critical errors behind hover.
5. **Anti-chat** — No conversational UI patterns. No message bubbles. No typing indicators. Results are structured data, not prose.
6. **Consistency through tokens** — One source of truth. Change a semantic token, change every surface.

## Color System

### Palette: Ocean/Marine

OKLCH perceptually-uniform color space. All colors have consistent perceived lightness.

| Role | Token | Light | Dark | Contrast (on bg) |
|------|-------|-------|------|--------------------|
| Primary interactive | `--do-wdr-interactive-bg` | ocean-600 `oklch(0.47 0.12 230)` | ocean-500 `oklch(0.57 0.10 230)` | 4.6:1 |
| Primary hover | `--do-wdr-interactive-bg-hover` | ocean-700 | ocean-400 | 3.8:1 |
| Text primary | `--do-wdr-text-primary` | neutral-900 | neutral-100 | 12.6:1 |
| Text secondary | `--do-wdr-text-secondary` | neutral-600 | neutral-400 | 5.4:1 |
| Text tertiary | `--do-wdr-text-tertiary` | neutral-400 | neutral-600 | 2.8:1 (decorative) |
| Border | `--do-wdr-border-default` | neutral-200 | neutral-700 | — |
| Focus ring | `--do-wdr-border-focus` | ocean-500 | ocean-400 | — |
| Success | `--do-wdr-signal-success` | `oklch(0.65 0.18 155)` | same | 3.2:1 (AA Large) |
| Warning | `--do-wdr-signal-warning` | `oklch(0.75 0.14 85)` | same | — |
| Error | `--do-wdr-signal-error` | `oklch(0.60 0.20 25)` | same | 4.1:1 (AA Large) |

### Why OKLCH

- Perceptually uniform: equal steps in lightness look equally different
- Gamut-safe: CSS `oklch()` auto-clips to sRGB/p3
- Future-proof: wider gamut displays render correctly
- Hue/Lightness/Chroma map cleanly to design intent

### 3-Layer Token Architecture

```
Layer 1: Primitive (base)
  --do-wdr-color-ocean-500: oklch(0.57 0.10 230)
  → Raw values. Never used directly in components.

Layer 2: Semantic
  --do-wdr-interactive-bg: var(--do-wdr-color-ocean-600)
  → Intent-based aliases. Components reference these.

Layer 3: Component
  --do-wdr-button-primary-bg: var(--do-wdr-interactive-bg)
  → Component-specific overrides. Override for per-component theming.
```

## Typography

| Purpose | Font | Size | Weight |
|---------|------|------|--------|
| Body text | Inter | `clamp(0.9rem, 0.83rem + 0.33vw, 1.067rem)` | 400 |
| Headings | Inter | fluid scale, Major Third | 600 |
| Code/data | JetBrains Mono | `clamp(0.8rem, 0.75rem + 0.25vw, 0.933rem)` | 400 |
| Labels | Inter | `clamp(0.694rem, 0.66rem + 0.17vw, 0.8rem)` | 500, uppercase |
| Tables | JetBrains Mono | 12px (0.75rem) | 400 |

Monospace is default for all data surfaces (tables, logs, config values, URLs).

## Layout

### App Shell

```
┌──────────────────────────────────────────────┐
│ Sidebar (16rem) │ Main Content Area          │
│                 │ ┌──────────────────────────┐│
│ Providers       │ │  Split Pane              ││
│ History         │ │  Input  │  Output        ││
│ Config          │ │  (URL)  │  (Markdown)    ││
│                 │ │         │                ││
│                 │ └──────────────────────────┘│
└──────────────────────────────────────────────┘
```

### Data Density

- **Table rows:** 20–24px height (dense vs default)
- **Sidebar items:** 32px height
- **Buttons:** 28/36/44px (sm/md/lg)
- **Inputs:** 28/36/44px (sm/md/lg)
- **Cards:** minimal padding (12–16px), no excessive white space

### Responsive

- **< 768px:** Sidebar collapses to icon-only. Split panes stack vertically.
- **Container queries** over media queries for component-level responsiveness.
- App container name: `app`, panel container: `panel`.

## Component Inventory

| Component | Purpose | Key States |
|-----------|---------|------------|
| **Button** | Actions: resolve, cancel, copy, configure | primary, secondary, ghost, danger, loading, disabled |
| **Input** | URL entry, search, config values | default, hover, focus, error, disabled |
| **Card** | Result panels, config sections, provider details | default, interactive, status-accented (left border) |
| **Stepper** | Cascade progress (provider fallback chain) | pending, running, streaming, complete, failed |
| **Sidebar** | Navigation: providers, sessions, settings | expanded, collapsed, active-item |
| **DataTable** | Provider status, cache entries, results | default, dense, compact, selected-row |
| **MarkdownViewer** | Resolved documentation output | rendered, with code blocks, tables |

## Interaction Patterns

### Resolution Flow (Primary)

1. User enters URL or query in Input
2. Stepper activates — shows cascade: `exa_mcp → exa → tavily → duckduckgo`
3. Each step: pending → running → (complete | failed)
4. Streaming step shows token count + duration
5. Result renders in MarkdownViewer pane
6. Metadata (provider, latency, cache hit) in DataTable below

### No-Chat Guarantee

- Results are **files**, not messages
- History is **session list**, not conversation thread
- Errors are **structured**, not "Oops! Something went wrong"
- Status is **deterministic pipeline state**, not animated spinners

## Dark Mode

Full dark theme via `prefers-color-scheme: dark` and `[data-theme="dark"]` attribute.
All semantic tokens remap. Surfaces use deep neutrals (neutral-900/950).
Shadows use `oklch(0 0 0 / opacity)` for dark-on-dark depth.

## Accessibility

- **WCAG 2.2 AA** minimum for all text combinations
- **Focus-visible** rings on all interactive elements (2px ocean-500, offset 2px)
- **Skip navigation** link for keyboard users
- **Screen reader** labels on all icon buttons and status indicators
- **Touch targets** minimum 44×44px (WCAG 2.2 §2.5.8)
- **Forced colors** mode support (Windows High Contrast)
- **Reduced motion** respected — all animations disabled

## Spacing Scale

4px base unit. Linear scale with named aliases for semantic use.

| Token | Value | Use |
|-------|-------|-----|
| `--do-wdr-space-1` | 4px | Tight gaps, inline padding |
| `--do-wdr-space-2` | 8px | Default gaps, cell padding |
| `--do-wdr-space-3` | 12px | Input padding, card padding |
| `--do-wdr-space-4` | 16px | Section padding, relaxed gaps |
| `--do-wdr-space-6` | 24px | Stack spacing, loose gaps |
| `--do-wdr-space-8` | 32px | Section dividers |

Data-dense compact mode uses `--do-wdr-compact-padding` (6px) and `--do-wdr-dense-row` (20px).

## Motion

- Duration range: 80–600ms
- Default easing: `cubic-bezier(0.2, 0, 0, 1)` (ease-out)
- Spring easing for transforms: `cubic-bezier(0.34, 1.56, 0.64, 1)`
- **Only transform/opacity** animated — never layout properties
- `prefers-reduced-motion: reduce` disables all animations
- SSE streaming uses subtle opacity pulse (1.5s), not bouncing dots

## File Structure

```
cli/ui/
├── tokens/
│   ├── design_tokens.css    # 3-layer: primitive → semantic → component
│   ├── typography.css       # Fluid type scale, font stacks
│   ├── spacing.css          # Spacing scale + semantic aliases
│   └── motion.css           # Durations, easings, keyframes
├── components/
│   ├── README.md            # Component inventory + naming conventions
│   ├── button.css           # 5 variants × 3 sizes
│   ├── input.css            # Text, search, select, textarea, groups
│   ├── card.css             # Container with header/body/footer
│   ├── stepper.css          # Pipeline cascade progress
│   ├── sidebar.css          # Left nav with sections
│   ├── datatable.css        # Dense data tables
│   └── markdown-viewer.css  # Rendered markdown pane
├── layouts/
│   ├── responsive.css       # Container queries, grid, split pane
│   └── accessibility.css    # Focus, skip-nav, sr-only, forced-colors
├── stories/
│   └── README.md            # Storybook 9 CSF3 setup guide
├── figma/
│   └── tokens-export.json   # Figma Variables → Style Dictionary
├── .storybook/
│   ├── main.ts              # Storybook config
│   └── preview.ts           # Theme decorator, viewports
├── AGENTS.md
└── DESIGN.md                # This file
```

## Token Naming Convention

```
--do-wdr-{layer}-{category}-{property}-{variant}-{state}

Layer:    color | text | space | radius | shadow | z
Category: surface | text | border | interactive | signal | data | pipeline
Property: bg | color | border | font | gap | padding | radius | shadow
Variant:  primary | secondary | subtle | muted | elevated | inverse
State:    hover | active | focus | disabled | error | loading
```

Examples:
- `--do-wdr-surface-bg-elevated` — semantic layer, surface category, bg property, elevated variant
- `--do-wdr-button-primary-bg-hover` — component layer, button, primary variant, bg property, hover state
- `--do-wdr-interactive-bg` — semantic, interactive, bg
- `--do-wdr-data-row-selected` — semantic, data category, row property, selected state

## Anti-Patterns (Forbidden)

- Rounded corners > 12px (no "friendly" bubbly cards)
- Gradient backgrounds on functional surfaces
- Animation on layout properties (width, height, margin)
- Placeholder-only states (always have content or explicit empty state)
- Chat/conversation UI patterns
- Generic "loading spinner" without context
- Emojis in UI chrome (content only)
- Floating action buttons
- Skeleton screens (use shimmer only for data loading, not page load)
