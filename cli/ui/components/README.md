# Components — do-web-doc-resolver

Data-dense, developer-first component library. No chat bubbles. No whimsy.

## Design Principles

1. **Information density over white space** — every pixel serves a purpose
2. **Deterministic states** — components reflect pipeline state, not decorative animation
3. **Keyboard-first** — all components reachable and operable via keyboard
4. **Composable tokens** — override semantic tokens per-instance, not per-component hacks

## Component Inventory

### Primitives

| Component | File | Purpose |
|-----------|------|---------|
| Button | `button.css` | Action triggers: primary, secondary, ghost, danger, icon-only |
| Input | `input.css` | Text fields, search, URL bar, textarea, select |
| Badge | `badge.css` | Status indicators, provider labels, count pills |
| Tooltip | `tooltip.css` | Hover/focus supplementary info |

### Containers

| Component | File | Purpose |
|-----------|------|---------|
| Card | `card.css` | Content grouping, result panels, config sections |
| Sidebar | `sidebar.css` + `sidebar-collapsed.css` | Left navigation: provider tree, session history, config |
| Panel | `panel.css` | Resizable split pane, collapsible sections |
| Modal | `modal.css` | Confirmation dialogs, provider key entry |

### Data Display

| Component | File | Purpose |
|-----------|------|---------|
| DataTable | `datatable.css` + `datatable-extended.css` | Dense tabular data: providers, cache entries, results |
| MarkdownViewer | `markdown-viewer.css` | Rendered markdown output pane |
| CodeBlock | `codeblock.css` | Syntax-highlighted code with line numbers |
| KeyValue | `keyvalue.css` | Key-value pair display for metadata/config |

### Pipeline / SSE

| Component | File | Purpose |
|-----------|------|---------|
| Stepper | `stepper.css` | Cascade progress: provider attempts, fallback chain |
| StreamIndicator | `streamindicator.css` | SSE connection status, token rate |
| ProgressBar | `progress.css` | Determinate/indeterminate progress |

### Layout

| Component | File | Purpose |
|-----------|------|---------|
| Stack | `../layouts/responsive.css` | Vertical/horizontal stacking with gap |
| Grid | `../layouts/responsive.css` | CSS Grid layout with container queries |
| Resizable | `resizable.css` | Split pane with drag handles |

## Naming Convention

All tokens follow `--wdr-{component}-{element}-{variant}-{state}`:

```
--wdr-button-bg                    (component + element)
--wdr-button-bg-hover              (component + element + state)
--wdr-button-primary-bg            (component + variant + element)
--wdr-button-primary-bg-hover      (component + variant + element + state)
--wdr-input-border-error            (component + element + state)
--wdr-stepper-step-complete-icon   (component + element + state + sub-element)
```

## Usage Pattern

```html
<!-- Semantic HTML, not div soup -->
<button class="wdr-button wdr-button--primary">
  Resolve URL
</button>

<fieldset class="wdr-input-group">
  <label class="wdr-input-label" for="url">Target URL</label>
  <input class="wdr-input" id="url" type="url" placeholder="https://..." />
</fieldset>
```

## File Size Limit

Each component file: **max 200 lines**. If a component exceeds this, split into:
- `{component}.css` — base styles + tokens
- `{component}-variants.css` — size/color/layout variants
- `{component}-states.css` — hover/focus/disabled/loading states
