import React, { createContext, useContext, useMemo } from 'react';
import { cn } from '@/utils/cn';
import { mergeThemes, themeToCssVars } from '@/utils/theme';
import type { FairuTheme } from '@/types/theme';

export interface ThemeContextValue {
  /** The theme in force, already merged with any ancestor provider. */
  theme: FairuTheme | undefined;
}

export const ThemeContext = createContext<ThemeContextValue>({ theme: undefined });

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Overrides. Merged over an ancestor provider's theme, leaf by leaf. */
  theme?: FairuTheme;
  /** Element to render. Default `div`. */
  as?: 'div' | 'span' | 'section';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Scopes a theme to its subtree.
 *
 * Renders one element carrying the `--fp-*` custom properties the theme sets,
 * plus `data-theme` when it names a preset. Nothing else — the components
 * already read those variables, so this is the entire mechanism.
 *
 * ```tsx
 * <ThemeProvider theme={{ colors: { accent: '#e11d48' }, border: { radius: '0' } }}>
 *   <VideoPlayer track={track} />
 * </ThemeProvider>
 * ```
 *
 * Nesting merges rather than replaces, so a page-level brand theme can be
 * refined per player without restating it.
 */
export function ThemeProvider({
  children,
  theme,
  as: Element = 'div',
  className,
  style,
}: ThemeProviderProps) {
  const inherited = useContext(ThemeContext).theme;
  const merged = useMemo(() => mergeThemes(inherited, theme), [inherited, theme]);
  const value = useMemo<ThemeContextValue>(() => ({ theme: merged }), [merged]);

  // Only the overrides are emitted; everything unset keeps inheriting the
  // stylesheet, which is what makes the existing look the default.
  const vars = useMemo(() => themeToCssVars(theme), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <Element
        // `data-theme` is what the stylesheet's preset blocks key off, so a
        // preset works through exactly the same path as the toolbar switcher.
        data-theme={theme?.preset}
        className={cn('fp-theme', className)}
        style={{ ...vars, ...style }}
      >
        {children}
      </Element>
    </ThemeContext.Provider>
  );
}

/** Read the theme in force. Returns `undefined` outside any provider. */
export function useTheme(): FairuTheme | undefined {
  return useContext(ThemeContext).theme;
}

export default ThemeProvider;
