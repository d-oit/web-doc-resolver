import type { Meta, StoryObj } from '@storybook/html';
import '../tokens/design_tokens.css';
import './button.css';

const meta = {
  title: 'Primitives/Button',
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'ghost', 'danger'],
      description: 'Visual variant',
    },
    size: {
      control: { type: 'inline-radio' },
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
    disabled: { control: 'boolean', description: 'Disabled state' },
    loading: { control: 'boolean', description: 'Loading spinner' },
    label: { control: 'text', description: 'Button text' },
  },
  args: {
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    label: 'Resolve URL',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Primary: Story = {};

export const Secondary: Story = {
  args: { variant: 'secondary', label: 'Cancel' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', label: 'Dismiss' },
};

export const Danger: Story = {
  args: { variant: 'danger', label: 'Delete' },
};

export const Small: Story = {
  args: { size: 'sm', label: 'Small' },
};

export const Large: Story = {
  args: { size: 'lg', label: 'Large' },
};

export const Disabled: Story = {
  args: { disabled: true, label: 'Disabled' },
};

export const Loading: Story = {
  args: { loading: true, label: 'Loading' },
  render: (args) => `
    <button class="do-wdr-button do-wdr-button--${args.variant} do-wdr-button--${args.size}${args.loading ? ' do-wdr-button--loading' : ''}"
            ${args.disabled ? 'disabled' : ''}>
      ${args.label}
    </button>
  `,
};

export const AllVariants: Story = {
  render: () => `
    <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
      <button class="do-wdr-button do-wdr-button--primary do-wdr-button--md">Primary</button>
      <button class="do-wdr-button do-wdr-button--secondary do-wdr-button--md">Secondary</button>
      <button class="do-wdr-button do-wdr-button--ghost do-wdr-button--md">Ghost</button>
      <button class="do-wdr-button do-wdr-button--danger do-wdr-button--md">Danger</button>
      <button class="do-wdr-button do-wdr-button--primary do-wdr-button--md" disabled>Disabled</button>
    </div>
  `,
};

export const AllSizes: Story = {
  render: () => `
    <div style="display: flex; gap: 0.75rem; align-items: center;">
      <button class="do-wdr-button do-wdr-button--primary do-wdr-button--sm">Small</button>
      <button class="do-wdr-button do-wdr-button--primary do-wdr-button--md">Medium</button>
      <button class="do-wdr-button do-wdr-button--primary do-wdr-button--lg">Large</button>
    </div>
  `,
};
