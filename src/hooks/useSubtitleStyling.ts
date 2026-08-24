import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { readStored, writeStored } from '@/utils/storage';
import {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_PRESETS,
  cueLineFor,
  findPreset,
  normalizeStyle,
  toCueCss,
  type SubtitleStyle,
  type SubtitleStylePreset,
} from '@/core/subtitleStyle';

const STORAGE_KEY = 'subtitle-style';

export interface UseSubtitleStylingOptions {
  /** Starting point, before anything the viewer saved. */
  initialStyle?: Partial<SubtitleStyle>;
  /** Remember the viewer's choice. Default `true`. */
  persist?: boolean;
  /** Storage key, within the package's namespace. */
  storageKey?: string;
  /**
   * The media element, when the caller has one.
   *
   * Only needed for `position`: a cue's placement is a property on the cue
   * object rather than something CSS can reach, so it has to be written to the
   * cues themselves. Everything else works without it.
   */
  videoRef?: React.RefObject<HTMLMediaElement | null>;
}

export interface UseSubtitleStylingReturn {
  style: SubtitleStyle;
  updateStyle: (updates: Partial<SubtitleStyle>) => void;
  applyPreset: (presetName: string) => void;
  resetStyle: () => void;
  presets: readonly SubtitleStylePreset[];
  /**
   * Spread onto the player container. Ties the generated `::cue` rule to this
   * player and no other.
   */
  scopeProps: { 'data-fp-cue-scope': string };
}

/**
 * Subtitle appearance — size, colour, backing box, position.
 *
 * Ported from PR #16, where the hook returned a React style object. There is
 * nothing here to apply that to: the player renders subtitles the way the
 * platform does, with a `<track>` element, so the browser draws the cues. The
 * only thing that styles them is `::cue`, which means a real stylesheet — this
 * hook writes one into the document and scopes it to the calling player.
 *
 * @example
 * const subtitles = useSubtitleStyling({ videoRef });
 * <div {...subtitles.scopeProps}>…</div>
 */
export function useSubtitleStyling(
  options: UseSubtitleStylingOptions = {}
): UseSubtitleStylingReturn {
  const {
    initialStyle,
    persist = true,
    storageKey = STORAGE_KEY,
    videoRef,
  } = options;

  const scopeId = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const [style, setStyle] = useState<SubtitleStyle>(() => {
    const stored = persist ? readStored<Partial<SubtitleStyle>>(storageKey) : null;
    // What the viewer chose beats what the host suggested; both go through
    // `normalizeStyle`, because stored preferences outlive their schema.
    return normalizeStyle({ ...DEFAULT_SUBTITLE_STYLE, ...initialStyle, ...stored });
  });

  const persistRef = useRef({ persist, storageKey });
  useEffect(() => {
    persistRef.current = { persist, storageKey };
  });

  const commit = useCallback((next: SubtitleStyle) => {
    setStyle(next);
    const { persist: on, storageKey: key } = persistRef.current;
    if (on) writeStored(key, next);
  }, []);

  const updateStyle = useCallback(
    (updates: Partial<SubtitleStyle>) => {
      setStyle((current) => {
        const next = normalizeStyle({ ...current, ...updates });
        const { persist: on, storageKey: key } = persistRef.current;
        if (on) writeStored(key, next);
        return next;
      });
    },
    []
  );

  const applyPreset = useCallback(
    (presetName: string) => {
      const preset = findPreset(presetName);
      if (preset) commit({ ...preset.style });
    },
    [commit]
  );

  const resetStyle = useCallback(() => {
    commit({ ...DEFAULT_SUBTITLE_STYLE });
  }, [commit]);

  /* --------------------------- The stylesheet --------------------------- */

  const cueCss = useMemo(() => toCueCss(style, scopeId), [style, scopeId]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const element = document.createElement('style');
    element.dataset.fpCueScope = scopeId;
    document.head.appendChild(element);

    return () => {
      element.remove();
    };
  }, [scopeId]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const element = document.head.querySelector<HTMLStyleElement>(
      `style[data-fp-cue-scope="${scopeId}"]`
    );
    if (element) element.textContent = cueCss;
  }, [cueCss, scopeId]);

  /* ----------------------------- Cue position ---------------------------- */

  useEffect(() => {
    const element = videoRef?.current;
    if (!element) return;

    const line = cueLineFor(style.position);

    /**
     * Cues arrive with the track, which loads after the element does, so this
     * has to run again on `load` rather than once — otherwise a position set
     * before the file arrived applies to nothing.
     */
    const apply = () => {
      const tracks = element.textTracks;
      for (let i = 0; i < tracks.length; i += 1) {
        const track = tracks[i];
        if (track.kind !== 'subtitles' && track.kind !== 'captions') continue;
        const cues = track.cues;
        if (!cues) continue;

        for (let c = 0; c < cues.length; c += 1) {
          const cue = cues[c] as VTTCue;
          // Only VTTCue carries `line`; a plain TextTrackCue does not.
          if ('line' in cue) cue.line = line;
        }
      }
    };

    apply();

    const tracks = element.textTracks;

    /*
      Three signals, because none of them alone covers the case.

      The `load` of the subtitle *file* fires on the `<track>` element, not on
      the `TextTrack` — until it does, `TextTrack.cues` is `null` and there is
      nothing to write to. `addtrack` covers tracks added after mount, and
      `cuechange` is the backstop for anything that replaces the cue list while
      playing.
    */
    const trackElements = Array.from(
      element.querySelectorAll?.('track') ?? []
    ) as HTMLTrackElement[];

    trackElements.forEach((track) => track.addEventListener('load', apply));
    tracks.addEventListener?.('addtrack', apply);
    for (let i = 0; i < tracks.length; i += 1) {
      tracks[i].addEventListener?.('cuechange', apply);
    }

    return () => {
      trackElements.forEach((track) => track.removeEventListener('load', apply));
      tracks.removeEventListener?.('addtrack', apply);
      for (let i = 0; i < tracks.length; i += 1) {
        tracks[i].removeEventListener?.('cuechange', apply);
      }
    };
  }, [style.position, videoRef]);

  const scopeProps = useMemo(
    () => ({ 'data-fp-cue-scope': scopeId }) as const,
    [scopeId]
  );

  return { style, updateStyle, applyPreset, resetStyle, presets: SUBTITLE_PRESETS, scopeProps };
}
