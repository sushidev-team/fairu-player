import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Storybook 10 loads this config as ESM, where `__dirname` does not exist.
const configDir = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],

  // Storybook 9 folded docs, controls, actions, viewport, backgrounds, toolbars,
  // measure, outline and the interactions panel into core, so `addon-essentials`
  // and `addon-interactions` no longer exist as packages. Only genuinely
  // optional addons are listed here.
  addons: ['@storybook/addon-links', '@chromatic-com/storybook'],

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  typescript: {
    // react-docgen reads the JSDoc on our prop interfaces and turns it into the
    // controls table, which is why the prop comments are written as
    // user-facing documentation rather than implementation notes.
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      // Without this, every React HTMLAttribute shows up in the props table.
      propFilter: (prop) =>
        prop.parent ? !/node_modules\/(@types\/react|typescript)/.test(prop.parent.fileName) : true,
    },
  },

  viteFinal: async (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: {
        alias: {
          '@': resolve(configDir, '../src'),
        },
      },
    }),
};

export default config;
