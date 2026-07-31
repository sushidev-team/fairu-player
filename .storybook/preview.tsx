import type { Decorator, Preview } from '@storybook/react';
import '../src/styles/base.css';

/**
 * Themes map onto the `data-theme` selectors defined in
 * `src/styles/variables.css`, so switching in the toolbar exercises the real
 * theming mechanism rather than a Storybook-only approximation.
 */
const THEMES = [
  { value: 'dark', title: 'Dark', canvas: '#0b0b0b' },
  { value: 'light', title: 'Light', canvas: '#f7f7f8' },
  { value: 'high-contrast', title: 'High contrast', canvas: '#000000' },
] as const;

type ThemeValue = (typeof THEMES)[number]['value'];

/**
 * Applies the selected theme and paints the canvas to match.
 *
 * Painting the canvas matters: a light-theme component on a dark canvas looks
 * broken even when it is correct, and vice versa.
 */
const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme ?? 'dark') as ThemeValue;
  const entry = THEMES.find((t) => t.value === theme) ?? THEMES[0];
  const fullBleed = context.parameters.layout === 'fullscreen';

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: fullBleed ? '100vh' : undefined,
        padding: fullBleed ? 0 : '1.5rem',
        background: entry.canvas,
        color: 'var(--fp-color-text)',
        fontFamily: 'var(--fp-font-family)',
      }}
    >
      <Story />
    </div>
  );
};

/**
 * Renders the story once per theme when `parameters.compareThemes` is set.
 * Catching a contrast regression is far easier side by side.
 */
const withThemeComparison: Decorator = (Story, context) => {
  if (!context.parameters.compareThemes) return <Story />;

  return (
    <div
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      }}
    >
      {THEMES.filter((t) => t.value !== 'high-contrast').map((theme) => (
        <div
          key={theme.value}
          data-theme={theme.value}
          style={{
            background: theme.canvas,
            padding: '1.25rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--fp-border-color)',
          }}
        >
          <p
            style={{
              margin: '0 0 0.75rem',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--fp-color-text-muted)',
              fontFamily: 'var(--fp-font-family)',
            }}
          >
            {theme.title}
          </p>
          <Story />
        </div>
      ))}
    </div>
  );
};

const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: {
      expanded: true,
      sort: 'requiredFirst',
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Backgrounds are driven by the theme decorator; the addon's own picker
    // would fight it, so it stays disabled.
    backgrounds: { disable: true },
    options: {
      storySort: {
        order: [
          'Reels',
          'Components',
          ['VideoPlayer', 'Player'],
          'Controls',
          'Ads',
          'Views',
          'Playlist',
          'Chapters',
          'Markers',
          'Stats',
          'Examples',
          '*',
        ],
      },
    },
    viewport: {
      viewports: {
        phone: {
          name: 'Phone (390×844)',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
        phoneSmall: {
          name: 'Phone small (360×640)',
          styles: { width: '360px', height: '640px' },
          type: 'mobile',
        },
        tablet: {
          name: 'Tablet (834×1112)',
          styles: { width: '834px', height: '1112px' },
          type: 'tablet',
        },
        desktop: {
          name: 'Desktop (1440×900)',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
      },
    },
    docs: {
      toc: true,
    },
  },

  globalTypes: {
    theme: {
      description: 'Player theme',
      defaultValue: 'dark',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        dynamicTitle: true,
        items: THEMES.map(({ value, title }) => ({ value, title })),
      },
    },
  },

  decorators: [withThemeComparison, withTheme],
};

export default preview;
