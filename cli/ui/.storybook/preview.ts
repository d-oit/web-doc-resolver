import type { Preview } from '@storybook/html';

// Import token layers in order
import '../tokens/design_tokens.css';
import '../tokens/typography.css';
import '../tokens/spacing.css';
import '../tokens/motion.css';

// Import layout + accessibility
import '../layouts/accessibility.css';
import '../layouts/responsive.css';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },

  initialGlobals: {
    theme: 'light',
  },

  decorators: [
    (storyFn, context) => {
      const theme = context.globals.theme || 'light';
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-theme', theme);
      wrapper.style.cssText = `
        min-height: 100vh;
        padding: 1.5rem;
        background: var(--do-wdr-surface-bg);
        color: var(--do-wdr-text-primary);
        font-family: var(--do-wdr-font-sans);
        transition: background 0.15s, color 0.15s;
      `;
      wrapper.innerHTML = storyFn() as string;
      return wrapper;
    },
  ],

  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },

    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: { width: '375px', height: '667px' },
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1280px', height: '800px' },
        },
        wide: {
          name: 'Wide',
          styles: { width: '1536px', height: '864px' },
        },
        dataDense: {
          name: 'Data Dense (1080p)',
          styles: { width: '1920px', height: '1080px' },
        },
      },
    },

    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      config: {
        rules: [
          // WCAG 2.2 AA rules
          { id: 'color-contrast', enabled: true },
          { id: 'focus-order-semantics', enabled: true },
          { id: 'aria-allowed-attr', enabled: true },
          { id: 'aria-required-attr', enabled: true },
          { id: 'button-name', enabled: true },
          { id: 'link-name', enabled: true },
          { id: 'label', enabled: true },
        ],
      },
    },

    options: {
      storySort: {
        order: [
          'Documentation',
          ['Overview', 'Tokens', 'Accessibility'],
          'Primitives',
          ['Button', 'Input', 'Badge'],
          'Containers',
          ['Card', 'Sidebar', 'Panel'],
          'Data',
          ['DataTable', 'MarkdownViewer'],
          'Pipeline',
          ['Stepper', 'StreamIndicator'],
          'Layout',
          ['Stack', 'Grid', 'Split'],
          'Patterns',
        ],
      },
    },
  },

  tags: ['autodocs'],
};

export default preview;
