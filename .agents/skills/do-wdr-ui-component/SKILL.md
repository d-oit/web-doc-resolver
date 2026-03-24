---
name: do-wdr-ui-component
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
  --do-wdr-{component}-{property}: var(--do-wdr-{semantic-token});
  --do-wdr-{component}-{variant}-{property}: var(--do-wdr-{semantic-token});
}

.do-wdr-{component} { /* base */ }
.do-wdr-{component}--sm { /* size */ }
.do-wdr-{component}--md { /* size */ }
.do-wdr-{component}--lg { /* size */ }
.do-wdr-{component}--success { /* color variant */ }
.do-wdr-{component}__element { /* sub-element */ }
.do-wdr-{component}:focus-visible { outline: 2px solid var(--do-wdr-border-focus); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  .do-wdr-{component} { transition: none; animation: none; }
}
```

## Token naming

```
--do-wdr-{component}-{element}-{variant}-{state}
--do-wdr-button-primary-bg-hover
--do-wdr-badge-provider-exa-bg
--do-wdr-kv-key-color
```

## Required semantic tokens (from `tokens/design_tokens.css`)

- Surfaces: `--do-wdr-surface-bg`, `--do-wdr-surface-bg-elevated`, `--do-wdr-surface-bg-muted`
- Text: `--do-wdr-text-primary`, `--do-wdr-text-secondary`, `--do-wdr-text-tertiary`
- Borders: `--do-wdr-border-default`, `--do-wdr-border-subtle`, `--do-wdr-border-focus`
- Signals: `--do-wdr-signal-success`, `--do-wdr-signal-warning`, `--do-wdr-signal-error`, `--do-wdr-signal-info`
- Signal BGs: `--do-wdr-signal-success-bg`, `--do-wdr-signal-warning-bg`, `--do-wdr-signal-error-bg`, `--do-wdr-signal-info-bg`
- Interactive: `--do-wdr-interactive-bg`, `--do-wdr-interactive-bg-hover`, `--do-wdr-interactive-bg-subtle`
- Spacing: `--do-wdr-space-1` through `--do-wdr-space-16`
- Typography: `--do-wdr-font-sans`, `--do-wdr-font-mono`, `--do-wdr-text-xs` through `--do-wdr-text-3xl`
- Motion: `--do-wdr-transition-colors`, `--do-wdr-duration-fast`, `--do-wdr-ease-out`
- Data: `--do-wdr-data-row-alt`, `--do-wdr-data-row-hover`, `--do-wdr-data-row-selected`

## Accessibility requirements

Every component MUST have:
1. `focus-visible` outline (2px `--do-wdr-border-focus`, offset 2px)
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
