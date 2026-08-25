/**
 * Loading a caption file.
 *
 * The parsing is covered in `src/core/subtitles.test.ts`. What is left is the
 * fetch: cancelling it, reporting a failure, and not leaving the previous
 * track's captions on screen.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSubtitleParser } from './useSubtitleParser';

const A = 'https://cdn.example.test/a.vtt';
const B = 'https://cdn.example.test/b.vtt';

const VTT_A = 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nAus Datei A\n';
const VTT_B = 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nAus Datei B\n';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url === A ? VTT_A : url === B ? VTT_B : null;
      if (body === null) {
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => '',
        } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, text: async () => body } as Response);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSubtitleParser', () => {
  it('reports nothing without a file', () => {
    const { result } = renderHook(() => useSubtitleParser({ currentTime: 1 }));

    expect(result.current.cues).toEqual([]);
    expect(result.current.activeText).toBeNull();
    expect(result.current.isLoaded).toBe(false);
  });

  it('loads a file and finds the cue on screen', async () => {
    const { result } = renderHook(() => useSubtitleParser({ src: A, currentTime: 1 }));

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.activeText).toBe('Aus Datei A');
  });

  it('reports nothing outside a cue', async () => {
    const { result } = renderHook(() => useSubtitleParser({ src: A, currentTime: 99 }));

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.activeText).toBeNull();
  });

  it('drops the previous captions while the next file loads', async () => {
    const { result, rerender } = renderHook(
      ({ src }: { src: string }) => useSubtitleParser({ src, currentTime: 1 }),
      { initialProps: { src: A } }
    );

    await waitFor(() => expect(result.current.activeText).toBe('Aus Datei A'));

    rerender({ src: B });

    // Otherwise the old track's lines sit over the new one until it arrives.
    expect(result.current.activeText).toBeNull();
    await waitFor(() => expect(result.current.activeText).toBe('Aus Datei B'));
  });

  it('reports a file that is not there', async () => {
    const { result } = renderHook(() =>
      useSubtitleParser({ src: 'https://cdn.example.test/gone.vtt', currentTime: 1 })
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.error?.message).toContain('404');
  });

  it('cancels a load it no longer needs', () => {
    const aborted = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        init?.signal?.addEventListener('abort', aborted);
        return new Promise<Response>(() => {});
      })
    );

    const { unmount } = renderHook(() => useSubtitleParser({ src: A, currentTime: 0 }));
    unmount();

    expect(aborted).toHaveBeenCalled();
  });

  it('loads nothing while switched off', () => {
    renderHook(() => useSubtitleParser({ src: A, currentTime: 1, enabled: false }));

    expect(fetch).not.toHaveBeenCalled();
  });

  it('hands back the speaker with the cue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: async () => 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n<v Anna>Hallo\n',
        } as Response)
      )
    );

    const { result } = renderHook(() => useSubtitleParser({ src: A, currentTime: 1 }));

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.activeCue?.speaker).toBe('Anna');
  });
});
