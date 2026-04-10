import { useState, useCallback, useMemo } from 'react';
import type {
  SubtitleStyle,
  UseSubtitleStylingOptions,
  UseSubtitleStylingReturn,
} from '@/types/subtitleStyling';
import {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_PRESETS,
} from '@/types/subtitleStyling';

const DEFAULT_STORAGE_KEY = 'fairu_subtitle_style';

function loadFromStorage(key: string): Partial<SubtitleStyle> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<SubtitleStyle>;
  } catch {
    return null;
  }
}

function saveToStorage(key: string, style: SubtitleStyle): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(style));
  } catch {
    // Silently ignore
  }
}

export function useSubtitleStyling(options: UseSubtitleStylingOptions = {}): UseSubtitleStylingReturn {
  const {
    initialStyle,
    persist = true,
    storageKey = DEFAULT_STORAGE_KEY,
  } = options;

  const [style, setStyle] = useState<SubtitleStyle>(() => {
    // Load from storage first, then merge with initialStyle and defaults
    const stored = persist ? loadFromStorage(storageKey) : null;
    return {
      ...DEFAULT_SUBTITLE_STYLE,
      ...initialStyle,
      ...stored,
    };
  });

  const updateStyle = useCallback((updates: Partial<SubtitleStyle>) => {
    setStyle((prev) => {
      const next = { ...prev, ...updates };
      if (persist) saveToStorage(storageKey, next);
      return next;
    });
  }, [persist, storageKey]);

  const applyPreset = useCallback((presetName: string) => {
    const preset = SUBTITLE_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setStyle(preset.style);
      if (persist) saveToStorage(storageKey, preset.style);
    }
  }, [persist, storageKey]);

  const resetStyle = useCallback(() => {
    setStyle(DEFAULT_SUBTITLE_STYLE);
    if (persist) saveToStorage(storageKey, DEFAULT_SUBTITLE_STYLE);
  }, [persist, storageKey]);

  const cssProperties = useMemo((): React.CSSProperties => {
    // Convert hex + opacity to rgba
    const hexToRgba = (hex: string, opacity: number): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    return {
      fontSize: `${style.fontSize}px`,
      fontFamily: style.fontFamily,
      color: style.textColor,
      backgroundColor: hexToRgba(style.backgroundColor, style.backgroundOpacity),
      textShadow: style.textShadow,
      ...(style.position === 'top'
        ? { top: '10%', bottom: 'auto' }
        : { bottom: '10%', top: 'auto' }),
      padding: '4px 8px',
      borderRadius: '4px',
    };
  }, [style]);

  return {
    style,
    updateStyle,
    applyPreset,
    resetStyle,
    cssProperties,
    presets: SUBTITLE_PRESETS,
  };
}
