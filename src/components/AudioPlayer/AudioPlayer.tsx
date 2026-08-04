import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';
import { PlayerProvider } from '@/context/PlayerContext';
import { AdProvider, useAds } from '@/context/AdContext';
import { LabelsProvider } from '@/context/LabelsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import type { FairuTheme } from '@/types/theme';
import { usePlayer } from '@/hooks/usePlayer';
import { PlayerInner } from '@/components/Player/Player';
import { CompanionAd } from '@/components/ads/CompanionAd';
import { AdChoicesIcon } from '@/components/ads/AdChoicesIcon';
import type { AdBreak, AdConfig } from '@/types/ads';
import type { PlayerConfig, Track } from '@/types/player';
import type { PartialLabels } from '@/types/labels';

export interface AudioPlayerProps {
  config?: PlayerConfig;
  track?: Track;
  playlist?: Track[];
  /** Ad configuration. Supply `adBreaks` directly or from `useVastAdBreaks`. */
  adConfig?: AdConfig;
  labels?: PartialLabels;
  /** Override the look. See {@link FairuTheme}. */
  theme?: FairuTheme;
  showChapters?: boolean;
  showPlaylist?: boolean;
  compact?: boolean;
  /**
   * Show the `<Companion>` artwork slot while an ad plays. Default `true` —
   * for a podcast this is the advertiser's only visual, so hiding it throws
   * away most of the value of the unit.
   */
  showCompanion?: boolean;
  /** Artwork shown when the ad has no companion. Defaults to the track artwork. */
  fallbackArtwork?: string;
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onTrackChange?: (track: Track, index: number) => void;
  onError?: (error: Error) => void;
}

/**
 * Audio player with ad support — the counterpart to `VideoPlayer`.
 *
 * `Player` is the bare presentational component and expects the host to supply
 * its own `PlayerProvider`; it also accepts `adState`/`adControls` that nothing
 * ever provided. This composes the providers, drives pre/mid/post-roll breaks
 * and renders the companion artwork.
 *
 * ```tsx
 * const { adBreaks } = useVastAdBreaks({
 *   preRoll: 'https://ads.example.com/vast?pos=pre',
 *   midRolls: [{ at: 600, tagUrl: 'https://ads.example.com/vast?pos=mid' }],
 *   mediaFileOptions: audioAdMediaOptions(),
 * });
 *
 * <AudioPlayer track={episode} adConfig={{ enabled: true, adBreaks }} />
 * ```
 *
 * Note on podcasts generally: most podcast advertising is stitched into the
 * audio server-side, because listeners are in third-party apps that never run
 * this code. Client-side ads are for surfaces you own — your embed, your app.
 */
export function AudioPlayer({
  config,
  track,
  playlist,
  adConfig,
  labels,
  theme,
  showChapters,
  showPlaylist,
  compact,
  showCompanion = true,
  fallbackArtwork,
  className,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  onTrackChange,
  onError,
}: AudioPlayerProps) {
  const playerConfig: PlayerConfig = {
    ...config,
    ...(track ? { track } : {}),
    ...(playlist ? { playlist } : {}),
  };

  return (
    <ThemeProvider theme={theme} className="contents">
    <LabelsProvider labels={labels}>
      <PlayerProvider
        config={playerConfig}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        onTimeUpdate={onTimeUpdate}
        onTrackChange={onTrackChange}
        onError={onError}
      >
        {/*
          Switch on whether an ad config was supplied, never on `enabled`.
          `enabled` commonly flips false → true while ad tags resolve, and
          branching on it would remount the audio element mid-flight.
        */}
        {adConfig ? (
          <AdProvider config={adConfig}>
            <AudioPlayerWithAds
              className={className}
              showChapters={showChapters}
              showPlaylist={showPlaylist}
              compact={compact}
              showCompanion={showCompanion}
              fallbackArtwork={fallbackArtwork}
            />
          </AdProvider>
        ) : (
          <PlayerInner
            className={className}
            showChapters={showChapters}
            showPlaylist={showPlaylist}
            compact={compact}
          />
        )}
      </PlayerProvider>
    </LabelsProvider>
    </ThemeProvider>
  );
}

interface AudioPlayerWithAdsProps {
  className?: string;
  showChapters?: boolean;
  showPlaylist?: boolean;
  compact?: boolean;
  showCompanion: boolean;
  fallbackArtwork?: string;
}

/** Drives ad breaks against the audio timeline. */
function AudioPlayerWithAds({
  className,
  showChapters,
  showPlaylist,
  compact,
  showCompanion,
  fallbackArtwork,
}: AudioPlayerWithAdsProps) {
  const { state, playlistState, controls } = usePlayer();
  const { state: adState, controls: adControls, config: adConfig } = useAds();

  const hasPlayedPreRoll = useRef(false);
  const playedMidRolls = useRef<Set<string>>(new Set());
  const hasPlayedPostRoll = useRef(false);
  const wasPlayingRef = useRef(false);

  const breaks = adConfig.adBreaks ?? [];
  const preRolls = breaks.filter((b) => b.position === 'pre-roll');
  const midRolls = breaks.filter((b) => b.position === 'mid-roll');
  const postRolls = breaks.filter((b) => b.position === 'post-roll');

  // Pre-roll: intercept the first play.
  useEffect(() => {
    if (!state.isPlaying || hasPlayedPreRoll.current || preRolls.length === 0) return;

    hasPlayedPreRoll.current = true;
    wasPlayingRef.current = true;
    controls.pause();
    adControls.startAdBreak(preRolls[0] as AdBreak);
  }, [state.isPlaying, preRolls, controls, adControls]);

  // Mid-roll: trigger at the configured playhead.
  useEffect(() => {
    if (adState.isPlayingAd || state.duration <= 0) return;

    for (const adBreak of midRolls) {
      if (
        adBreak.triggerTime !== undefined &&
        state.currentTime >= adBreak.triggerTime &&
        !playedMidRolls.current.has(adBreak.id)
      ) {
        playedMidRolls.current.add(adBreak.id);
        wasPlayingRef.current = state.isPlaying;
        controls.pause();
        adControls.startAdBreak(adBreak as AdBreak);
        break;
      }
    }
  }, [
    state.currentTime,
    state.duration,
    state.isPlaying,
    adState.isPlayingAd,
    midRolls,
    controls,
    adControls,
  ]);

  // Post-roll.
  useEffect(() => {
    if (!state.isEnded || hasPlayedPostRoll.current || postRolls.length === 0) return;
    hasPlayedPostRoll.current = true;
    wasPlayingRef.current = false;
    adControls.startAdBreak(postRolls[0] as AdBreak);
  }, [state.isEnded, postRolls, adControls]);

  // Resume the episode once the break finishes.
  const wasPlayingAd = useRef(false);
  useEffect(() => {
    if (wasPlayingAd.current && !adState.isPlayingAd && wasPlayingRef.current) {
      wasPlayingRef.current = false;
      void controls.play();
    }
    wasPlayingAd.current = adState.isPlayingAd;
  }, [adState.isPlayingAd, controls]);

  // Reset when the episode changes.
  useEffect(() => {
    hasPlayedPreRoll.current = false;
    playedMidRolls.current.clear();
    hasPlayedPostRoll.current = false;
  }, [playlistState.currentIndex]);

  const handleCompanionClick = useCallback(() => {
    if (adState.currentAd && adState.currentAdBreak) {
      adConfig.onAdClick?.(adState.currentAd, adState.currentAdBreak);
    }
  }, [adState.currentAd, adState.currentAdBreak, adConfig]);

  const artwork = fallbackArtwork ?? playlistState.currentTrack?.artwork;

  return (
    <div className={cn('fairu-audio-player', className)}>
      {showCompanion && adState.isPlayingAd && adState.currentAd && (
        <div className="relative mb-4 w-full max-w-[240px]">
          <CompanionAd
            ad={adState.currentAd}
            fallbackArtwork={artwork}
            fallbackAlt={playlistState.currentTrack?.title}
            onClick={handleCompanionClick}
            className="aspect-square w-full"
          />
          {/* The badge belongs to the spot, so it rides on the artwork that
              replaced the episode cover for its duration. */}
          <div className="absolute right-2 top-2">
            <AdChoicesIcon icons={adState.currentAd.icons} adId={adState.currentAd.id} />
          </div>
        </div>
      )}

      <PlayerInner
        showChapters={showChapters}
        showPlaylist={showPlaylist}
        compact={compact}
        adState={adState}
        adControls={adControls}
      />
    </div>
  );
}

export default AudioPlayer;
