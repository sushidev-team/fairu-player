import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { isEmptyTheme, mergeThemes, themeToCssVars } from './theme';
import { ThemeProvider } from '@/context/ThemeContext';
import { ProgressBar } from '@/components/controls/ProgressBar';
import type { FairuTheme } from '@/types/theme';

describe('themeToCssVars', () => {
  it('emits only what the theme sets', () => {
    // The whole premise: an unset value must keep inheriting the stylesheet,
    // so the existing look stays the default.
    const vars = themeToCssVars({ colors: { accent: '#e11d48' } });

    expect(vars).toEqual({ '--fp-color-accent': '#e11d48' });
  });

  it('returns nothing for an empty or missing theme', () => {
    expect(themeToCssVars(undefined)).toEqual({});
    expect(themeToCssVars({})).toEqual({});
    expect(themeToCssVars({ colors: {} })).toEqual({});
  });

  it('skips undefined and empty values rather than writing them', () => {
    // Writing `undefined` would override the stylesheet with an invalid value,
    // which is worse than not setting it at all.
    const vars = themeToCssVars({
      colors: { accent: '#fff', background: undefined, surface: '' },
    });

    expect(vars).toEqual({ '--fp-color-accent': '#fff' });
  });

  it('maps every documented group', () => {
    const vars = themeToCssVars({
      colors: { text: '#111' },
      progress: { fill: '#222', buffer: '#333', background: '#444' },
      border: { color: '#555', radius: '4px', radiusSm: '2px', radiusLg: '8px', radiusFull: '999px' },
      glass: { background: 'rgba(0,0,0,.5)', border: 'rgba(255,255,255,.1)' },
      shadows: { sm: 'a', md: 'b', lg: 'c', glow: 'd' },
      spacing: { xs: '1px', sm: '2px', md: '3px', lg: '4px', xl: '5px' },
      typography: { fontFamily: 'Inter', fontFamilyMono: 'Menlo' },
      transitions: { fast: '1ms', normal: '2ms', slow: '3ms', morph: '4ms' },
    });

    expect(vars).toMatchObject({
      '--fp-color-text': '#111',
      '--fp-progress-fill': '#222',
      '--fp-progress-buffer': '#333',
      '--fp-progress-bg': '#444',
      '--fp-border-color': '#555',
      '--fp-border-radius': '4px',
      '--fp-border-radius-sm': '2px',
      '--fp-border-radius-lg': '8px',
      '--fp-border-radius-full': '999px',
      '--fp-glass-bg': 'rgba(0,0,0,.5)',
      '--fp-glass-border': 'rgba(255,255,255,.1)',
      '--fp-shadow-sm': 'a',
      '--fp-shadow': 'b',
      '--fp-shadow-md': 'c',
      '--fp-shadow-glow': 'd',
      '--fp-spacing-xs': '1px',
      '--fp-spacing-xl': '5px',
      '--fp-font-family': 'Inter',
      '--fp-font-family-mono': 'Menlo',
      '--fp-transition-morph': '4ms',
    });
  });

  it('accepts raw vars with or without the prefix', () => {
    const vars = themeToCssVars({
      vars: {
        'blue-500': '#0ea5e9',
        'fp-blue-600': '#0284c7',
        '--fp-blue-700': '#0369a1',
      },
    });

    expect(vars).toEqual({
      '--fp-blue-500': '#0ea5e9',
      '--fp-blue-600': '#0284c7',
      '--fp-blue-700': '#0369a1',
    });
  });

  it('lets a raw var win over the typed field it duplicates', () => {
    const vars = themeToCssVars({
      colors: { accent: '#aaa' },
      vars: { '--fp-color-accent': '#bbb' },
    });

    expect(vars['--fp-color-accent' as keyof typeof vars]).toBe('#bbb');
  });

  it('passes any valid CSS value through untouched', () => {
    const vars = themeToCssVars({
      colors: { accent: 'var(--brand-500)', background: 'oklch(0.7 0.1 180)' },
    });

    expect(vars).toEqual({
      '--fp-color-accent': 'var(--brand-500)',
      '--fp-color-background': 'oklch(0.7 0.1 180)',
    });
  });
});

describe('mergeThemes', () => {
  const base: FairuTheme = {
    preset: 'dark',
    colors: { accent: '#aaa', text: '#fff' },
    border: { radius: '8px' },
  };

  it('merges leaf by leaf rather than replacing sections', () => {
    // Replacing would drop `accent`, which is the thing a page-level brand
    // theme most wants to survive a per-player tweak.
    const merged = mergeThemes(base, { colors: { text: '#000' } });

    expect(merged?.colors).toEqual({ accent: '#aaa', text: '#000' });
    expect(merged?.border).toEqual({ radius: '8px' });
  });

  it('lets the override change the preset', () => {
    expect(mergeThemes(base, { preset: 'light' })?.preset).toBe('light');
  });

  it('handles either side being missing', () => {
    expect(mergeThemes(undefined, base)).toBe(base);
    expect(mergeThemes(base, undefined)).toBe(base);
    expect(mergeThemes(undefined, undefined)).toBeUndefined();
  });
});

describe('isEmptyTheme', () => {
  it('is true only when nothing would be emitted', () => {
    expect(isEmptyTheme(undefined)).toBe(true);
    expect(isEmptyTheme({})).toBe(true);
    expect(isEmptyTheme({ colors: {} })).toBe(true);
    expect(isEmptyTheme({ preset: 'light' })).toBe(false);
    expect(isEmptyTheme({ colors: { accent: '#f00' } })).toBe(false);
  });
});

describe('ThemeProvider', () => {
  const themed = (container: HTMLElement) => container.querySelector('.fp-theme') as HTMLElement;

  it('puts the variables on a scoping element', () => {
    const { container } = render(
      <ThemeProvider theme={{ colors: { accent: '#e11d48' } }}>
        <span>content</span>
      </ThemeProvider>
    );

    expect(themed(container).style.getPropertyValue('--fp-color-accent')).toBe('#e11d48');
  });

  it('sets data-theme for a preset so the stylesheet blocks apply', () => {
    const { container } = render(
      <ThemeProvider theme={{ preset: 'light' }}>
        <span />
      </ThemeProvider>
    );

    expect(themed(container)).toHaveAttribute('data-theme', 'light');
  });

  it('sets no data-theme without a preset', () => {
    const { container } = render(
      <ThemeProvider theme={{ colors: { accent: '#f00' } }}>
        <span />
      </ThemeProvider>
    );

    expect(themed(container)).not.toHaveAttribute('data-theme');
  });

  it('emits nothing when given no theme at all', () => {
    const { container } = render(
      <ThemeProvider>
        <span />
      </ThemeProvider>
    );

    // The default look is the stylesheet's, untouched.
    expect(themed(container).getAttribute('style')).toBeFalsy();
  });

  it('nests, with the inner theme refining the outer', () => {
    const { container } = render(
      <ThemeProvider theme={{ colors: { accent: '#aaa', text: '#fff' } }}>
        <ThemeProvider theme={{ colors: { accent: '#bbb' } }}>
          <span data-testid="leaf" />
        </ThemeProvider>
      </ThemeProvider>
    );

    const [outer, inner] = Array.from(container.querySelectorAll('.fp-theme')) as HTMLElement[];

    expect(outer.style.getPropertyValue('--fp-color-accent')).toBe('#aaa');
    expect(outer.style.getPropertyValue('--fp-color-text')).toBe('#fff');
    // The inner element only re-declares what it changes; `text` still cascades.
    expect(inner.style.getPropertyValue('--fp-color-accent')).toBe('#bbb');
    expect(inner.style.getPropertyValue('--fp-color-text')).toBe('');
  });

  it('scopes, so two subtrees can differ', () => {
    const { container } = render(
      <>
        <ThemeProvider theme={{ colors: { accent: '#111' } }}>
          <span />
        </ThemeProvider>
        <ThemeProvider theme={{ colors: { accent: '#222' } }}>
          <span />
        </ThemeProvider>
      </>
    );

    const [a, b] = Array.from(container.querySelectorAll('.fp-theme')) as HTMLElement[];
    expect(a.style.getPropertyValue('--fp-color-accent')).toBe('#111');
    expect(b.style.getPropertyValue('--fp-color-accent')).toBe('#222');
  });

  it('maps typography onto the font variables', () => {
    const vars = themeToCssVars({
      typography: { fontFamily: 'Georgia, serif', fontFamilyMono: 'Menlo, monospace' },
    });

    expect(vars).toEqual({
      '--fp-font-family': 'Georgia, serif',
      '--fp-font-family-mono': 'Menlo, monospace',
    });
  });

  it('themes a real component without it knowing anything about themes', () => {
    // The components read `var(--fp-*)`; the theme just sets those. Nothing in
    // ProgressBar needs to be theme-aware.
    const { container } = render(
      <ThemeProvider theme={{ progress: { fill: '#e11d48' }, border: { radius: '0px' } }}>
        <ProgressBar currentTime={30} duration={100} />
      </ThemeProvider>
    );

    const scope = themed(container);
    expect(scope.style.getPropertyValue('--fp-progress-fill')).toBe('#e11d48');
    expect(scope.style.getPropertyValue('--fp-border-radius')).toBe('0px');
    expect(scope.querySelector('[role="slider"]')).toBeInTheDocument();
  });
});
