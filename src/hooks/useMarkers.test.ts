import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMarkers } from './useMarkers';
import { createMockMarkers } from '@/test/helpers';
import type { TimelineMarker } from '@/types/markers';

describe('useMarkers', () => {
  const markers = createMockMarkers();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Initial State ──────────────────────────────────────────────────

  describe('initial state', () => {
    it('returns markers sorted by time', () => {
      const unsortedMarkers: TimelineMarker[] = [
        { id: 'm-3', time: 120, title: 'Third' },
        { id: 'm-1', time: 15, title: 'First' },
        { id: 'm-2', time: 60, title: 'Second' },
      ];

      const { result } = renderHook(() =>
        useMarkers({ markers: unsortedMarkers, currentTime: 0 })
      );

      expect(result.current.markers[0].id).toBe('m-1');
      expect(result.current.markers[1].id).toBe('m-2');
      expect(result.current.markers[2].id).toBe('m-3');
    });

    it('returns no active marker when time is far from all markers', () => {
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 0 })
      );

      expect(result.current.activeMarker).toBeNull();
      expect(result.current.activeMarkerIndex).toBe(-1);
    });

    it('handles empty markers array', () => {
      const { result } = renderHook(() =>
        useMarkers({ markers: [], currentTime: 0 })
      );

      expect(result.current.markers).toEqual([]);
      expect(result.current.activeMarker).toBeNull();
      expect(result.current.activeMarkerIndex).toBe(-1);
    });
  });

  // ─── Active Marker Detection ──────────────────────────────────────

  describe('active marker detection', () => {
    it('detects active marker when within default proximity (2s)', () => {
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 14 })
      );

      // 14 is within 2 seconds of marker at time 15
      expect(result.current.activeMarker?.id).toBe('m-1');
    });

    it('detects active marker at exact marker time', () => {
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 60 })
      );

      expect(result.current.activeMarker?.id).toBe('m-2');
      expect(result.current.activeMarkerIndex).toBe(1);
    });

    it('detects marker when slightly after marker time', () => {
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 16 })
      );

      // 16 is within 2 seconds of marker at time 15
      expect(result.current.activeMarker?.id).toBe('m-1');
    });

    it('returns null when time is beyond proximity threshold', () => {
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 40 })
      );

      // 40 is >2 seconds from all markers (15, 60, 120)
      expect(result.current.activeMarker).toBeNull();
    });

    it('uses custom proximity threshold', () => {
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 10, proximityThreshold: 5 })
      );

      // 10 is within 5 seconds of marker at time 15
      expect(result.current.activeMarker?.id).toBe('m-1');
    });

    it('custom proximity threshold - no match', () => {
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 10, proximityThreshold: 1 })
      );

      // 10 is 5 seconds from marker at time 15, threshold is 1
      expect(result.current.activeMarker).toBeNull();
    });

    it('picks the closest marker when two are within threshold', () => {
      const closeMarkers: TimelineMarker[] = [
        { id: 'm-1', time: 10, title: 'A' },
        { id: 'm-2', time: 14, title: 'B' },
      ];

      const { result } = renderHook(() =>
        useMarkers({ markers: closeMarkers, currentTime: 13, proximityThreshold: 5 })
      );

      // 13 is 3 from m-1 and 1 from m-2 => m-2 is closer
      expect(result.current.activeMarker?.id).toBe('m-2');
    });

    it('updates active marker when time changes', () => {
      const onMarkerChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ currentTime }) =>
          useMarkers({ markers, currentTime, onMarkerChange }),
        { initialProps: { currentTime: 15 } }
      );

      expect(result.current.activeMarker?.id).toBe('m-1');

      rerender({ currentTime: 60 });

      expect(result.current.activeMarker?.id).toBe('m-2');
    });

    it('clears active marker when time moves away', () => {
      const { result, rerender } = renderHook(
        ({ currentTime }) => useMarkers({ markers, currentTime }),
        { initialProps: { currentTime: 15 } }
      );

      expect(result.current.activeMarker?.id).toBe('m-1');

      rerender({ currentTime: 40 });

      expect(result.current.activeMarker).toBeNull();
      expect(result.current.activeMarkerIndex).toBe(-1);
    });
  });

  // ─── Marker Change Callback ────────────────────────────────────────

  describe('marker change callback', () => {
    it('calls onMarkerChange when active marker changes', () => {
      const onMarkerChange = vi.fn();
      const { rerender } = renderHook(
        ({ currentTime }) =>
          useMarkers({ markers, currentTime, onMarkerChange }),
        { initialProps: { currentTime: 0 } }
      );

      rerender({ currentTime: 15 });

      expect(onMarkerChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'm-1' }),
        0
      );
    });

    it('does not call onMarkerChange when staying near same marker', () => {
      const onMarkerChange = vi.fn();
      const { rerender } = renderHook(
        ({ currentTime }) =>
          useMarkers({ markers, currentTime, onMarkerChange }),
        { initialProps: { currentTime: 14 } }
      );

      const callCount = onMarkerChange.mock.calls.length;

      rerender({ currentTime: 15 });

      // Should not fire again since active marker is still m-1
      expect(onMarkerChange.mock.calls.length).toBe(callCount);
    });

    it('works without onMarkerChange callback', () => {
      const { result, rerender } = renderHook(
        ({ currentTime }) => useMarkers({ markers, currentTime }),
        { initialProps: { currentTime: 0 } }
      );

      // Should not throw
      rerender({ currentTime: 15 });

      expect(result.current.activeMarker?.id).toBe('m-1');
    });
  });

  // ─── Navigation Controls ──────────────────────────────────────────

  describe('navigation controls', () => {
    it('goToMarker() calls onMarkerChange with the marker at index', () => {
      const onMarkerChange = vi.fn();
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 15, onMarkerChange })
      );

      onMarkerChange.mockClear();

      result.current.goToMarker(1);

      expect(onMarkerChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'm-2' }),
        1
      );
    });

    it('goToMarker() does nothing for negative index', () => {
      const onMarkerChange = vi.fn();
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 15, onMarkerChange })
      );

      onMarkerChange.mockClear();

      result.current.goToMarker(-1);

      expect(onMarkerChange).not.toHaveBeenCalled();
    });

    it('goToMarker() does nothing for out-of-range index', () => {
      const onMarkerChange = vi.fn();
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 15, onMarkerChange })
      );

      onMarkerChange.mockClear();

      result.current.goToMarker(10);

      expect(onMarkerChange).not.toHaveBeenCalled();
    });

    it('nextMarker() goes to the next marker', () => {
      const onMarkerChange = vi.fn();
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 15, onMarkerChange })
      );

      // Active marker is index 0 (m-1)
      onMarkerChange.mockClear();

      result.current.nextMarker();

      expect(onMarkerChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'm-2' }),
        1
      );
    });

    it('nextMarker() does nothing at last marker', () => {
      const onMarkerChange = vi.fn();
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 120, onMarkerChange })
      );

      // Active marker is index 2 (m-3, last)
      onMarkerChange.mockClear();

      result.current.nextMarker();

      expect(onMarkerChange).not.toHaveBeenCalled();
    });

    it('previousMarker() goes to the previous marker', () => {
      const onMarkerChange = vi.fn();
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 60, onMarkerChange })
      );

      // Active marker is index 1 (m-2)
      onMarkerChange.mockClear();

      result.current.previousMarker();

      expect(onMarkerChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'm-1' }),
        0
      );
    });

    it('previousMarker() does nothing at first marker', () => {
      const onMarkerChange = vi.fn();
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 15, onMarkerChange })
      );

      // Active marker is index 0 (m-1, first)
      onMarkerChange.mockClear();

      result.current.previousMarker();

      expect(onMarkerChange).not.toHaveBeenCalled();
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles single marker', () => {
      const singleMarker: TimelineMarker[] = [
        { id: 'm-1', time: 50, title: 'Only' },
      ];

      const { result } = renderHook(() =>
        useMarkers({ markers: singleMarker, currentTime: 50 })
      );

      expect(result.current.activeMarker?.id).toBe('m-1');
      expect(result.current.activeMarkerIndex).toBe(0);
    });

    it('handles markers with color property', () => {
      const colorMarkers: TimelineMarker[] = [
        { id: 'm-1', time: 10, title: 'Red', color: '#ff0000' },
        { id: 'm-2', time: 20, title: 'Blue', color: '#0000ff' },
      ];

      const { result } = renderHook(() =>
        useMarkers({ markers: colorMarkers, currentTime: 10 })
      );

      expect(result.current.activeMarker?.color).toBe('#ff0000');
    });

    it('handles markers with previewImage', () => {
      const imageMarkers: TimelineMarker[] = [
        { id: 'm-1', time: 10, title: 'Preview', previewImage: 'https://example.com/thumb.jpg' },
      ];

      const { result } = renderHook(() =>
        useMarkers({ markers: imageMarkers, currentTime: 10 })
      );

      expect(result.current.activeMarker?.previewImage).toBe('https://example.com/thumb.jpg');
    });

    it('handles proximity threshold of 0', () => {
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 15, proximityThreshold: 0 })
      );

      // Exact match only
      expect(result.current.activeMarker?.id).toBe('m-1');
    });

    it('proximity threshold of 0 does not match nearby times', () => {
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 14.5, proximityThreshold: 0 })
      );

      expect(result.current.activeMarker).toBeNull();
    });

    it('already sorted markers are returned as-is', () => {
      const { result } = renderHook(() =>
        useMarkers({ markers, currentTime: 0 })
      );

      expect(result.current.markers[0].time).toBe(15);
      expect(result.current.markers[1].time).toBe(60);
      expect(result.current.markers[2].time).toBe(120);
    });
  });
});
