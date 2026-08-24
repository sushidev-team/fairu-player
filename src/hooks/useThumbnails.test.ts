/**
 * Loading the frames a scrub preview draws from.
 *
 * The parsing is covered in `src/core/thumbnails.test.ts`. What is left is the
 * fetch: that it cancels, that a failure stays quiet, and that a track change
 * does not leave the previous film's frames on screen.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useThumbnails } from './useThumbnails';

const VTT_A = `WEBVTT

00:00:00.000 --> 00:00:05.000
sheet.jpg#xywh=0,0,160,90
`;

const VTT_B = `WEBVTT

00:00:00.000 --> 00:00:05.000
sheet.jpg#xywh=0,0,160,90
`;

const URL_A = 'https://cdn.example.test/a/thumbs.vtt';
const URL_B = 'https://cdn.example.test/b/thumbs.vtt';

function serve(bodies: Record<string, string>) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const body = bodies[url];
    if (body === undefined) {
      return Promise.resolve({ ok: false, status: 404, text: async () => '' } as Response);
    }
    return Promise.resolve({ ok: true, status: 200, text: async () => body } as Response);
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', serve({ [URL_A]: VTT_A, [URL_B]: VTT_B }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useThumbnails', () => {
  it('reports nothing without a config', async () => {
    const { result } = renderHook(() => useThumbnails());

    expect(result.current.ready).toBe(false);
    expect(result.current.cueAt(1)).toBeNull();
  });

  it('loads a VTT and resolves its URLs against it', async () => {
    const { result } = renderHook(() => useThumbnails({ vttUrl: URL_A }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.cueAt(1)?.url).toBe('https://cdn.example.test/a/sheet.jpg');
  });

  it('stays quiet when the manifest is missing', async () => {
    const { result } = renderHook(() =>
      useThumbnails({ vttUrl: 'https://cdn.example.test/gone.vtt' })
    );

    // Previews are a nicety. A player that refuses to scrub because a sheet
    // 404'd is worse than one that scrubs without pictures.
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current.ready).toBe(false);
  });

  it('drops the previous frames while the next manifest loads', async () => {
    const { result, rerender } = renderHook(
      ({ url }: { url: string }) => useThumbnails({ vttUrl: url }),
      { initialProps: { url: URL_A } }
    );

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.cueAt(1)?.url).toContain('/a/');

    rerender({ url: URL_B });

    // The frames are keyed by the manifest they came from, so the old ones stop
    // being reported the moment the source changes — not when the new ones land.
    expect(result.current.ready).toBe(false);

    await waitFor(() => expect(result.current.cueAt(1)?.url).toContain('/b/'));
  });

  it('cancels a load it no longer needs', async () => {
    const aborted = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        init?.signal?.addEventListener('abort', aborted);
        return new Promise<Response>(() => {});
      })
    );

    const { unmount } = renderHook(() => useThumbnails({ vttUrl: URL_A }));
    unmount();

    expect(aborted).toHaveBeenCalled();
  });

  it('lays out a sprite sheet without a VTT', () => {
    const { result } = renderHook(() =>
      useThumbnails({
        spriteUrl: 'https://cdn.example.test/sheet.jpg',
        spriteColumns: 2,
        spriteRows: 2,
        thumbWidth: 160,
        thumbHeight: 90,
        duration: 40,
      })
    );

    expect(result.current.ready).toBe(true);
    expect(result.current.cueAt(15)).toMatchObject({ x: 160, y: 0 });
  });

  it('prefers a VTT over a sprite sheet', async () => {
    const { result } = renderHook(() =>
      useThumbnails({
        vttUrl: URL_A,
        spriteUrl: 'https://cdn.example.test/sheet.jpg',
        spriteColumns: 2,
        spriteRows: 2,
        thumbWidth: 160,
        thumbHeight: 90,
        duration: 40,
      })
    );

    await waitFor(() => expect(result.current.ready).toBe(true));

    // A VTT describes the real shot boundaries; a bare sheet only assumes them.
    expect(result.current.cueAt(1)?.url).toContain('/a/sheet.jpg');
  });
});
