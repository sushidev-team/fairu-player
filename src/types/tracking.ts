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
  | 'pip_enter'
  | 'pip_exit'
  | 'tab_hidden'
  | 'tab_visible'
  | 'return_ad_triggered'
  | 'error'
  | 'heartbeat'
  | 'session_start'
  | 'session_end';

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
  pipEnter?: boolean;
  pipExit?: boolean;
  tabHidden?: boolean;
  tabVisible?: boolean;
  returnAdTriggered?: boolean;
  error?: boolean;
  heartbeat?: boolean;
  sessionStart?: boolean;
  sessionEnd?: boolean;
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
  /** Heartbeat interval in ms. Disabled by default. Set to enable (e.g. 30000). */
  heartbeat?: number;
  /** Max retry attempts for failed send requests (default: 3) */
  maxRetries?: number;
  /** Request timeout in ms (default: 5000) */
  requestTimeout?: number;
  /** Enable offline queue with localStorage (default: false) */
  offlineQueue?: boolean;
  /** Max number of events stored in offline queue (default: 100) */
  offlineQueueMaxSize?: number;
}

export interface TrackingContextValue {
  config: TrackingConfig;
  track: (event: TrackingEvent) => void;
  setEnabled: (enabled: boolean) => void;
  setSessionId: (sessionId: string) => void;
  flush: () => Promise<void>;
}
