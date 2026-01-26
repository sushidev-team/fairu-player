import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MarkerState, MarkerControls, UseMarkersOptions, UseMarkersReturn } from '@/types/markers';

export function useMarkers(options: UseMarkersOptions): UseMarkersReturn {
  const { markers, currentTime, proximityThreshold = 2, onMarkerChange } = options;

  const [activeMarkerIndex, setActiveMarkerIndex] = useState(-1);

  // Sort markers by time
  const sortedMarkers = useMemo(
    () => [...markers].sort((a, b) => a.time - b.time),
    [markers]
  );

  // Find active marker based on proximity threshold
  const activeMarker = useMemo(() => {
    if (sortedMarkers.length === 0) return null;

    let closest: { marker: typeof sortedMarkers[0]; index: number; distance: number } | null = null;

    for (let i = 0; i < sortedMarkers.length; i++) {
      const distance = Math.abs(currentTime - sortedMarkers[i].time);
      if (distance <= proximityThreshold) {
        if (!closest || distance < closest.distance) {
          closest = { marker: sortedMarkers[i], index: i, distance };
        }
      }
    }

    return closest ? closest.marker : null;
  }, [sortedMarkers, currentTime, proximityThreshold]);

  // Update active marker index when marker changes
  useEffect(() => {
    if (!activeMarker) {
      if (activeMarkerIndex !== -1) {
        setActiveMarkerIndex(-1);
      }
      return;
    }

    const newIndex = sortedMarkers.findIndex((m) => m.id === activeMarker.id);
    if (newIndex !== activeMarkerIndex) {
      setActiveMarkerIndex(newIndex);
      onMarkerChange?.(activeMarker, newIndex);
    }
  }, [activeMarker, sortedMarkers, activeMarkerIndex, onMarkerChange]);

  // Go to specific marker
  const goToMarker = useCallback((index: number) => {
    if (index < 0 || index >= sortedMarkers.length) return;
    const marker = sortedMarkers[index];
    onMarkerChange?.(marker, index);
  }, [sortedMarkers, onMarkerChange]);

  // Next marker
  const nextMarker = useCallback(() => {
    const nextIndex = activeMarkerIndex + 1;
    if (nextIndex < sortedMarkers.length) {
      goToMarker(nextIndex);
    }
  }, [activeMarkerIndex, sortedMarkers.length, goToMarker]);

  // Previous marker
  const previousMarker = useCallback(() => {
    const prevIndex = activeMarkerIndex - 1;
    if (prevIndex >= 0) {
      goToMarker(prevIndex);
    }
  }, [activeMarkerIndex, goToMarker]);

  const state: MarkerState = {
    markers: sortedMarkers,
    activeMarker,
    activeMarkerIndex,
  };

  const controls: MarkerControls = {
    goToMarker,
    nextMarker,
    previousMarker,
  };

  return {
    ...state,
    ...controls,
  };
}
