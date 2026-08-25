/**
 * A five-band equaliser, as plain data.
 *
 * Ported from PR #16. The audio graph belongs to the hook — what lives here is
 * everything that can be decided without one: the band layout, the presets,
 * what a gain may be, and how a stored setting is read back.
 */

export interface EqualizerBand {
  /** Centre frequency in Hz. */
  frequency: number;
  /** Gain in dB, within {@link GAIN_RANGE}. */
  gain: number;
  type: BiquadFilterType;
  /** Filter quality. */
  Q: number;
}

export interface EqualizerPreset {
  name: string;
  /** Fallback English label; hosts with a labels table override it. */
  label: string;
  /** One gain per band, in order. */
  gains: number[];
}

/** Past ±12 dB a five-band EQ mostly produces clipping, not tone. */
export const GAIN_RANGE = { min: -12, max: 12 } as const;

export const DEFAULT_BANDS: readonly EqualizerBand[] = [
  { frequency: 60, gain: 0, type: 'lowshelf', Q: 1 },
  { frequency: 230, gain: 0, type: 'peaking', Q: 1 },
  { frequency: 910, gain: 0, type: 'peaking', Q: 1 },
  { frequency: 4000, gain: 0, type: 'peaking', Q: 1 },
  { frequency: 14000, gain: 0, type: 'highshelf', Q: 1 },
];

export const EQUALIZER_PRESETS: readonly EqualizerPreset[] = [
  { name: 'flat', label: 'Flat', gains: [0, 0, 0, 0, 0] },
  { name: 'podcast', label: 'Podcast', gains: [-2, 1, 4, 3, 1] },
  { name: 'music', label: 'Music', gains: [3, 1, 0, 2, 4] },
  { name: 'bass-boost', label: 'Bass boost', gains: [6, 4, 0, 0, 0] },
  { name: 'treble-boost', label: 'Treble boost', gains: [0, 0, 0, 4, 6] },
  { name: 'voice-boost', label: 'Voice boost', gains: [-2, 0, 5, 4, 0] },
];

export function findPreset(name: string): EqualizerPreset | undefined {
  return EQUALIZER_PRESETS.find((preset) => preset.name === name);
}

export function clampGain(gain: number): number {
  if (!Number.isFinite(gain)) return 0;
  return Math.min(GAIN_RANGE.max, Math.max(GAIN_RANGE.min, gain));
}

/** The bands a preset describes. Unknown names give a flat set. */
export function bandsForPreset(name: string): EqualizerBand[] {
  const preset = findPreset(name);
  return DEFAULT_BANDS.map((band, index) => ({
    ...band,
    gain: clampGain(preset?.gains[index] ?? 0),
  }));
}

export function setBandGain(
  bands: readonly EqualizerBand[],
  index: number,
  gain: number
): EqualizerBand[] {
  if (index < 0 || index >= bands.length) return bands as EqualizerBand[];
  return bands.map((band, i) => (i === index ? { ...band, gain: clampGain(gain) } : band));
}

/**
 * Which preset these bands are, if any.
 *
 * Matched by value rather than remembered by name: nudging one slider after
 * choosing "Podcast" is no longer Podcast, and a UI that still says so is
 * lying about what the listener is hearing.
 */
export function matchPreset(bands: readonly EqualizerBand[]): string | null {
  const gains = bands.map((band) => band.gain);
  const found = EQUALIZER_PRESETS.find(
    (preset) =>
      preset.gains.length === gains.length &&
      preset.gains.every((gain, index) => gain === gains[index])
  );
  return found?.name ?? null;
}

export interface StoredEqualizer {
  gains: number[];
  enabled: boolean;
}

/**
 * A stored setting → bands.
 *
 * Anything unreadable falls back to flat rather than to silence or a boost
 * nobody chose.
 */
export function normalizeStored(value: unknown): { bands: EqualizerBand[]; enabled: boolean } {
  const stored = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >;

  const gains = Array.isArray(stored.gains) ? stored.gains : [];

  return {
    bands: DEFAULT_BANDS.map((band, index) => ({
      ...band,
      gain: clampGain(typeof gains[index] === 'number' ? (gains[index] as number) : 0),
    })),
    enabled: stored.enabled === true,
  };
}

export function toStored(bands: readonly EqualizerBand[], enabled: boolean): StoredEqualizer {
  return { gains: bands.map((band) => band.gain), enabled };
}
