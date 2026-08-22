import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    // Build output, coverage reports and the vendored Dart port are not ours to lint.
    ignores: [
      'dist/**',
      'coverage/**',
      'storybook-static/**',
      'node_modules/**',
      'fairu-player-dart/**',
      '*.html',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // The four rules below ship with eslint-plugin-react-hooks v6 and encode
      // the React Compiler's assumptions rather than plain hook correctness.
      // They flag ~50 sites in this codebase, several of them deliberate — the
      // `src`-sync effect in `useMedia` runs on every render *on purpose*,
      // because a ref swap is invisible to a dependency-gated effect and the
      // element would otherwise sit with an empty `src` behind a permanent
      // spinner (see the comment there).
      //
      // Making them errors today would either block every commit or invite
      // blanket disable-comments, and the honest fix is the state extraction in
      // Phase 3 of ROADMAP.md, not a scatter of suppressions. Downgraded to
      // warnings so they stay visible and countable while that work is pending.
      // `rules-of-hooks`, `set-state-in-render` and the exhaustive-deps family
      // stay at their recommended severity — those catch real bugs.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/globals': 'warn',

      // Fast Refresh only works when a module exports components and nothing
      // else. Barrel files and type-only companions are explicitly allowed.
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // An unused argument is often a documented part of a callback signature
      // (`(_, data) => ...` in the hls.js handlers, for instance). Requiring a
      // leading underscore keeps that intent visible instead of banning it.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // The VAST/VMAP parsers walk untyped XML and the Cast/Media Session APIs
      // are only partially covered by lib.dom. `any` is a real escape hatch
      // there, but it should be a deliberate one, so warn rather than error.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  {
    // Tests and stories run in Node-ish environments and legitimately reach for
    // globals and non-null assertions that production code should not.
    files: [
      '**/*.test.{ts,tsx}',
      '**/*.stories.{ts,tsx}',
      'src/test/**',
      '.storybook/**',
      '*.config.{ts,js}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Storybook invokes a story's `render` as a component, so hooks inside it
      // are legitimate. The rule only sees a lowercase function named `render`
      // and cannot know that.
      'react-hooks/rules-of-hooks': 'off',

      // Stories and specs mutate module-level fixtures between cases by design.
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
      'react-refresh/only-export-components': 'off',

      // Test harnesses hand a hook's own ref straight back to the element they
      // render, which is the only way to exercise a hook that subscribes to a
      // media element. Driving the subject is the point here.
      'react-hooks/refs': 'off',
    },
  },
);
