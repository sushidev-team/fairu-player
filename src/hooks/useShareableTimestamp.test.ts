/**
 * Reading the address bar and driving the player.
 *
 * `src/core/timestamp.test.ts` covers the format. The case that matters here is
 * the timing one: the player clamps a seek against the element's duration, and
 * that is `0` until metadata loads — so a timestamp applied on mount lands at
 * the beginning and the feature quietly does nothing.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useShareableTimestamp } from './useShareableTimestamp';

/** jsdom serves the page from its own origin; build expectations from it. */
const WATCH = `${window.location.origin}/watch`;

/** Put the page at a given address for the duration of one test. */
function openedAt(search = '') {
  window.history.replaceState({}, '', `/watch${search}`);
}

beforeEach(() => {
  openedAt();
});

afterEach(() => {
  vi.restoreAllMocks();
  openedAt();
});

function mount(props: {
  duration?: number;
  currentTime?: number;
  onSeek?: (time: number) => void;
  seekOnMount?: boolean;
  paramName?: string;
  onTimestampParsed?: (time: number) => void;
} = {}) {
  const { duration = 0, currentTime = 0, ...rest } = props;
  return renderHook(
    ({ time, dur }: { time: number; dur: number }) =>
      useShareableTimestamp({ currentTime: time, duration: dur, ...rest }),
    { initialProps: { time: currentTime, dur: duration } }
  );
}

describe('useShareableTimestamp', () => {
  describe('reading the URL', () => {
    it('reports the timestamp the page was opened at', () => {
      openedAt('?t=1m30s');
      const { result } = mount();

      expect(result.current.urlTimestamp).toBe(90);
      expect(result.current.hasUrlTimestamp).toBe(true);
    });

    it('reports none when there is none', () => {
      const { result } = mount();

      expect(result.current.urlTimestamp).toBeNull();
      expect(result.current.hasUrlTimestamp).toBe(false);
    });

    it('reports none for a timestamp it cannot read', () => {
      openedAt('?t=Infinity');
      const { result } = mount();

      expect(result.current.urlTimestamp).toBeNull();
    });

    it('honours a different parameter name', () => {
      openedAt('?start=45s');
      const { result } = mount({ paramName: 'start' });

      expect(result.current.urlTimestamp).toBe(45);
    });
  });

  describe('applying it', () => {
    it('waits for the media to know its duration', () => {
      openedAt('?t=1m30s');
      const onSeek = vi.fn();
      const { result, rerender } = mount({ onSeek });

      // Metadata has not loaded, so the player would clamp this to 0 and the
      // link would silently land at the beginning.
      expect(onSeek).not.toHaveBeenCalled();
      expect(result.current.pendingSeek).toBe(true);

      rerender({ time: 0, dur: 300 });

      expect(onSeek).toHaveBeenCalledWith(90);
      expect(result.current.pendingSeek).toBe(false);
    });

    it('applies it once, not on every update', () => {
      openedAt('?t=1m30s');
      const onSeek = vi.fn();
      const { rerender } = mount({ onSeek });

      rerender({ time: 0, dur: 300 });
      rerender({ time: 90, dur: 300 });
      rerender({ time: 91, dur: 300 });

      // Otherwise the playhead would be dragged back to the shared position
      // every time it moved.
      expect(onSeek).toHaveBeenCalledTimes(1);
    });

    it('announces the time it applied', () => {
      openedAt('?t=45s');
      const onTimestampParsed = vi.fn();
      const { rerender } = mount({ onTimestampParsed });

      rerender({ time: 0, dur: 300 });

      expect(onTimestampParsed).toHaveBeenCalledWith(45);
    });

    it('clamps a timestamp past the end', () => {
      openedAt('?t=1h');
      const onSeek = vi.fn();
      const { rerender } = mount({ onSeek });

      rerender({ time: 0, dur: 300 });

      // A link outlives the cut it points into.
      expect(onSeek).toHaveBeenCalledWith(300);
    });

    it('reports nothing pending when there is no timestamp', () => {
      const { result } = mount();

      expect(result.current.pendingSeek).toBe(false);
    });

    it('reports nothing pending when the seek is switched off', () => {
      openedAt('?t=1m30s');
      const { result } = mount({ seekOnMount: false });

      // Nothing is waiting to happen, so a "starting at…" label would be a lie.
      expect(result.current.pendingSeek).toBe(false);
    });

    it('does nothing without a timestamp', () => {
      const onSeek = vi.fn();
      const { rerender } = mount({ onSeek });

      rerender({ time: 0, dur: 300 });

      expect(onSeek).not.toHaveBeenCalled();
    });

    it('does nothing when switched off', () => {
      openedAt('?t=1m30s');
      const onSeek = vi.fn();
      const { result, rerender } = mount({ onSeek, seekOnMount: false });

      rerender({ time: 0, dur: 300 });

      // Still reported, so a host can offer "jump to 1:30" instead.
      expect(onSeek).not.toHaveBeenCalled();
      expect(result.current.urlTimestamp).toBe(90);
    });
  });

  describe('building a link', () => {
    it('uses the current position by default', () => {
      const { result, rerender } = mount();
      rerender({ time: 90, dur: 300 });

      expect(result.current.getShareUrl()).toBe(`${WATCH}?t=1m30s`);
    });

    it('takes an explicit time', () => {
      const { result } = mount();

      expect(result.current.getShareUrl(3661)).toBe(`${WATCH}?t=1h1m1s`);
    });

    it('replaces a timestamp already in the address', () => {
      openedAt('?t=10s');
      const { result } = mount();

      expect(result.current.getShareUrl(90)).toBe(`${WATCH}?t=1m30s`);
    });

    it('keeps the other parameters', () => {
      openedAt('?v=abc');
      const { result } = mount();

      expect(result.current.getShareUrl(90)).toBe(`${WATCH}?v=abc&t=1m30s`);
    });

    it('keeps its identity while the playhead moves', () => {
      const { result, rerender } = mount();
      const first = result.current.getShareUrl;

      rerender({ time: 1, dur: 300 });
      rerender({ time: 2, dur: 300 });

      // It reads the playhead from a ref for exactly this reason: a function
      // rebuilt several times a second defeats any memo around it.
      expect(result.current.getShareUrl).toBe(first);
      expect(result.current.getShareUrl()).toBe(`${WATCH}?t=2s`);
    });
  });

  describe('copying', () => {
    it('writes the link to the clipboard', async () => {
      const writeText = vi.fn(() => Promise.resolve());
      vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: { writeText } });
      const { result } = mount();

      await act(async () => {
        await expect(result.current.copyShareUrl(90)).resolves.toBe(true);
      });

      expect(writeText).toHaveBeenCalledWith(`${WATCH}?t=1m30s`);
      vi.unstubAllGlobals();
    });

    it('reports a refusal rather than throwing', async () => {
      vi.stubGlobal('navigator', {
        ...globalThis.navigator,
        clipboard: { writeText: () => Promise.reject(new Error('denied')) },
      });
      const { result } = mount();

      await act(async () => {
        await expect(result.current.copyShareUrl(90)).resolves.toBe(false);
      });

      vi.unstubAllGlobals();
    });

    it('reports a missing clipboard rather than throwing', async () => {
      vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: undefined });
      const { result } = mount();

      // Absent outside a secure context, which includes plenty of staging
      // setups — a caller showing "copied!" needs to hear about it.
      await act(async () => {
        await expect(result.current.copyShareUrl(90)).resolves.toBe(false);
      });

      vi.unstubAllGlobals();
    });
  });
});
