export type TrackingEventType =
  | 'play'
  | 'pause'
  | 'seek'
  | 'progress'
  | 'complete'
  | 'chapter_change'
  | 'track_change'
  | 'ad_start'
  | 'ad_complete'
  | 'ad_skip'
  | 'error';

export interface TrackingEventData {
  currentTime: number;
  duration: number;
  percentage?: number;
  sessionId?: string;
  trackId?: string;
  trackTitle?: string;
  chapterId?: string;
  chapterTitle?: string;
  adId?: string;
  playbackRate?: number;
  volume?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TrackingEvent {
  type: TrackingEventType;
  timestamp: number;
  data: TrackingEventData;
}

export interface TrackingEventsConfig {
  play?: boolean;
  pause?: boolean;
  seek?: boolean;
  complete?: boolean;
  progress?: boolean;
  chapterChange?: boolean;
  trackChange?: boolean;
  adStart?: boolean;
  adComplete?: boolean;
  adSkip?: boolean;
  error?: boolean;
}

export interface TrackingConfig {
  enabled: boolean;
  endpoint?: string;
  events?: TrackingEventsConfig;
  progressIntervals?: number[];
  batchEvents?: boolean;
  batchSize?: number;
  batchInterval?: number;
  headers?: Record<string, string>;
  transformEvent?: (event: TrackingEvent) => TrackingEvent | null;
  onTrack?: (event: TrackingEvent) => void;
}

export interface TrackingContextValue {
  config: TrackingConfig;
  track: (event: TrackingEvent) => void;
  setEnabled: (enabled: boolean) => void;
  setSessionId: (sessionId: string) => void;
  flush: () => Promise<void>;
}
