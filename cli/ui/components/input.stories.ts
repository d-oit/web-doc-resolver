import type { Meta, StoryObj } from '@storybook/html';
import '../tokens/design_tokens.css';
import './input.css';

const meta = {
  title: 'Primitives/Input',
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'inline-radio' },
      options: ['sm', 'md', 'lg'],
    },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
    label: { control: 'text' },
    helper: { control: 'text' },
  },
  args: {
    size: 'md',
    placeholder: 'Enter URL to resolve...',
    disabled: false,
    error: false,
    label: 'URL',
    helper: '',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: (args) => `
    <div class="do-wdr-input-group">
      <label class="do-wdr-input-label">${args.label}</label>
      <input class="do-wdr-input do-wdr-input--${args.size} ${args.error ? 'do-wdr-input--error' : ''}"
             type="text"
             placeholder="${args.placeholder}"
             ${args.disabled ? 'disabled' : ''} />
      ${args.helper ? `<span class="do-wdr-input-helper ${args.error ? 'do-wdr-input-helper--error' : ''}">${args.helper}</span>` : ''}
    </div>
  `,
};

export const WithError: Story = {
  args: {
    error: true,
    label: 'API Key',
    helper: 'Key is required',
    placeholder: 'sk-...',
  },
};

export const Small: Story = {
  args: { size: 'sm', label: 'Filter' },
};

export const Large: Story = {
  args: { size: 'lg', label: 'Search' },
};

export const Disabled: Story = {
  args: { disabled: true, label: 'Readonly field', placeholder: 'Cannot edit' },
};

export const Textarea: Story = {
  render: () => `
    <div class="do-wdr-input-group">
      <label class="do-wdr-input-label">Prompt</label>
      <textarea class="do-wdr-textarea" placeholder="Enter your prompt..." rows="4"></textarea>
    </div>
  `,
};

export const Select: Story = {
  render: () => `
    <div class="do-wdr-input-group">
      <label class="do-wdr-input-label">Provider</label>
      <select class="do-wdr-select do-wdr-input do-wdr-input--md">
        <option>Exa MCP</option>
        <option>Exa SDK</option>
        <option>Tavily</option>
        <option>DuckDuckGo</option>
        <option>Firecrawl</option>
      </select>
    </div>
  `,
};

export const InlineGroup: Story = {
  render: () => `
    <div class="do-wdr-input-inline">
      <input class="do-wdr-input do-wdr-input--md" type="text" placeholder="https://example.com" />
      <button class="do-wdr-button do-wdr-button--primary do-wdr-button--md">Resolve</button>
    </div>
  `,
};
