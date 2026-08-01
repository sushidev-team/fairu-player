/**
 * Theme configuration.
 *
 * Every component in this library styles itself from `--fp-*` custom properties
 * declared in `src/styles/variables.css`. A theme is therefore not a parallel
 * styling system — it is just those same variables, set from JavaScript on a
 * scoping element.
 *
 * Two consequences worth relying on:
 *
 * 1. **Partial overrides cascade.** Only the values you set are emitted;
 *    everything else keeps inheriting the stylesheet default. `{ colors:
 *    { accent: '#f00' } }` changes the accent and nothing more.
 * 2. **Themes scope.** The variables land on a wrapper element, so two players
 *    on one page can look different without fighting each other.
 *
 * Values are raw CSS, so anything valid in a custom property works —
 * `'#00a99d'`, `'oklch(0.7 0.1 180)'`, `'var(--brand-500)'`.
 */

/** Built-in presets, matching the `[data-theme]` blocks in the stylesheet. */
export type ThemePreset = 'dark' | 'light' | 'high-contrast';

export interface ThemeColors {
  /** Page/base surface. `--fp-color-background` */
  background?: string;
  /** Raised surface, e.g. a card. `--fp-color-background-elevated` */
  backgroundElevated?: string;
  /** Control surface. `--fp-color-surface` */
  surface?: string;
  /** Control surface on hover. `--fp-color-surface-hover` */
  surfaceHover?: string;

  /** Brand colour — progress fill, active controls. `--fp-color-accent` */
  accent?: string;
  /** `--fp-color-accent-hover` */
  accentHover?: string;
  /** Glow used behind focused/active controls. `--fp-color-accent-glow` */
  accentGlow?: string;

  /**
   * Primary action colour. Defaults to `accent` in the stylesheet, so setting
   * `accent` alone is usually enough.
   * `--fp-color-primary`
   */
  primary?: string;
  /** `--fp-color-primary-hover` */
  primaryHover?: string;
  /** `--fp-color-primary-active` */
  primaryActive?: string;

  /** Body text. `--fp-color-text` */
  text?: string;
  /** `--fp-color-text-primary` */
  textPrimary?: string;
  /** `--fp-color-text-secondary` */
  textSecondary?: string;
  /** `--fp-color-text-muted` */
  textMuted?: string;
}

export interface ThemeProgress {
  /** Unplayed track. `--fp-progress-bg` */
  background?: string;
  /** Played portion. `--fp-progress-fill` */
  fill?: string;
  /** Buffered portion. `--fp-progress-buffer` */
  buffer?: string;
}

export interface ThemeBorder {
  /** `--fp-border-color` */
  color?: string;
  /** Default radius. `--fp-border-radius` */
  radius?: string;
  /** `--fp-border-radius-sm` */
  radiusSm?: string;
  /** `--fp-border-radius-lg` */
  radiusLg?: string;
  /** Pill radius. `--fp-border-radius-full` */
  radiusFull?: string;
}

export interface ThemeGlass {
  /** Backdrop fill for overlay panels. `--fp-glass-bg` */
  background?: string;
  /** Hairline on overlay panels. `--fp-glass-border` */
  border?: string;
}

export interface ThemeShadows {
  /** `--fp-shadow-sm` */
  sm?: string;
  /** `--fp-shadow` */
  md?: string;
  /** `--fp-shadow-md` */
  lg?: string;
  /** Glow behind active controls. `--fp-shadow-glow` */
  glow?: string;
}

export interface ThemeSpacing {
  /** `--fp-spacing-xs` */
  xs?: string;
  /** `--fp-spacing-sm` */
  sm?: string;
  /** `--fp-spacing-md` */
  md?: string;
  /** `--fp-spacing-lg` */
  lg?: string;
  /** `--fp-spacing-xl` */
  xl?: string;
}

export interface ThemeTypography {
  /** `--fp-font-family` */
  fontFamily?: string;
  /** Used for timecodes and tabular numbers. `--fp-font-family-mono` */
  fontFamilyMono?: string;
}

export interface ThemeTransitions {
  /** `--fp-transition-fast` */
  fast?: string;
  /** `--fp-transition-normal` */
  normal?: string;
  /** `--fp-transition-slow` */
  slow?: string;
  /** Used for shape changes. `--fp-transition-morph` */
  morph?: string;
}

/**
 * A theme.
 *
 * ```tsx
 * // Just the brand colour — everything else stays as it is.
 * <VideoPlayer theme={{ colors: { accent: '#e11d48' } }} />
 *
 * // A preset plus overrides.
 * <VideoPlayer theme={{ preset: 'light', border: { radius: '0' } }} />
 *
 * // Bound to your own design tokens.
 * <VideoPlayer theme={{ colors: { accent: 'var(--brand-500)' } }} />
 * ```
 */
export interface FairuTheme {
  /**
   * Start from a built-in preset. Omitted, the stylesheet default (dark) or
   * whatever `[data-theme]` an ancestor set stays in force.
   */
  preset?: ThemePreset;
  colors?: ThemeColors;
  progress?: ThemeProgress;
  border?: ThemeBorder;
  glass?: ThemeGlass;
  shadows?: ThemeShadows;
  spacing?: ThemeSpacing;
  typography?: ThemeTypography;
  transitions?: ThemeTransitions;
  /**
   * Escape hatch for variables with no typed field — including the `--fp-blue-*`
   * ramp. Keys may be written with or without the `--fp-` prefix.
   *
   * ```ts
   * vars: { 'blue-500': '#0ea5e9', '--fp-color-accent': '#0ea5e9' }
   * ```
   */
  vars?: Record<string, string | undefined>;
}
