export interface TimelineMarker {
  id: string;
  /** Zeitpunkt in Sekunden */
  time: number;
  /** Optionaler Titel */
  title?: string;
  /** Preview-Bild URL (oder auto-generiert via Fairu) */
  previewImage?: string;
  /** Optionale Farbe für den Marker-Punkt (CSS-Farbwert) */
  color?: string;
}

export interface MarkerState {
  markers: TimelineMarker[];
  activeMarker: TimelineMarker | null;
  activeMarkerIndex: number;
}

export interface MarkerControls {
  goToMarker: (index: number) => void;
  nextMarker: () => void;
  previousMarker: () => void;
}

export interface UseMarkersOptions {
  markers: TimelineMarker[];
  currentTime: number;
  /** How close (in seconds) the current time must be to a marker to consider it "active" (default: 2) */
  proximityThreshold?: number;
  onMarkerChange?: (marker: TimelineMarker, index: number) => void;
}

export interface UseMarkersReturn extends MarkerState, MarkerControls {}
