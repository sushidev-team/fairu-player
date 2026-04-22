import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { LabelsProvider, useLabels } from './LabelsContext';
import { defaultLabels } from '@/types/labels';

const createWrapper = (labels?: Record<string, string>) => {
  return ({ children }: { children: React.ReactNode }) => (
    <LabelsProvider labels={labels}>{children}</LabelsProvider>
  );
};

describe('LabelsContext', () => {
  describe('useLabels hook', () => {
    it('returns default labels when no provider wraps it', () => {
      const { result } = renderHook(() => useLabels());
      expect(result.current).toEqual(defaultLabels);
    });

    it('returns default labels when provider has no custom labels', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });
      expect(result.current).toEqual(defaultLabels);
    });

    it('returns default play label', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });
      expect(result.current.play).toBe('Play');
    });

    it('returns default pause label', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });
      expect(result.current.pause).toBe('Pause');
    });

    it('returns default mute label', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });
      expect(result.current.mute).toBe('Mute');
    });

    it('returns default unmute label', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });
      expect(result.current.unmute).toBe('Unmute');
    });

    it('returns default volume label', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });
      expect(result.current.volume).toBe('Volume');
    });

    it('returns default skipForward label with template', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });
      expect(result.current.skipForward).toBe('Skip forward {seconds} seconds');
    });

    it('returns default skipBackward label with template', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });
      expect(result.current.skipBackward).toBe('Skip backward {seconds} seconds');
    });

    it('returns default ad-related labels', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });
      expect(result.current.ad).toBe('AD');
      expect(result.current.skipAd).toBe('Skip Ad');
      expect(result.current.skipIn).toBe('Skip in {seconds}s');
      expect(result.current.learnMore).toBe('Learn more about this ad');
    });

    it('returns default fullscreen labels', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });
      expect(result.current.enterFullscreen).toBe('Enter fullscreen');
      expect(result.current.exitFullscreen).toBe('Exit fullscreen');
    });

    it('returns default picture-in-picture labels', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });
      expect(result.current.enterPictureInPicture).toBe('Enter picture-in-picture');
      expect(result.current.exitPictureInPicture).toBe('Exit picture-in-picture');
    });

    it('returns default cast labels', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });
      expect(result.current.startCast).toBe('Cast');
      expect(result.current.stopCast).toBe('Stop casting');
    });
  });

  describe('Custom label overrides', () => {
    it('overrides a single label', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper({ play: 'Abspielen' }),
      });
      expect(result.current.play).toBe('Abspielen');
    });

    it('overrides multiple labels', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper({
          play: 'Abspielen',
          pause: 'Anhalten',
          mute: 'Stumm',
        }),
      });
      expect(result.current.play).toBe('Abspielen');
      expect(result.current.pause).toBe('Anhalten');
      expect(result.current.mute).toBe('Stumm');
    });

    it('preserves non-overridden defaults when overriding some labels', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper({ play: 'Reproducir' }),
      });
      expect(result.current.play).toBe('Reproducir');
      expect(result.current.pause).toBe('Pause');
      expect(result.current.mute).toBe('Mute');
      expect(result.current.volume).toBe('Volume');
      expect(result.current.enterFullscreen).toBe('Enter fullscreen');
    });

    it('overrides ad labels while keeping other defaults', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper({
          skipAd: 'Werbung uberspringen',
          learnMore: 'Mehr erfahren',
        }),
      });
      expect(result.current.skipAd).toBe('Werbung uberspringen');
      expect(result.current.learnMore).toBe('Mehr erfahren');
      expect(result.current.play).toBe('Play');
    });

    it('overrides template labels', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper({
          skipForward: '{seconds}秒スキップ',
          skipIn: '{seconds}秒後にスキップ',
        }),
      });
      expect(result.current.skipForward).toBe('{seconds}秒スキップ');
      expect(result.current.skipIn).toBe('{seconds}秒後にスキップ');
    });

    it('handles empty string override', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper({ timeSeparator: '' }),
      });
      expect(result.current.timeSeparator).toBe('');
    });
  });

  describe('Provider rendering', () => {
    it('renders children', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });
      expect(result.current).toBeDefined();
    });

    it('provides labels to nested components', () => {
      const InnerWrapper = ({ children }: { children: React.ReactNode }) => (
        <LabelsProvider labels={{ play: 'Outer' }}>
          <LabelsProvider labels={{ pause: 'InnerPause' }}>
            {children}
          </LabelsProvider>
        </LabelsProvider>
      );

      const { result } = renderHook(() => useLabels(), {
        wrapper: InnerWrapper,
      });

      // Inner provider overrides only pause, other defaults apply
      expect(result.current.pause).toBe('InnerPause');
      // Inner provider does not see outer's play override (it merges with defaults)
      expect(result.current.play).toBe('Play');
    });

    it('returns all expected label keys', () => {
      const { result } = renderHook(() => useLabels(), {
        wrapper: createWrapper(),
      });

      const expectedKeys = Object.keys(defaultLabels);
      const actualKeys = Object.keys(result.current);
      expect(actualKeys).toEqual(expect.arrayContaining(expectedKeys));
      expect(actualKeys.length).toBe(expectedKeys.length);
    });
  });
});
