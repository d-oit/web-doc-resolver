import type { Meta, StoryObj } from '@storybook/html';
import '../tokens/design_tokens.css';
import './badge.css';

const meta = {
  title: 'Primitives/Badge',
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'success', 'warning', 'error', 'info'],
    },
    size: {
      control: { type: 'inline-radio' },
      options: ['sm', 'md', 'lg'],
    },
    label: { control: 'text' },
  },
  args: {
    variant: 'default',
    size: 'md',
    label: 'Badge',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: (args) => `
    <span class="do-wdr-badge do-wdr-badge--${args.variant} do-wdr-badge--${args.size}">${args.label}</span>
  `,
};

export const StatusBadges: Story = {
  render: () => `
    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
      <span class="do-wdr-badge do-wdr-badge--default do-wdr-badge--md">Default</span>
      <span class="do-wdr-badge do-wdr-badge--success do-wdr-badge--md">Complete</span>
      <span class="do-wdr-badge do-wdr-badge--warning do-wdr-badge--md">Warning</span>
      <span class="do-wdr-badge do-wdr-badge--error do-wdr-badge--md">Error</span>
      <span class="do-wdr-badge do-wdr-badge--info do-wdr-badge--md">Info</span>
    </div>
  `,
};

export const Sizes: Story = {
  render: () => `
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <span class="do-wdr-badge do-wdr-badge--success do-wdr-badge--sm">Small</span>
      <span class="do-wdr-badge do-wdr-badge--success do-wdr-badge--md">Medium</span>
      <span class="do-wdr-badge do-wdr-badge--success do-wdr-badge--lg">Large</span>
    </div>
  `,
};

export const DotIndicators: Story = {
  render: () => `
    <div style="display: flex; gap: 0.75rem; align-items: center;">
      <span class="do-wdr-badge do-wdr-badge--dot do-wdr-badge--success do-wdr-badge--sm" aria-label="Connected"></span>
      <span class="do-wdr-badge do-wdr-badge--dot do-wdr-badge--warning do-wdr-badge--md" aria-label="Slow"></span>
      <span class="do-wdr-badge do-wdr-badge--dot do-wdr-badge--error do-wdr-badge--lg" aria-label="Disconnected"></span>
    </div>
  `,
};

export const ProviderBadges: Story = {
  render: () => `
    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
      <span class="do-wdr-badge do-wdr-badge--provider-exa do-wdr-badge--md">Exa MCP</span>
      <span class="do-wdr-badge do-wdr-badge--provider-tavily do-wdr-badge--md">Tavily</span>
      <span class="do-wdr-badge do-wdr-badge--provider-firecrawl do-wdr-badge--md">Firecrawl</span>
      <span class="do-wdr-badge do-wdr-badge--provider-mistral do-wdr-badge--md">Mistral</span>
    </div>
  `,
};

export const Dismissible: Story = {
  render: () => `
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <span class="do-wdr-badge do-wdr-badge--info do-wdr-badge--md do-wdr-badge--dismissible">
        Filter
        <button class="do-wdr-badge__close" aria-label="Remove filter">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3l6 6M9 3l-6 6"/></svg>
        </button>
      </span>
    </div>
  `,
};

export const PillWithCount: Story = {
  render: () => `
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <span class="do-wdr-badge do-wdr-badge--error do-wdr-badge--sm do-wdr-badge--pill">
        <span class="do-wdr-badge__count">3</span>
      </span>
      <span class="do-wdr-badge do-wdr-badge--info do-wdr-badge--md do-wdr-badge--pill">
        <span class="do-wdr-badge__count">12</span>
      </span>
      <span class="do-wdr-badge do-wdr-badge--success do-wdr-badge--lg do-wdr-badge--pill">
        <span class="do-wdr-badge__count">99+</span>
      </span>
    </div>
  `,
};
