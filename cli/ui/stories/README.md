# Stories — do-web-doc-resolver

Storybook 9 with CSF 3 (Component Story Format) for component development.

## Setup

```bash
# From project root or cli/ui/
npm init -y
npm install -D storybook@9 @storybook/html-vite @storybook/addon-essentials
```

## Conventions — CSF 3

```typescript
import type { Meta, StoryObj } from '@storybook/html';
import '../tokens/design_tokens.css';
import '../components/button.css';

const meta: Meta = {
  title: 'Components/Button',
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'ghost', 'danger'],
    },
    size: {
      control: { type: 'inline-radio' },
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    label: 'Resolve URL',
  },
  render: (args) => `
    <button class="do-wdr-button do-wdr-button--${args.variant} do-wdr-button--${args.size}"
            ${args.disabled ? 'disabled' : ''}>
      ${args.label}
    </button>
  `,
};
```

## File Naming

```
components/
  button.stories.ts
  input.stories.ts
  card.stories.ts
  stepper.stories.ts
  sidebar.stories.ts
  datatable.stories.ts
  markdown-viewer.stories.ts
```

## Story Categories

| Category | Prefix | Purpose |
|----------|--------|---------|
| Primitives | `Primitives/` | Button, Input, Badge |
| Containers | `Containers/` | Card, Sidebar, Panel |
| Data | `Data/` | DataTable, MarkdownViewer |
| Pipeline | `Pipeline/` | Stepper, StreamIndicator |
| Layout | `Layout/` | Stack, Grid, Split |
| Patterns | `Patterns/` | Full composed examples |

## Play Functions (interaction tests)

```typescript
export const KeyboardNav: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.tab();
    expect(button).toHaveFocus();
  },
};
```

## Viewports

Pre-configured viewports matching design breakpoints:
- `mobile`: 375×667
- `tablet`: 768×1024
- `desktop`: 1280×800
- `wide`: 1536×864
- `data-dense`: 1920×1080 (developer monitors)

## Dark Mode

Toggle via Storybook toolbar. Each story renders in both themes via decorator:

```typescript
decorators: [
  (story, context) => {
    const theme = context.globals.theme || 'light';
    return `<div data-theme="${theme}">${story()}</div>`;
  },
],
```

## Visual Regression

Integrate with Chromatic or Percy for automated visual diffs.
Run `npx chromatic` before each release.
