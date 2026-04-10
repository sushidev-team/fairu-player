export interface EqualizerBand {
  /** Frequency in Hz */
  frequency: number;
  /** Gain in dB (-12 to +12) */
  gain: number;
  /** Filter type */
  type: BiquadFilterType;
  /** Q factor (quality) */
  Q: number;
}

export interface EqualizerPreset {
  name: string;
  label: string;
  bands: number[]; // Gain values for each band, in order
}

export const DEFAULT_BANDS: EqualizerBand[] = [
  { frequency: 60, gain: 0, type: 'lowshelf', Q: 1 },
  { frequency: 230, gain: 0, type: 'peaking', Q: 1 },
  { frequency: 910, gain: 0, type: 'peaking', Q: 1 },
  { frequency: 4000, gain: 0, type: 'peaking', Q: 1 },
  { frequency: 14000, gain: 0, type: 'highshelf', Q: 1 },
];

export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  { name: 'flat', label: 'Flat', bands: [0, 0, 0, 0, 0] },
  { name: 'podcast', label: 'Podcast', bands: [-2, 1, 4, 3, 1] },
  { name: 'music', label: 'Music', bands: [3, 1, 0, 2, 4] },
  { name: 'bass-boost', label: 'Bass Boost', bands: [6, 4, 0, 0, 0] },
  { name: 'treble-boost', label: 'Treble Boost', bands: [0, 0, 0, 4, 6] },
  { name: 'voice-boost', label: 'Voice Boost', bands: [-2, 0, 5, 4, 0] },
];

export interface UseEqualizerOptions {
  /** Ref to the audio or video element */
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  /** Whether the equalizer is enabled. Default: false */
  enabled?: boolean;
  /** Initial preset name. Default: 'flat' */
  initialPreset?: string;
  /** Whether to persist settings to localStorage. Default: true */
  persist?: boolean;
  /** localStorage key. Default: 'fairu_equalizer' */
  storageKey?: string;
}

export interface UseEqualizerReturn {
  /** Current band settings */
  bands: EqualizerBand[];
  /** Set gain for a specific band by index */
  setBandGain: (index: number, gain: number) => void;
  /** Apply a preset by name */
  applyPreset: (presetName: string) => void;
  /** Reset all bands to flat */
  reset: () => void;
  /** Whether the equalizer is connected */
  isConnected: boolean;
  /** Whether the equalizer is enabled */
  enabled: boolean;
  /** Toggle enabled state */
  setEnabled: (enabled: boolean) => void;
  /** Available presets */
  presets: EqualizerPreset[];
  /** Current preset name (null if custom) */
  currentPreset: string | null;
}
