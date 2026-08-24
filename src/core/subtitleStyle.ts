/**
 * How subtitles look, and how that reaches the browser.
 *
 * Ported from PR #16, where the style was returned as a React style object.
 * That does not work here: the player renders subtitles the way the platform
 * does — a `<track>` element and `textTrack.mode = 'showing'` — so the browser
 * draws the cues and there is no element of ours to put a style on. The only
 * thing that styles a native cue is the `::cue` pseudo-element, so that is what
 * this produces.
 *
 * Everything below is pure: no React, no `document`.
 */

export interface SubtitleStyle {
  /** Font size in pixels. */
  fontSize: number;
  /** CSS font family, or `'inherit'`. */
  fontFamily: string;
  /** Text colour, `#rrggbb`. */
  textColor: string;
  /** Backing colour, `#rrggbb`. Combined with `backgroundOpacity`. */
  backgroundColor: string;
  /** 0 = no box, 1 = solid. */
  backgroundOpacity: number;
  /** Which edge the cues sit at. */
  position: 'top' | 'bottom';
  /** CSS `text-shadow`, or `'none'`. */
  textShadow: string;
}

export interface SubtitleStylePreset {
  /** Stable identifier — what gets stored and passed around. */
  name: string;
  /** Fallback English label; hosts with a labels table override it. */
  label: string;
  style: SubtitleStyle;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 16,
  fontFamily: 'inherit',
  textColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.75,
  position: 'bottom',
  textShadow: 'none',
};

export const SUBTITLE_PRESETS: readonly SubtitleStylePreset[] = [
  { name: 'default', label: 'Default', style: { ...DEFAULT_SUBTITLE_STYLE } },
  {
    name: 'high-contrast',
    label: 'High contrast',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 18,
      backgroundOpacity: 1,
      textShadow: '2px 2px 4px rgba(0,0,0,0.9)',
    },
  },
  {
    name: 'yellow-on-black',
    label: 'Yellow on black',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 18,
      textColor: '#ffff00',
      backgroundOpacity: 0.85,
      textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
    },
  },
  {
    name: 'no-background',
    label: 'No background',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 18,
      backgroundOpacity: 0,
      textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.5)',
    },
  },
];

export function findPreset(name: string): SubtitleStylePreset | undefined {
  return SUBTITLE_PRESETS.find((preset) => preset.name === name);
}

/* -------------------------------------------------------------------------- */

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * `#rgb` or `#rrggbb` plus an opacity → `rgba(...)`.
 *
 * Returns `null` for anything else rather than guessing. The version this was
 * ported from ran `parseInt` over the string unconditionally, so a named colour
 * or a shorthand produced `rgba(NaN, NaN, NaN, …)` — invalid CSS, which the
 * browser drops, so the backing box silently disappeared.
 */
export function hexToRgba(hex: string, opacity: number): string | null {
  if (!HEX.test(hex)) return null;

  const digits = hex.slice(1);
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const alpha = clamp(opacity, 0, 1);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * A trusted style from an untrusted partial.
 *
 * Stored preferences outlive the schema that wrote them, and they are the one
 * input here that nobody reviews: a value left over from an older version, or
 * edited by hand, otherwise flows straight into a stylesheet. Each field falls
 * back to the default on its own, so one bad entry does not discard the rest.
 */
export function normalizeStyle(partial: Partial<SubtitleStyle> | null | undefined): SubtitleStyle {
  const input = partial ?? {};

  return {
    fontSize: isFiniteNumber(input.fontSize) ? clamp(input.fontSize, 8, 96) : DEFAULT_SUBTITLE_STYLE.fontSize,
    fontFamily: isSafeFontFamily(input.fontFamily) ? input.fontFamily : DEFAULT_SUBTITLE_STYLE.fontFamily,
    textColor: typeof input.textColor === 'string' && HEX.test(input.textColor)
      ? input.textColor
      : DEFAULT_SUBTITLE_STYLE.textColor,
    backgroundColor: typeof input.backgroundColor === 'string' && HEX.test(input.backgroundColor)
      ? input.backgroundColor
      : DEFAULT_SUBTITLE_STYLE.backgroundColor,
    backgroundOpacity: isFiniteNumber(input.backgroundOpacity)
      ? clamp(input.backgroundOpacity, 0, 1)
      : DEFAULT_SUBTITLE_STYLE.backgroundOpacity,
    position: input.position === 'top' || input.position === 'bottom'
      ? input.position
      : DEFAULT_SUBTITLE_STYLE.position,
    textShadow: isSafeCssValue(input.textShadow) ? input.textShadow : DEFAULT_SUBTITLE_STYLE.textShadow,
  };
}

/**
 * The `::cue` rule for one player.
 *
 * Scoped by an attribute rather than written globally, so two players on one
 * page do not overwrite each other's subtitles.
 *
 * `position` is deliberately absent: a cue's placement comes from its own
 * `line` setting, which is a property on the cue object and not something CSS
 * can reach. The hook applies that separately.
 */
export function toCueCss(style: SubtitleStyle, scopeId: string): string {
  const background = hexToRgba(style.backgroundColor, style.backgroundOpacity)
    ?? hexToRgba(DEFAULT_SUBTITLE_STYLE.backgroundColor, style.backgroundOpacity)
    ?? 'transparent';

  const declarations = [
    `color: ${style.textColor}`,
    `background-color: ${background}`,
    `font-size: ${style.fontSize}px`,
    `text-shadow: ${style.textShadow}`,
  ];

  if (style.fontFamily !== 'inherit') {
    declarations.push(`font-family: ${style.fontFamily}`);
  }

  return `[data-fp-cue-scope="${scopeId}"] video::cue { ${declarations.join('; ')}; }`;
}

/** Where a cue sits, in the units `TextTrackCue.line` uses. */
export function cueLineFor(position: SubtitleStyle['position']): number | 'auto' {
  // `0` is the first line from the top; `auto` leaves the browser's default,
  // which is the bottom.
  return position === 'top' ? 0 : 'auto';
}

/* -------------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Values that end up inside a stylesheet cannot contain the characters that
 * would let them close the declaration and start another one.
 */
function isSafeCssValue(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 200 && !/[{}<>;]/.test(value);
}

function isSafeFontFamily(value: unknown): value is string {
  return isSafeCssValue(value) && value.length > 0;
}
