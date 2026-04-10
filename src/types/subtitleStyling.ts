export interface SubtitleStyle {
  /** Font size in pixels. Default: 16 */
  fontSize: number;
  /** Font family. Default: 'inherit' */
  fontFamily: string;
  /** Text color. Default: '#ffffff' */
  textColor: string;
  /** Background color (without opacity). Default: '#000000' */
  backgroundColor: string;
  /** Background opacity 0-1. Default: 0.75 */
  backgroundOpacity: number;
  /** Position: 'top' or 'bottom'. Default: 'bottom' */
  position: 'top' | 'bottom';
  /** Text shadow for readability. Default: 'none' */
  textShadow: string;
}

export interface SubtitleStylePreset {
  name: string;
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

export const SUBTITLE_PRESETS: SubtitleStylePreset[] = [
  {
    name: 'default',
    label: 'Default',
    style: { ...DEFAULT_SUBTITLE_STYLE },
  },
  {
    name: 'high-contrast',
    label: 'High Contrast',
    style: {
      fontSize: 18,
      fontFamily: 'inherit',
      textColor: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 1,
      position: 'bottom',
      textShadow: '2px 2px 4px rgba(0,0,0,0.9)',
    },
  },
  {
    name: 'yellow-on-black',
    label: 'Yellow on Black',
    style: {
      fontSize: 18,
      fontFamily: 'inherit',
      textColor: '#ffff00',
      backgroundColor: '#000000',
      backgroundOpacity: 0.85,
      position: 'bottom',
      textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
    },
  },
  {
    name: 'transparent',
    label: 'No Background',
    style: {
      fontSize: 18,
      fontFamily: 'inherit',
      textColor: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 0,
      position: 'bottom',
      textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.5)',
    },
  },
];

export interface UseSubtitleStylingOptions {
  /** Initial style overrides */
  initialStyle?: Partial<SubtitleStyle>;
  /** Whether to persist to localStorage. Default: true */
  persist?: boolean;
  /** localStorage key. Default: 'fairu_subtitle_style' */
  storageKey?: string;
}

export interface UseSubtitleStylingReturn {
  /** Current subtitle style */
  style: SubtitleStyle;
  /** Update one or more style properties */
  updateStyle: (updates: Partial<SubtitleStyle>) => void;
  /** Apply a preset */
  applyPreset: (presetName: string) => void;
  /** Reset to default */
  resetStyle: () => void;
  /** CSS properties object to apply to the subtitle container */
  cssProperties: React.CSSProperties;
  /** Available presets */
  presets: SubtitleStylePreset[];
}
