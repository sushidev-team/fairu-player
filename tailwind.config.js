/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './.storybook/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'fp-primary': 'var(--fp-color-primary)',
        'fp-background': 'var(--fp-color-background)',
        'fp-surface': 'var(--fp-color-surface)',
        'fp-text': 'var(--fp-color-text)',
        'fp-text-muted': 'var(--fp-color-text-muted)',
        'fp-progress-bg': 'var(--fp-progress-bg)',
        'fp-progress-fill': 'var(--fp-progress-fill)',
      },
      borderRadius: {
        'fp': 'var(--fp-border-radius)',
      },
    },
  },
  plugins: [],
};
