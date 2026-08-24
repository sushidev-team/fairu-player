/**
 * Subtitle appearance, on the React side.
 *
 * `src/core/subtitleStyle.test.ts` covers what a style may contain. What is
 * left here is the part that touches the document: a `::cue` rule has to exist,
 * be scoped to one player, follow the style, and disappear on unmount.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSubtitleStyling } from './useSubtitleStyling';
import { clearStored, resetStorageAvailability } from '@/utils/storage';

/** The rule this hook wrote, whichever scope it picked. */
function cueRules(): string[] {
  return Array.from(document.head.querySelectorAll('style[data-fp-cue-scope]')).map(
    (element) => element.textContent ?? ''
  );
}

beforeEach(() => {
  clearStored();
  resetStorageAvailability();
});

afterEach(() => {
  document.head.querySelectorAll('style[data-fp-cue-scope]').forEach((el) => el.remove());
  vi.restoreAllMocks();
});

describe('useSubtitleStyling', () => {
  describe('the stylesheet', () => {
    it('writes a rule for native cues', () => {
      renderHook(() => useSubtitleStyling());

      // The player renders subtitles with a <track>, so the browser draws the
      // cues — `::cue` is the only thing that reaches them.
      expect(cueRules()).toHaveLength(1);
      expect(cueRules()[0]).toContain('video::cue');
    });

    it('follows the style', () => {
      const { result } = renderHook(() => useSubtitleStyling());

      act(() => result.current.updateStyle({ fontSize: 28, textColor: '#ff0000' }));

      expect(cueRules()[0]).toContain('font-size: 28px');
      expect(cueRules()[0]).toContain('color: #ff0000');
    });

    it('ties the rule to the container it hands back', () => {
      const { result } = renderHook(() => useSubtitleStyling());
      const scope = result.current.scopeProps['data-fp-cue-scope'];

      expect(cueRules()[0]).toContain(`[data-fp-cue-scope="${scope}"]`);
    });

    it('gives two players two rules', () => {
      const first = renderHook(() => useSubtitleStyling());
      const second = renderHook(() => useSubtitleStyling());

      expect(cueRules()).toHaveLength(2);
      // Otherwise one player's subtitles would restyle the other's.
      expect(first.result.current.scopeProps['data-fp-cue-scope']).not.toBe(
        second.result.current.scopeProps['data-fp-cue-scope']
      );
    });

    it('takes its rule with it', () => {
      const { unmount } = renderHook(() => useSubtitleStyling());
      expect(cueRules()).toHaveLength(1);

      unmount();

      expect(cueRules()).toHaveLength(0);
    });
  });

  describe('choosing a style', () => {
    it('starts from the defaults', () => {
      const { result } = renderHook(() => useSubtitleStyling());

      expect(result.current.style.fontSize).toBe(16);
      expect(result.current.style.position).toBe('bottom');
    });

    it('takes the host suggestion', () => {
      const { result } = renderHook(() =>
        useSubtitleStyling({ initialStyle: { fontSize: 24 } })
      );

      expect(result.current.style.fontSize).toBe(24);
    });

    it('applies a preset', () => {
      const { result } = renderHook(() => useSubtitleStyling());

      act(() => result.current.applyPreset('high-contrast'));

      expect(result.current.style.backgroundOpacity).toBe(1);
    });

    it('ignores a preset it does not have', () => {
      const { result } = renderHook(() => useSubtitleStyling());
      const before = result.current.style;

      act(() => result.current.applyPreset('nope'));

      expect(result.current.style).toEqual(before);
    });

    it('resets', () => {
      const { result } = renderHook(() => useSubtitleStyling());

      act(() => result.current.updateStyle({ fontSize: 40 }));
      act(() => result.current.resetStyle());

      expect(result.current.style.fontSize).toBe(16);
    });

    it('repairs a value it is handed', () => {
      const { result } = renderHook(() => useSubtitleStyling());

      act(() => result.current.updateStyle({ fontSize: 9000 }));

      expect(result.current.style.fontSize).toBe(96);
    });
  });

  describe('remembering', () => {
    it('keeps the choice for the next visit', () => {
      const first = renderHook(() => useSubtitleStyling());
      act(() => first.result.current.updateStyle({ fontSize: 30 }));
      first.unmount();

      const second = renderHook(() => useSubtitleStyling());

      expect(second.result.current.style.fontSize).toBe(30);
    });

    it('lets the viewer override what the host suggested', () => {
      const first = renderHook(() => useSubtitleStyling());
      act(() => first.result.current.updateStyle({ fontSize: 30 }));
      first.unmount();

      const second = renderHook(() =>
        useSubtitleStyling({ initialStyle: { fontSize: 12 } })
      );

      // Someone who enlarged their subtitles did so for a reason.
      expect(second.result.current.style.fontSize).toBe(30);
    });

    it('forgets nothing and remembers nothing when switched off', () => {
      const first = renderHook(() => useSubtitleStyling({ persist: false }));
      act(() => first.result.current.updateStyle({ fontSize: 30 }));
      first.unmount();

      const second = renderHook(() => useSubtitleStyling({ persist: false }));

      expect(second.result.current.style.fontSize).toBe(16);
    });

    it('survives a stored value from an older schema', () => {
      const first = renderHook(() => useSubtitleStyling());
      act(() => first.result.current.updateStyle({ fontSize: 30 }));
      first.unmount();

      // Something wrote a shape this version does not recognise.
      const raw = Object.keys(localStorage).find((k) => k.includes('subtitle-style'));
      localStorage.setItem(raw!, JSON.stringify({ v: 1, t: Date.now(), d: { fontSize: 'huge' } }));

      const second = renderHook(() => useSubtitleStyling());

      expect(second.result.current.style.fontSize).toBe(16);
      expect(cueRules()[0]).toContain('font-size: 16px');
    });
  });

  describe('position', () => {
    /** A media element with one subtitle track and one cue. */
    function elementWithCue() {
      const cue = { line: 'auto' as number | 'auto' };
      const track = {
        kind: 'subtitles',
        cues: Object.assign([cue], { length: 1 }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      const element = {
        textTracks: Object.assign([track], {
          length: 1,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      } as unknown as HTMLMediaElement;

      return { element, cue };
    }

    it('pins the cues to the top', () => {
      const { element, cue } = elementWithCue();
      const videoRef = { current: element };

      const { result } = renderHook(() => useSubtitleStyling({ videoRef }));
      act(() => result.current.updateStyle({ position: 'top' }));

      // Placement lives on the cue object; CSS cannot reach it.
      expect(cue.line).toBe(0);
    });

    it('hands the bottom back to the browser', () => {
      const { element, cue } = elementWithCue();
      cue.line = 0;
      const videoRef = { current: element };

      const { result } = renderHook(() => useSubtitleStyling({ videoRef }));
      act(() => result.current.updateStyle({ position: 'bottom' }));

      expect(cue.line).toBe('auto');
    });

    it('listens for tracks that arrive later', () => {
      const { element } = elementWithCue();
      const videoRef = { current: element };

      renderHook(() => useSubtitleStyling({ videoRef }));

      // A track loads after the element does; a position applied before the
      // file arrived would otherwise apply to nothing.
      expect(element.textTracks.addEventListener).toHaveBeenCalledWith(
        'addtrack',
        expect.any(Function)
      );
    });

    it('works without a media element', () => {
      const { result } = renderHook(() => useSubtitleStyling());

      expect(() => act(() => result.current.updateStyle({ position: 'top' }))).not.toThrow();
    });
  });
});
