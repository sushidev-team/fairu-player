/**
 * Turns a {@link FairuTheme} into CSS custom properties.
 *
 * The whole mechanism is: emit `--fp-*` on a scoping element. Because the
 * components already read those variables, and because an unset variable simply
 * inherits, a theme is purely additive — the stylesheet remains the default and
 * a config only overrides what it names.
 */

import type { FairuTheme } from '@/types/theme';

/** Maps a dotted path in the theme object to its CSS variable. */
const VAR_MAP: Record<string, string> = {
  'colors.background': '--fp-color-background',
  'colors.backgroundElevated': '--fp-color-background-elevated',
  'colors.surface': '--fp-color-surface',
  'colors.surfaceHover': '--fp-color-surface-hover',
  'colors.accent': '--fp-color-accent',
  'colors.accentHover': '--fp-color-accent-hover',
  'colors.accentGlow': '--fp-color-accent-glow',
  'colors.primary': '--fp-color-primary',
  'colors.primaryHover': '--fp-color-primary-hover',
  'colors.primaryActive': '--fp-color-primary-active',
  'colors.text': '--fp-color-text',
  'colors.textPrimary': '--fp-color-text-primary',
  'colors.textSecondary': '--fp-color-text-secondary',
  'colors.textMuted': '--fp-color-text-muted',

  'progress.background': '--fp-progress-bg',
  'progress.fill': '--fp-progress-fill',
  'progress.buffer': '--fp-progress-buffer',

  'border.color': '--fp-border-color',
  'border.radius': '--fp-border-radius',
  'border.radiusSm': '--fp-border-radius-sm',
  'border.radiusLg': '--fp-border-radius-lg',
  'border.radiusFull': '--fp-border-radius-full',

  'glass.background': '--fp-glass-bg',
  'glass.border': '--fp-glass-border',

  'shadows.sm': '--fp-shadow-sm',
  'shadows.md': '--fp-shadow',
  'shadows.lg': '--fp-shadow-md',
  'shadows.glow': '--fp-shadow-glow',

  'spacing.xs': '--fp-spacing-xs',
  'spacing.sm': '--fp-spacing-sm',
  'spacing.md': '--fp-spacing-md',
  'spacing.lg': '--fp-spacing-lg',
  'spacing.xl': '--fp-spacing-xl',

  'typography.fontFamily': '--fp-font-family',
  'typography.fontFamilyMono': '--fp-font-family-mono',

  'transitions.fast': '--fp-transition-fast',
  'transitions.normal': '--fp-transition-normal',
  'transitions.slow': '--fp-transition-slow',
  'transitions.morph': '--fp-transition-morph',
};

/** Normalise a `vars` key: `accent`, `fp-accent` and `--fp-accent` all work. */
function toCssVarName(key: string): string {
  if (key.startsWith('--')) return key;
  if (key.startsWith('fp-')) return `--${key}`;
  return `--fp-${key}`;
}

/**
 * Build the inline style for a theme.
 *
 * Only keys that are actually set produce a declaration — an `undefined` value
 * is skipped rather than written as `undefined`, which would otherwise
 * *override* the stylesheet default with an invalid value.
 *
 * @returns a style object; empty when the theme sets nothing
 */
export function themeToCssVars(theme: FairuTheme | undefined): React.CSSProperties {
  if (!theme) return {};

  const style: Record<string, string> = {};

  for (const [path, cssVar] of Object.entries(VAR_MAP)) {
    const [group, key] = path.split('.') as [keyof FairuTheme, string];
    const section = theme[group] as Record<string, string | undefined> | undefined;
    const value = section?.[key];
    if (typeof value === 'string' && value !== '') style[cssVar] = value;
  }

  // Applied last so an explicit `vars` entry beats the typed field it duplicates.
  for (const [key, value] of Object.entries(theme.vars ?? {})) {
    if (typeof value === 'string' && value !== '') style[toCssVarName(key)] = value;
  }

  return style as React.CSSProperties;
}

/**
 * Merge two themes, with `override` winning per leaf.
 *
 * Merges one level into each section rather than replacing it, so a base theme's
 * `colors.accent` survives an override that only sets `colors.background`.
 */
export function mergeThemes(
  base: FairuTheme | undefined,
  override: FairuTheme | undefined
): FairuTheme | undefined {
  if (!base) return override;
  if (!override) return base;

  const merged: FairuTheme = { ...base, ...override };

  for (const group of [
    'colors',
    'progress',
    'border',
    'glass',
    'shadows',
    'spacing',
    'typography',
    'transitions',
    'vars',
  ] as const) {
    const a = base[group];
    const b = override[group];
    if (a && b) {
      merged[group] = { ...a, ...b } as never;
    }
  }

  return merged;
}

/** Whether a theme would emit anything at all. */
export function isEmptyTheme(theme: FairuTheme | undefined): boolean {
  if (!theme) return true;
  if (theme.preset) return false;
  return Object.keys(themeToCssVars(theme)).length === 0;
}
