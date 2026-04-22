import React, { useMemo } from 'react';
import { PlayerProvider } from './PlayerContext';
import { TrackingProvider } from './TrackingContext';
import { AdProvider } from './AdContext';
import type { PlayerConfig, Track } from '@/types/player';
import type { TrackingConfig } from '@/types/tracking';
import type { AdConfig } from '@/types/ads';
import type { PartialLabels } from '@/types/labels';

export interface FairuProviderProps {
  children: React.ReactNode;

  /** Player configuration */
  config?: PlayerConfig;

  /** Tracking/analytics configuration. Disabled by default (GDPR). */
  tracking?: Partial<TrackingConfig>;

  /** Ad configuration */
  ads?: Partial<AdConfig>;

  /** Label overrides for i18n */
  labels?: PartialLabels;

  // Event callbacks (forwarded to PlayerProvider)
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onTrackChange?: (track: Track, index: number) => void;
  onError?: (error: Error) => void;
}

export function FairuProvider({
  children,
  config,
  tracking,
  ads,
  labels,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  onTrackChange,
  onError,
}: FairuProviderProps) {
  // Merge labels into player config
  const playerConfig = useMemo(() => ({
    ...config,
    labels: { ...config?.labels, ...labels },
  }), [config, labels]);

  // Build the provider tree - innermost is PlayerProvider
  let content = (
    <PlayerProvider
      config={playerConfig}
      onPlay={onPlay}
      onPause={onPause}
      onEnded={onEnded}
      onTimeUpdate={onTimeUpdate}
      onTrackChange={onTrackChange}
      onError={onError}
    >
      {children}
    </PlayerProvider>
  );

  // Optionally wrap with AdProvider
  if (ads) {
    content = <AdProvider config={ads}>{content}</AdProvider>;
  }

  // Optionally wrap with TrackingProvider
  if (tracking) {
    content = <TrackingProvider config={tracking}>{content}</TrackingProvider>;
  }

  return content;
}
