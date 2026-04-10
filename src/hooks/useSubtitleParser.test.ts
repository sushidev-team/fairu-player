import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSubtitleParser, parseVTTCues } from './useSubtitleParser';

// Mock fetch
const mockFetch = vi.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

const SAMPLE_VTT = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello, welcome to the show.

2
00:00:05.000 --> 00:00:08.000
Today we're going to talk about
something interesting.

3
00:00:10.000 --> 00:00:12.500
Let's get started!
`;

describe('parseVTTCues', () => {
  it('should parse valid VTT content', () => {
    const cues = parseVTTCues(SAMPLE_VTT);
    expect(cues).toHaveLength(3);
    expect(cues[0]).toEqual({
      id: '1',
      startTime: 1,
      endTime: 4,
      text: 'Hello, welcome to the show.',
    });
  });

  it('should handle multi-line cue text', () => {
    const cues = parseVTTCues(SAMPLE_VTT);
    expect(cues[1].text).toBe("Today we're going to talk about\nsomething interesting.");
  });

  it('should handle empty content', () => {
    expect(parseVTTCues('')).toEqual([]);
    expect(parseVTTCues('WEBVTT')).toEqual([]);
  });

  it('should strip HTML tags from cue text', () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
<b>Bold</b> and <i>italic</i> text`;
    const cues = parseVTTCues(vtt);
    expect(cues[0].text).toBe('Bold and italic text');
  });

  it('should handle MM:SS.mmm format timestamps', () => {
    const vtt = `WEBVTT

01:30.000 --> 02:00.000
Short format`;
    const cues = parseVTTCues(vtt);
    expect(cues[0].startTime).toBe(90);
    expect(cues[0].endTime).toBe(120);
  });
});

describe('useSubtitleParser', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return null activeCue when disabled', () => {
    const { result } = renderHook(() =>
      useSubtitleParser({ currentTime: 2, enabled: false })
    );
    expect(result.current.activeCue).toBeNull();
    expect(result.current.cues).toEqual([]);
  });

  it('should return null activeCue when no src', () => {
    const { result } = renderHook(() =>
      useSubtitleParser({ currentTime: 2, enabled: true })
    );
    expect(result.current.activeCue).toBeNull();
  });

  it('should fetch and parse VTT file', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(SAMPLE_VTT),
    });

    const { result, rerender } = renderHook(
      (props) => useSubtitleParser(props),
      { initialProps: { src: 'https://example.com/subs.vtt', currentTime: 0, enabled: true } }
    );

    // Wait for fetch
    await vi.waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.cues).toHaveLength(3);

    // Change time to match first cue
    rerender({ src: 'https://example.com/subs.vtt', currentTime: 2, enabled: true });
    expect(result.current.activeCue).toBe('Hello, welcome to the show.');
  });

  it('should return null when time is between cues', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(SAMPLE_VTT),
    });

    const { result, rerender } = renderHook(
      (props) => useSubtitleParser(props),
      { initialProps: { src: 'https://example.com/subs.vtt', currentTime: 0, enabled: true } }
    );

    await vi.waitFor(() => expect(result.current.isLoaded).toBe(true));

    rerender({ src: 'https://example.com/subs.vtt', currentTime: 4.5, enabled: true });
    expect(result.current.activeCue).toBeNull();
  });

  it('should handle fetch errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useSubtitleParser({ src: 'https://example.com/subs.vtt', currentTime: 0, enabled: true })
    );

    await vi.waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.isLoaded).toBe(false);
  });
});
