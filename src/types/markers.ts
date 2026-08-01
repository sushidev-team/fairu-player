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

/**
 * An entry on a {@link TimelineTrack}.
 *
 * A point when only `time` is set, a range when `endTime` is too. Ranges are the
 * reason this exists separately from {@link TimelineMarker}: a sponsor segment,
 * an ad break or a "skip intro" region has a length, and a dot on the seek bar
 * cannot express one.
 */
export interface TimelineAction {
  id: string;
  /** Start (or the only point) in seconds. */
  time: number;
  /** End in seconds. Present ⇒ the action is a range. */
  endTime?: number;
  /** Shown in the tooltip and as the accessible name. */
  label?: string;
  /** CSS colour. Falls back to the track colour, then the accent. */
  color?: string;
  /** Rendered inside the action — an icon or short glyph. */
  icon?: React.ReactNode;
  /** Passed straight back to the callbacks. Use it to carry your own payload. */
  data?: unknown;
  /** Renders dimmed and ignores interaction. */
  disabled?: boolean;
}

/** Context handed to a track's custom renderer. */
export interface TimelineActionRenderContext {
  track: TimelineTrack;
  /** Left edge as a percentage of the duration. */
  left: number;
  /** Width as a percentage — `0` for a point. */
  width: number;
  /** The playhead is inside this action (or within 0.5s of a point). */
  active: boolean;
  selected: boolean;
}

/**
 * A lane rendered below the seek bar.
 *
 * Its whole reason to exist is that it is **not** the seek surface. Markers
 * placed on the bar itself have to fight the scrub gesture — every handler needs
 * `stopPropagation`, a single click must still seek, and adding one has to be a
 * double click to stay out of the way. In a lane none of that applies: a single
 * click selects, empty space adds, and dragging never scrubs.
 */
export interface TimelineTrack {
  id: string;
  /** Shown to the left of the lane, and as its accessible name. */
  label?: string;
  actions: TimelineAction[];
  /** Default colour for actions that do not set their own. */
  color?: string;
  /** Lane height in px. Default `10`. */
  height?: number;
  /** Seek to an action when it is selected. Default `true`. */
  seekOnSelect?: boolean;
  /** Clicking empty lane space calls `onActionAdd`. Default `false`. */
  editable?: boolean;
  /** Actions can be dragged along the lane. Default `false`. */
  movable?: boolean;
  /** Range actions grow edge handles. Default `false`. */
  resizable?: boolean;
  /** Replace the default rendering entirely. */
  renderAction?: (
    action: TimelineAction,
    context: TimelineActionRenderContext
  ) => React.ReactNode;
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
