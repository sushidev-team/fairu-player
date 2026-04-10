import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  EqualizerBand,
  UseEqualizerOptions,
  UseEqualizerReturn,
} from '@/types/equalizer';
import {
  DEFAULT_BANDS,
  EQUALIZER_PRESETS,
} from '@/types/equalizer';

const DEFAULT_STORAGE_KEY = 'fairu_equalizer';

interface StoredState {
  gains: number[];
  enabled: boolean;
  preset: string | null;
}

function loadFromStorage(key: string): StoredState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as StoredState;
  } catch {
    return null;
  }
}

function saveToStorage(key: string, state: StoredState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Silently ignore
  }
}

export function useEqualizer(options: UseEqualizerOptions): UseEqualizerReturn {
  const {
    mediaRef,
    enabled: initialEnabled = false,
    initialPreset = 'flat',
    persist = true,
    storageKey = DEFAULT_STORAGE_KEY,
  } = options;

  // Load stored state
  const stored = persist ? loadFromStorage(storageKey) : null;

  const [enabled, setEnabledState] = useState(stored?.enabled ?? initialEnabled);
  const [currentPreset, setCurrentPreset] = useState<string | null>(stored?.preset ?? initialPreset);
  const [bands, setBands] = useState<EqualizerBand[]>(() => {
    if (stored?.gains) {
      return DEFAULT_BANDS.map((band, i) => ({
        ...band,
        gain: stored.gains[i] ?? 0,
      }));
    }
    // Apply initial preset
    const preset = EQUALIZER_PRESETS.find((p) => p.name === initialPreset);
    if (preset) {
      return DEFAULT_BANDS.map((band, i) => ({
        ...band,
        gain: preset.bands[i] ?? 0,
      }));
    }
    return DEFAULT_BANDS.map((b) => ({ ...b }));
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Persist state
  const persistState = useCallback((b: EqualizerBand[], en: boolean, preset: string | null) => {
    if (persist) {
      saveToStorage(storageKey, {
        gains: b.map((band) => band.gain),
        enabled: en,
        preset,
      });
    }
  }, [persist, storageKey]);

  // Connect Web Audio API
  const connect = useCallback(() => {
    const media = mediaRef.current;
    if (!media || isConnected) return;

    try {
      // Create or reuse AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;

      // Create source (only once per element)
      if (!sourceRef.current) {
        sourceRef.current = ctx.createMediaElementSource(media);
      }
      const source = sourceRef.current;

      // Create filter chain
      const filters = bands.map((band) => {
        const filter = ctx.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.frequency;
        filter.gain.value = band.gain;
        filter.Q.value = band.Q;
        return filter;
      });

      // Connect: source -> filter1 -> filter2 -> ... -> destination
      source.disconnect();
      if (filters.length > 0) {
        source.connect(filters[0]);
        for (let i = 0; i < filters.length - 1; i++) {
          filters[i].connect(filters[i + 1]);
        }
        filters[filters.length - 1].connect(ctx.destination);
      } else {
        source.connect(ctx.destination);
      }

      filtersRef.current = filters;
      setIsConnected(true);
    } catch {
      // Web Audio API not supported or other error
      setIsConnected(false);
    }
  }, [mediaRef, isConnected, bands]);

  // Disconnect
  const disconnect = useCallback(() => {
    const source = sourceRef.current;
    const ctx = audioContextRef.current;

    if (source && ctx) {
      try {
        source.disconnect();
        source.connect(ctx.destination);
      } catch {
        // Ignore
      }
    }

    filtersRef.current = [];
    setIsConnected(false);
  }, []);

  // Connect/disconnect based on enabled state
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }
  }, [enabled, connect, disconnect]);

  // Update filter gains when bands change
  useEffect(() => {
    filtersRef.current.forEach((filter, i) => {
      if (bands[i]) {
        filter.gain.value = bands[i].gain;
      }
    });
  }, [bands]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect();
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, [disconnect]);

  const setBandGain = useCallback((index: number, gain: number) => {
    setBands((prev) => {
      const next = prev.map((band, i) =>
        i === index ? { ...band, gain: Math.max(-12, Math.min(12, gain)) } : band
      );
      setCurrentPreset(null);
      persistState(next, enabled, null);
      return next;
    });
  }, [enabled, persistState]);

  const applyPreset = useCallback((presetName: string) => {
    const preset = EQUALIZER_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;

    setBands((prev) => {
      const next = prev.map((band, i) => ({
        ...band,
        gain: preset.bands[i] ?? 0,
      }));
      persistState(next, enabled, presetName);
      return next;
    });
    setCurrentPreset(presetName);
  }, [enabled, persistState]);

  const reset = useCallback(() => {
    applyPreset('flat');
  }, [applyPreset]);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    persistState(bands, value, currentPreset);
  }, [bands, currentPreset, persistState]);

  return {
    bands,
    setBandGain,
    applyPreset,
    reset,
    isConnected,
    enabled,
    setEnabled,
    presets: EQUALIZER_PRESETS,
    currentPreset,
  };
}
