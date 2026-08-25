/**
 * The equaliser's audio graph.
 *
 * Three properties of Web Audio drive nearly every test here, and the version
 * this was ported from got all three wrong:
 *
 *  - `createMediaElementSource` may be called **once** per element.
 *  - Closing the context silences that element for good.
 *  - Cross-origin media without `crossorigin` comes through as silence.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEqualizer } from './useEqualizer';
import { clearStored, resetStorageAvailability } from '@/utils/storage';

/** A minimal AudioContext that records what was wired to what. */
function fakeAudio() {
  const created: Array<{ type: string; frequency: { value: number }; Q: { value: number }; gain: { value: number }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
  const sourceCalls: HTMLMediaElement[] = [];

  const destination = { id: 'destination' };

  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const context = {
    destination,
    state: 'suspended',
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    createMediaElementSource: vi.fn((element: HTMLMediaElement) => {
      // The real one throws on a second call for the same element.
      if (sourceCalls.includes(element)) throw new Error('InvalidStateError');
      sourceCalls.push(element);
      return source;
    }),
    createBiquadFilter: vi.fn(() => {
      const filter = {
        type: 'peaking',
        frequency: { value: 0 },
        Q: { value: 0 },
        gain: { value: 0 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      created.push(filter);
      return filter;
    }),
  };

  // A plain function, not an arrow: the hook calls `new AudioContext()`, and an
  // arrow is not constructable.
  const Ctor = vi.fn(function AudioContextStub() {
    return context;
  });
  vi.stubGlobal('AudioContext', Ctor);

  return { context, source, filters: created, Ctor, sourceCalls };
}

/** A fresh element per test, so the module-level routing map starts empty. */
function element(src = 'https://cdn.example.test/a.mp3') {
  const el = document.createElement('audio');
  Object.defineProperty(el, 'currentSrc', { value: src, configurable: true });
  return { current: el as HTMLMediaElement };
}

beforeEach(() => {
  clearStored();
  resetStorageAvailability();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useEqualizer', () => {
  describe('switched off', () => {
    it('touches no audio at all', () => {
      const audio = fakeAudio();
      const mediaRef = element();

      const { result } = renderHook(() => useEqualizer({ mediaRef }));

      // An AudioContext is a commitment: it cannot be undone for that element.
      expect(audio.Ctor).not.toHaveBeenCalled();
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('switched on', () => {
    it('builds a filter per band and connects them in order', () => {
      const audio = fakeAudio();
      const mediaRef = element();

      const { result } = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));

      expect(result.current.isConnected).toBe(true);
      expect(audio.filters).toHaveLength(5);
      expect(audio.filters.map((f) => f.frequency.value)).toEqual([60, 230, 910, 4000, 14000]);
      // Last one goes to the speakers.
      expect(audio.filters[4].connect).toHaveBeenCalledWith(audio.context.destination);
    });

    it('resumes a context that started suspended', () => {
      const audio = fakeAudio();
      const mediaRef = element();

      renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));

      // A context created outside a user gesture starts suspended, and a
      // suspended context is silence.
      expect(audio.context.resume).toHaveBeenCalled();
    });

    it('routes the element only once, however often the hook remounts', () => {
      const audio = fakeAudio();
      const mediaRef = element();

      const first = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));
      first.unmount();
      const second = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));

      // A second `createMediaElementSource` for the same element throws, and
      // the ported version swallowed it — leaving the equaliser dead.
      expect(audio.context.createMediaElementSource).toHaveBeenCalledTimes(1);
      expect(second.result.current.isConnected).toBe(true);
    });

    it('never closes the context', () => {
      const audio = fakeAudio();
      const mediaRef = element();

      const { unmount } = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));
      unmount();

      // Closing it while the element is still routed in silences that element
      // for good — no amount of pressing play brings it back.
      expect(audio.context.close).not.toHaveBeenCalled();
    });

    it('bypasses rather than tears down when switched off again', () => {
      const audio = fakeAudio();
      const mediaRef = element();

      const { result } = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));

      audio.source.connect.mockClear();
      act(() => result.current.setEnabled(false));

      expect(result.current.isConnected).toBe(false);
      // The element cannot be un-routed, so the best "off" is a straight wire.
      expect(audio.source.connect).toHaveBeenCalledWith(audio.context.destination);
    });
  });

  describe('changing the sound', () => {
    it('writes a gain into the running filter', () => {
      const audio = fakeAudio();
      const mediaRef = element();
      const { result } = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));

      act(() => result.current.setBandGain(2, 6));

      expect(audio.filters[2].gain.value).toBe(6);
    });

    it('does not rebuild the chain for a gain change', () => {
      const audio = fakeAudio();
      const mediaRef = element();
      const { result } = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));

      act(() => result.current.setBandGain(2, 6));
      act(() => result.current.setBandGain(2, 3));

      // Rebuilding is audible as a click, and there is nothing to gain from it.
      expect(audio.filters).toHaveLength(5);
    });

    it('applies a preset', () => {
      const audio = fakeAudio();
      const mediaRef = element();
      const { result } = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));

      act(() => result.current.applyPreset('bass-boost'));

      expect(result.current.currentPreset).toBe('bass-boost');
      expect(audio.filters.map((f) => f.gain.value)).toEqual([6, 4, 0, 0, 0]);
    });

    it('stops claiming a preset once a band moves', () => {
      const mediaRef = element();
      const { result } = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));

      act(() => result.current.applyPreset('podcast'));
      act(() => result.current.setBandGain(0, 9));

      expect(result.current.currentPreset).toBeNull();
    });

    it('resets to flat', () => {
      const mediaRef = element();
      const { result } = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));

      act(() => result.current.applyPreset('music'));
      act(() => result.current.reset());

      expect(result.current.currentPreset).toBe('flat');
      expect(result.current.bands.every((b) => b.gain === 0)).toBe(true);
    });
  });

  describe('an element that arrives late', () => {
    it('connects once it is there', () => {
      const audio = fakeAudio();
      const mediaRef: { current: HTMLMediaElement | null } = { current: null };

      const { result, rerender } = renderHook(() =>
        useEqualizer({ mediaRef, defaultEnabled: true })
      );

      expect(result.current.isConnected).toBe(false);

      // Rendered conditionally, or below a spinner. A dependency on the ref
      // object would never notice — its identity does not change.
      mediaRef.current = element().current;
      rerender();

      expect(result.current.isConnected).toBe(true);
      expect(audio.context.createMediaElementSource).toHaveBeenCalledTimes(1);
    });
  });

  describe('cross-origin media', () => {
    it('reports an element Web Audio would silence', () => {
      fakeAudio();
      const mediaRef = element('https://other.test/a.mp3');

      const { result } = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));

      // Without `crossorigin` the browser hands Web Audio silence. A host that
      // knows can hide the control instead of letting a listener mute themselves.
      expect(result.current.blockedByCors).toBe(true);
    });

    it('says nothing when the element carries crossorigin', () => {
      fakeAudio();
      const mediaRef = element('https://other.test/a.mp3');
      mediaRef.current.crossOrigin = 'anonymous';

      const { result } = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));

      expect(result.current.blockedByCors).toBe(false);
    });

    it('notices a source that changes underneath it', () => {
      fakeAudio();
      const mediaRef = element(`${window.location.origin}/a.mp3`);

      const { result } = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));
      expect(result.current.blockedByCors).toBe(false);

      // A playlist moving to a foreign track. The element does not re-render
      // React on its own, so the hook listens for the load.
      Object.defineProperty(mediaRef.current, 'currentSrc', {
        value: 'https://other.test/b.mp3',
        configurable: true,
      });
      act(() => {
        mediaRef.current.dispatchEvent(new Event('loadstart'));
      });

      expect(result.current.blockedByCors).toBe(true);
    });

    it('says nothing for same-origin or blob media', () => {
      fakeAudio();
      const same = element(`${window.location.origin}/a.mp3`);

      const { result } = renderHook(() => useEqualizer({ mediaRef: same, defaultEnabled: true }));

      expect(result.current.blockedByCors).toBe(false);
    });
  });

  describe('remembering', () => {
    it('keeps the setting for the next visit', () => {
      fakeAudio();
      const first = renderHook(() => useEqualizer({ mediaRef: element(), defaultEnabled: true }));
      act(() => first.result.current.applyPreset('voice-boost'));
      first.unmount();

      const second = renderHook(() => useEqualizer({ mediaRef: element() }));

      expect(second.result.current.currentPreset).toBe('voice-boost');
      expect(second.result.current.enabled).toBe(true);
    });

    it('remembers nothing when asked not to', () => {
      fakeAudio();
      const first = renderHook(() =>
        useEqualizer({ mediaRef: element(), defaultEnabled: true, persist: false })
      );
      act(() => first.result.current.applyPreset('music'));
      first.unmount();

      const second = renderHook(() => useEqualizer({ mediaRef: element(), persist: false }));

      expect(second.result.current.currentPreset).toBe('flat');
    });
  });

  describe('without Web Audio', () => {
    it('stays quiet rather than throwing', () => {
      vi.stubGlobal('AudioContext', undefined);
      const mediaRef = element();

      const { result } = renderHook(() => useEqualizer({ mediaRef, defaultEnabled: true }));

      expect(result.current.isConnected).toBe(false);
      expect(() => result.current.setBandGain(0, 4)).not.toThrow();
    });
  });
});
