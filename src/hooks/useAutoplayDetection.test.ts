/**
 * Autoplay capability detection.
 *
 * There is no API that answers "may I autoplay?" — browsers decide per
 * attempt — so the hook probes with a throwaway element. These tests drive that
 * by controlling what `play()` does, which is the only lever a browser gives.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAutoplayDetection } from './useAutoplayDetection';

/**
 * Decide what `play()` does for the probe element.
 *
 * The probe sets `muted` before calling, so the mock can answer differently for
 * an audible and a muted attempt — which is exactly the distinction the hook
 * exists to make.
 */
function stubPlay(policy: { audible: boolean; muted: boolean }) {
  return vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(function (this: HTMLMediaElement) {
      const allowed = this.muted ? policy.muted : policy.audible;
      return allowed
        ? Promise.resolve()
        : Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    });
}

describe('useAutoplayDetection', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('capability', () => {
    it('reports allowed when audible playback starts', async () => {
      stubPlay({ audible: true, muted: true });

      const { result } = renderHook(() => useAutoplayDetection());

      await waitFor(() => expect(result.current.capability).toBe('allowed'));
      expect(result.current.canAutoplay).toBe(true);
      expect(result.current.requiresMuted).toBe(false);
      expect(result.current.requiresGesture).toBe(false);
    });

    it('reports muted-only when sound is refused but muted plays', async () => {
      // Desktop Chrome on a site the visitor has not engaged with.
      stubPlay({ audible: false, muted: true });

      const { result } = renderHook(() => useAutoplayDetection());

      await waitFor(() => expect(result.current.capability).toBe('muted-only'));
      expect(result.current.requiresMuted).toBe(true);
      expect(result.current.canAutoplay).toBe(false);
    });

    it('reports blocked when nothing starts', async () => {
      // Mobile Safari's default.
      stubPlay({ audible: false, muted: false });

      const { result } = renderHook(() => useAutoplayDetection());

      await waitFor(() => expect(result.current.capability).toBe('blocked'));
      expect(result.current.requiresGesture).toBe(true);
    });

    it('does not probe muted when audible already worked', async () => {
      // A page allowed to play with sound is allowed muted too, so the second
      // probe would be a wasted element and a wasted decode.
      const play = stubPlay({ audible: true, muted: true });

      const { result } = renderHook(() => useAutoplayDetection());
      await waitFor(() => expect(result.current.capability).toBe('allowed'));

      expect(play).toHaveBeenCalledTimes(1);
    });

    it('treats a play() that returns nothing as success', async () => {
      // Older engines return undefined instead of a promise.
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
        () => undefined as unknown as Promise<void>
      );

      const { result } = renderHook(() => useAutoplayDetection());

      await waitFor(() => expect(result.current.capability).toBe('allowed'));
    });
  });

  describe('lifecycle', () => {
    it('starts unknown', () => {
      stubPlay({ audible: true, muted: true });
      const { result } = renderHook(() => useAutoplayDetection());
      expect(result.current.capability).toBe('unknown');
    });

    it('reports through onDetected', async () => {
      stubPlay({ audible: false, muted: true });
      const onDetected = vi.fn();

      renderHook(() => useAutoplayDetection({ onDetected }));

      await waitFor(() => expect(onDetected).toHaveBeenCalledWith('muted-only'));
    });

    it('does not probe when disabled', async () => {
      const play = stubPlay({ audible: true, muted: true });

      const { result } = renderHook(() => useAutoplayDetection({ enabled: false }));
      await new Promise((r) => setTimeout(r, 10));

      expect(play).not.toHaveBeenCalled();
      expect(result.current.capability).toBe('unknown');
    });

    it('can be probed again on demand', async () => {
      // The answer changes once the visitor interacts with the page, so a
      // re-probe after a click is the point of exposing this.
      const play = stubPlay({ audible: false, muted: false });
      const { result } = renderHook(() => useAutoplayDetection({ enabled: false }));

      play.mockImplementation(() => Promise.resolve());
      const capability = await result.current.detect();

      expect(capability).toBe('allowed');
      await waitFor(() => expect(result.current.capability).toBe('allowed'));
    });

    it('cleans the probe element up either way', async () => {
      const load = vi.spyOn(HTMLMediaElement.prototype, 'load');
      stubPlay({ audible: false, muted: false });

      const { result } = renderHook(() => useAutoplayDetection());
      await waitFor(() => expect(result.current.capability).toBe('blocked'));

      // Both attempts release their source rather than leaving a decoded
      // element attached to the document's media pool.
      expect(load).toHaveBeenCalledTimes(2);
    });

    it('survives unmounting mid-probe', async () => {
      stubPlay({ audible: false, muted: true });

      const { unmount } = renderHook(() => useAutoplayDetection());
      expect(() => unmount()).not.toThrow();
    });
  });
});
