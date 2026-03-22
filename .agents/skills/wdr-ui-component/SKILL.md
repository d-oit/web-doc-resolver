---
name: wdr-ui-component
description: Implement CSS-only UI components for the do-web-doc-resolver design system. Use when creating new components, fixing component styles, or implementing GitHub issues tagged design-system/frontend in cli/ui/. Triggers include "create component", "implement badge/tooltip/modal", "add CSS for", "design system component", or any task involving cli/ui/components/. Covers token patterns, BEM naming, accessibility, dark mode, and the wave-based GitHub issue implementation workflow.
allowed-tools: Bash(git:*), Read, Write, Edit, Glob, Grep
---

# WDR UI Component Development

CSS-only components for the do-web-doc-resolver developer-first design system.

## When to use

- Creating a new component CSS file in `cli/ui/components/`
- Implementing a GitHub issue tagged `design-system` or `frontend`
- Fixing component styles, accessibility, or dark mode issues
- Adding provider-specific badge variants

## Component structure

Each component is a **single flat `.css` file** max 200 lines. Structure:

```
components/
├── badge.css
├── button.css
├── {component}.css     ← new components go here
```

## File template

```css
:root {
  --wdr-{component}-{property}: var(--wdr-{semantic-token});
  --wdr-{component}-{variant}-{property}: var(--wdr-{semantic-token});
}

.wdr-{component} { /* base */ }
.wdr-{component}--sm { /* size */ }
.wdr-{component}--md { /* size */ }
.wdr-{component}--lg { /* size */ }
.wdr-{component}--success { /* color variant */ }
.wdr-{component}__element { /* sub-element */ }
.wdr-{component}:focus-visible { outline: 2px solid var(--wdr-border-focus); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  .wdr-{component} { transition: none; animation: none; }
}
```

## Token naming

```
--wdr-{component}-{element}-{variant}-{state}
--wdr-button-primary-bg-hover
--wdr-badge-provider-exa-bg
--wdr-kv-key-color
```

## Required semantic tokens (from `tokens/design_tokens.css`)

- Surfaces: `--wdr-surface-bg`, `--wdr-surface-bg-elevated`, `--wdr-surface-bg-muted`
- Text: `--wdr-text-primary`, `--wdr-text-secondary`, `--wdr-text-tertiary`
- Borders: `--wdr-border-default`, `--wdr-border-subtle`, `--wdr-border-focus`
- Signals: `--wdr-signal-success`, `--wdr-signal-warning`, `--wdr-signal-error`, `--wdr-signal-info`
- Signal BGs: `--wdr-signal-success-bg`, `--wdr-signal-warning-bg`, `--wdr-signal-error-bg`, `--wdr-signal-info-bg`
- Interactive: `--wdr-interactive-bg`, `--wdr-interactive-bg-hover`, `--wdr-interactive-bg-subtle`
- Spacing: `--wdr-space-1` through `--wdr-space-16`
- Typography: `--wdr-font-sans`, `--wdr-font-mono`, `--wdr-text-xs` through `--wdr-text-3xl`
- Motion: `--wdr-transition-colors`, `--wdr-duration-fast`, `--wdr-ease-out`
- Data: `--wdr-data-row-alt`, `--wdr-data-row-hover`, `--wdr-data-row-selected`

## Accessibility requirements

Every component MUST have:
1. `focus-visible` outline (2px `--wdr-border-focus`, offset 2px)
2. `prefers-reduced-motion: reduce` disabling all animations
3. Semantic HTML where applicable (`dl/dt/dd`, `role=progressbar`, `aria-describedby`)
4. No content conveyed by color alone

## Implementation workflow

1. Read the GitHub issue body for requirements and design reference
2. Read `tokens/design_tokens.css` for available semantic tokens
3. Read 1-2 existing components (e.g., `button.css`, `badge.css`) for conventions
4. Write the component CSS file using Write tool
5. Update `components/README.md` — replace issue link with file reference
6. Commit: `git add cli/ui/components/{name}.css cli/ui/components/README.md && git commit -m "feat(ui): implement {Component} — issue #{N}"`

## Anti-patterns (never do these)

- Adding comments to CSS code
- Animating layout properties (width, height, margin) — transform/opacity only
- Using raw primitive tokens — always use semantic tokens
- Exceeding 200 lines per file
- Generic loading spinners without context
- Decorative animation or bouncing dots
