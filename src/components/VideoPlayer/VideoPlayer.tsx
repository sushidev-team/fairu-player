import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { cn } from '@/utils/cn';
import { VideoProvider, useVideoPlayer } from '@/context/VideoContext';
import { VideoAdProvider, useVideoAds } from '@/context/VideoAdContext';
import { OverlayAdProvider, useOverlayAds, type OverlayAdControls } from '@/context/OverlayAdContext';
import { ThemeProvider } from '@/context/ThemeContext';
import type { FairuTheme } from '@/types/theme';
import type { AdEventBus } from '@/utils/AdEventBus';
import type { PlayerEventBus } from '@/utils/PlayerEventBus';
import { useLabels } from '@/context/LabelsContext';
import { interpolateLabel } from '@/types/labels';
import { VideoOverlay } from './VideoOverlay';
import { VideoControls } from './VideoControls';
import { LogoOverlay } from './LogoOverlay';
import { EndScreen } from './EndScreen';
import { PlayerErrorBoundary } from '@/components/ErrorBoundary';
import { OverlayAd } from '@/components/ads/OverlayAd';
import { InfoCard, InfoCardIcon } from '@/components/ads/InfoCard';
import { AdChoicesIcon } from '@/components/ads/AdChoicesIcon';
import { CompanionAd } from '@/components/ads/CompanionAd';
import { useKeyboardControls } from '@/hooks/useKeyboardControls';
import type { VideoConfig, VideoPlayerProps, VideoAdConfig, WatchProgress, VideoAdBreak, CustomAdComponentProps, VideoAd, OverlayAd as OverlayAdType, InfoCard as InfoCardType, RecommendedVideo } from '@/types/video';

/**
 * Ref handle for controlling the video player externally
 */
export interface VideoPlayerRef {
  /** Controls for dynamically showing/hiding overlay ads and info cards */
  overlayAdControls: OverlayAdControls;
}

interface VideoPlayerInnerProps {
  className?: string;
  /**
   * Supplied only by `VideoPlayerWithAds`, and the single thing that used to
   * justify a second 330-line copy of this component.
   *
   * When present it takes over "the viewer asked to play": the break decides
   * whether the video starts now or after a spot. When absent the player is an
   * ordinary one.
   */
  onPlayWithAds?: () => void;
  adState?: ReturnType<typeof useVideoAds>['state'];
  adControls?: ReturnType<typeof useVideoAds>['controls'];
  adVideoRef?: React.RefObject<HTMLVideoElement | null>;
  componentAdProps?: CustomAdComponentProps | null;
  /** Callback when overlay ad is closed */
  onOverlayAdClose?: (ad: OverlayAdType) => void;
  /** Callback when overlay ad is clicked */
  onOverlayAdClick?: (ad: OverlayAdType) => void;
  /** Callback when info card is dismissed */
  onInfoCardDismiss?: (card: InfoCardType) => void;
  /** Callback when info card is selected */
  onInfoCardSelect?: (card: InfoCardType) => void;
  /** Callback when recommended video is selected */
  onVideoSelect?: (video: RecommendedVideo) => void;
}

/**
 * Inner video player component that uses context
 */
function VideoPlayerInner({
  className,
  adState,
  adControls,
  adVideoRef,
  onPlayWithAds,
  componentAdProps,
  onOverlayAdClose,
  onOverlayAdClick,
  onInfoCardDismiss,
  onInfoCardSelect,
  onVideoSelect,
}: VideoPlayerInnerProps) {
  const { state, controls, config, videoRef, containerRef, currentTrack, playlistState, playlistControls } = useVideoPlayer();
  const { state: overlayState, controls: overlayControls } = useOverlayAds();
  const labels = useLabels();
  const [infoCardsExpanded, setInfoCardsExpanded] = useState(false);

  // Determine if controls should be disabled
  const isAdPlaying = adState?.isPlayingAd ?? false;
  const controlsDisabled = state.isLoading || isAdPlaying;

  // Get active overlay ads and info cards from context
  const activeOverlayAds = overlayState.activeOverlayAds;
  const activeInfoCards = overlayState.activeInfoCards;
  const manualOverlayAds = overlayState.manualOverlayAds;
  const manualInfoCards = overlayState.manualInfoCards;

  // Helper to check if an ad was manually triggered
  const isManualOverlayAd = useCallback(
    (adId: string) => manualOverlayAds.some((ad) => ad.id === adId),
    [manualOverlayAds]
  );
  const isManualInfoCard = useCallback(
    (cardId: string) => manualInfoCards.some((card) => card.id === cardId),
    [manualInfoCards]
  );

  // Handle mouse movement to show controls
  const handleMouseMove = useCallback(() => {
    controls.showControls();
  }, [controls]);

  // Handle mouse leave to hide controls
  const handleMouseLeave = useCallback(() => {
    if (state.isPlaying && !isAdPlaying) {
      controls.hideControls();
    }
  }, [state.isPlaying, isAdPlaying, controls]);

  // Handle click to toggle play/pause
  const handleClick = useCallback(() => {
    if (isAdPlaying) return;

    if (!state.isPlaying && onPlayWithAds) {
      onPlayWithAds();
    } else {
      controls.toggle();
    }
  }, [isAdPlaying, state.isPlaying, onPlayWithAds, controls]);

  // Handle replay
  const handleReplay = useCallback(() => {
    controls.seek(0);
    controls.play();
  }, [controls]);

  // Handle video selection from end screen
  const handleVideoSelect = useCallback((video: RecommendedVideo) => {
    config.endScreen?.onVideoSelect?.(video);
    onVideoSelect?.(video);
  }, [config.endScreen, onVideoSelect]);

  /*
    Controls that route "start playing" through the ad break.

    Everything else passes through untouched — only the two entry points that
    can begin playback need to ask first, and `toggle` only on the way in.
    Pausing is never intercepted.
  */
  const wrappedControls = onPlayWithAds
    ? {
        ...controls,
        play: async () => {
          onPlayWithAds();
        },
        toggle: async () => {
          if (!state.isPlaying) {
            onPlayWithAds();
          } else {
            await controls.toggle();
          }
        },
      }
    : controls;

  // Keyboard controls
  useKeyboardControls({
    controls: isAdPlaying ? undefined : wrappedControls,
    enabled: !isAdPlaying,
    // The arrow-key volume steps are relative, so the hook needs the level to
    // step from.
    volume: state.volume,
  });

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={cn(
        'fairu-video-player relative',
        'bg-black rounded-xl overflow-hidden',
        'aspect-video',
        state.isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Main Video Element */}
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: isAdPlaying ? 'none' : 'block' }}
        preload="metadata"
        playsInline
        poster={currentTrack?.poster || config.poster}
      >
        {/* Subtitle/caption tracks */}
        {currentTrack?.subtitles?.map((subtitle) => (
          <track
            key={subtitle.id}
            kind="subtitles"
            label={subtitle.id}
            srcLang={subtitle.language}
            src={subtitle.src}
            default={subtitle.default}
          />
        ))}
      </video>

      {/* Ad Video Element */}
      {adVideoRef && (
        <video
          ref={adVideoRef as React.RefObject<HTMLVideoElement>}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: isAdPlaying ? 'block' : 'none' }}
          playsInline
        />
      )}

      {/* Video Overlay (big play button, loading) */}
      {!isAdPlaying && (
        <VideoOverlay
          isPlaying={state.isPlaying}
          isLoading={state.isLoading}
          onClick={handleClick}
          visible={!state.isPlaying || state.isLoading}
        />
      )}

      {/* Ad Overlay */}
      {isAdPlaying && adState && adControls && (
        <div className="absolute inset-0 z-40">
          {/* Component Ad - render custom component */}
          {adState.isComponentAd && componentAdProps && (adState.currentAd as VideoAd)?.component && (
            <div className="absolute inset-0">
              {(() => {
                const AdComponent = (adState.currentAd as VideoAd).component!;
                return <AdComponent {...componentAdProps} />;
              })()}
            </div>
          )}

          {/* Video Ad controls - only show for non-component ads */}
          {!adState.isComponentAd && (
            <>
              {/* AdChoices badge — a compliance surface, so it sits above the
                  gradient rather than inside the control bar that fades. */}
              <div className="absolute right-3 top-3 z-10">
                <AdChoicesIcon
                  icons={(adState.currentAd as VideoAd | null)?.icons}
                  adId={adState.currentAd?.id}
                />
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-between mb-2">
                  {/* Ad badge */}
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded">
                      {labels.ad}
                    </span>
                    {adState.currentAd?.title && (
                      <span className="text-white text-sm">{adState.currentAd.title}</span>
                    )}
                    {adState.adsRemaining > 0 && (
                      <span className="text-white/60 text-sm">
                        {adState.adsRemaining + 1} of {(adState.currentAdBreak?.ads?.length ?? 0)}
                      </span>
                    )}
                  </div>

                  {/* Skip button */}
                  {adState.canSkip ? (
                    <button
                      onClick={adControls.skipAd}
                      className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-white/90 transition-colors"
                    >
                      {labels.skipAd}
                    </button>
                  ) : adState.skipCountdown > 0 ? (
                    <span className="px-4 py-2 bg-white/20 text-white text-sm rounded">
                      {interpolateLabel(labels.skipIn, { seconds: adState.skipCountdown })}
                    </span>
                  ) : null}
                </div>

                {/* Ad progress bar */}
                <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 transition-all"
                    style={{ width: `${(adState.adProgress / adState.adDuration) * 100}%` }}
                  />
                </div>
              </div>

              {/* Click-through area */}
              {adState.currentAd?.clickThroughUrl && (
                <button
                  onClick={adControls.clickThrough}
                  className="absolute inset-0 z-30 cursor-pointer"
                  style={{ bottom: '80px' }}
                  aria-label={labels.learnMore}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Logo Overlay */}
      {!isAdPlaying && config.logo && config.features?.logoOverlay !== false && (
        <LogoOverlay
          config={config.logo}
          visible={state.controlsVisible || !state.isPlaying}
          isPlaying={state.isPlaying}
          isFullscreen={state.isFullscreen}
        />
      )}

      {/* Overlay Ads */}
      {/*
        Each ad surface gets its own boundary. A malformed creative that throws
        during render would otherwise unmount the whole player — the viewer
        would lose the video because an advert failed. Keyed on the track so a
        failure on one video does not disable the surface for the session.
      */}
      <PlayerErrorBoundary subsystem="overlay-ads" resetKeys={[currentTrack?.id]}>
      {!isAdPlaying && activeOverlayAds.map((ad) => {
        const isManual = isManualOverlayAd(ad.id);
        return (
          <OverlayAd
            key={ad.id}
            ad={ad}
            currentTime={state.currentTime}
            visible={isManual || state.isPlaying}
            forceShow={isManual}
            onClose={(closedAd) => {
              overlayControls.hideOverlayAd(closedAd.id);
              onOverlayAdClose?.(closedAd);
            }}
            onClick={onOverlayAdClick}
          />
        );
      })}
      </PlayerErrorBoundary>

      <PlayerErrorBoundary subsystem="info-cards" resetKeys={[currentTrack?.id]}>
      {/* Info Card Icon */}
      {!isAdPlaying && activeInfoCards.length > 0 && (
        <InfoCardIcon
          hasActiveCards={activeInfoCards.length > 0}
          cardCount={activeInfoCards.length}
          expanded={infoCardsExpanded}
          onToggle={() => setInfoCardsExpanded(!infoCardsExpanded)}
        />
      )}

      {/* Info Cards */}
      {!isAdPlaying && activeInfoCards.map((card) => {
        const isManual = isManualInfoCard(card.id);
        return (
          <InfoCard
            key={card.id}
            card={card}
            currentTime={state.currentTime}
            duration={state.duration}
            expanded={infoCardsExpanded}
            forceShow={isManual}
            onDismiss={(dismissedCard) => {
              overlayControls.hideInfoCard(dismissedCard.id);
              onInfoCardDismiss?.(dismissedCard);
            }}
            onSelect={onInfoCardSelect}
          />
        );
      })}
      </PlayerErrorBoundary>

      {/* End Screen */}
      <PlayerErrorBoundary subsystem="end-screen" resetKeys={[currentTrack?.id]}>
      {!isAdPlaying && config.endScreen?.enabled && (
        <EndScreen
          config={config.endScreen}
          currentTime={state.currentTime}
          duration={state.duration}
          isEnded={state.isEnded}
          onVideoSelect={handleVideoSelect}
          onReplay={handleReplay}
        />
      )}
      </PlayerErrorBoundary>

      {/* Video Controls */}
      {!isAdPlaying && (
        <VideoControls
          visible={state.controlsVisible || !state.isPlaying}
          state={state}
          controls={wrappedControls}
          features={config.features}
          disabled={controlsDisabled}
          playlistState={playlistState}
          playlistControls={playlistControls}
          subtitles={currentTrack?.subtitles}
          markers={currentTrack?.markers || config.markers}
        />
      )}
    </div>
  );
}

export interface VideoPlayerWithProviderProps extends VideoPlayerProps {
  adConfig?: VideoAdConfig;
  /** Event bus for external control of overlay ads and info cards */
  adEventBus?: AdEventBus;
  /** Event bus for PiP and tab visibility events */
  playerEventBus?: PlayerEventBus;
  /** Called when playback starts (first play) */
  onStart?: () => void;
  /** Called when video has been fully watched (all segments covered) */
  onFinished?: () => void;
  /** Called when watch progress updates */
  onWatchProgressUpdate?: (progress: WatchProgress) => void;
  /**
   * Override the look. Only what you set changes; everything else keeps the
   * stylesheet default. See {@link FairuTheme}.
   */
  theme?: FairuTheme;
}

interface VideoPlayerWithOverlayProviderProps {
  className?: string;
  videoConfig: VideoConfig;
  adConfig?: VideoAdConfig;
  adEventBus?: AdEventBus;
  playerEventBus?: PlayerEventBus;
  playerRef: React.ForwardedRef<VideoPlayerRef>;
}

/**
 * Complete video player component with providers
 */
export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerWithProviderProps>(function VideoPlayer({
  config,
  track,
  playlist,
  className,
  adConfig,
  adEventBus,
  playerEventBus,
  onStart,
  onPlay,
  onPause,
  onEnded,
  onFinished,
  onTimeUpdate,
  onWatchProgressUpdate,
  onTrackChange,
  onError,
  onFullscreenChange,
  onPictureInPictureChange,
  onTabVisibilityChange,
  theme,
}, ref) {
  // The `track` and `playlist` props are shorthands for the same fields inside
  // `config`, so they may only override when they were actually passed.
  // Spreading them unconditionally wrote `undefined` over `config.track` for
  // every caller who used the config form — `<VideoPlayer config={{ track }} />`
  // rendered a player with no source at all, silently.
  const videoConfig: VideoConfig = {
    ...config,
    ...(track !== undefined ? { track } : {}),
    ...(playlist !== undefined ? { playlist } : {}),
  };

  // Wrap PiP change to emit on playerEventBus
  const handlePictureInPictureChange = useCallback((isPiP: boolean) => {
    onPictureInPictureChange?.(isPiP);
    if (playerEventBus) {
      playerEventBus.emit(isPiP ? 'enterPictureInPicture' : 'exitPictureInPicture');
    }
  }, [onPictureInPictureChange, playerEventBus]);

  return (
    <ThemeProvider theme={theme} className="contents">
    <VideoProvider
      config={videoConfig}
      adEventBus={adEventBus}
      playerEventBus={playerEventBus}
      onStart={onStart}
      onPlay={onPlay}
      onPause={onPause}
      onEnded={onEnded}
      onFinished={onFinished}
      onTimeUpdate={onTimeUpdate}
      onWatchProgressUpdate={onWatchProgressUpdate}
      onTrackChange={onTrackChange}
      onError={onError}
      onFullscreenChange={onFullscreenChange}
      onPictureInPictureChange={handlePictureInPictureChange}
      onTabVisibilityChange={onTabVisibilityChange}
    >
      <VideoPlayerWithOverlayProvider
        className={className}
        videoConfig={videoConfig}
        adConfig={adConfig}
        adEventBus={adEventBus}
        playerEventBus={playerEventBus}
        playerRef={ref}
      />
    </VideoProvider>
    </ThemeProvider>
  );
});

/**
 * Internal component that wraps OverlayAdProvider with video state access
 */
function VideoPlayerWithOverlayProvider({
  className,
  videoConfig,
  adConfig,
  adEventBus,
  playerEventBus: _playerEventBus,
  playerRef,
}: VideoPlayerWithOverlayProviderProps) {
  const { state } = useVideoPlayer();

  return (
    <OverlayAdProvider
      overlayAds={videoConfig.overlayAds}
      infoCards={videoConfig.infoCards}
      currentTime={state.currentTime}
      duration={state.duration}
      adEventBus={adEventBus}
    >
      <VideoPlayerRefHandler playerRef={playerRef} />
      {/*
        Switch on whether an ad config was *supplied*, not on `enabled`.
        `enabled` commonly flips false → true while ad tags are still resolving
        (that is exactly what `useVastAdBreaks` produces), and branching on it
        would unmount one subtree and mount the other — swapping the `<video>`
        element mid-flight.
      */}
      {adConfig ? (
        <VideoAdProvider config={adConfig}>
          <VideoPlayerWithAds className={className} />
        </VideoAdProvider>
      ) : (
        <VideoPlayerInner className={className} />
      )}
    </OverlayAdProvider>
  );
}

/**
 * Component that exposes overlay ad controls via ref
 */
function VideoPlayerRefHandler({ playerRef }: { playerRef: React.ForwardedRef<VideoPlayerRef> }) {
  const { controls } = useOverlayAds();

  useImperativeHandle(playerRef, () => ({
    overlayAdControls: controls,
  }), [controls]);

  return null;
}

/**
 * Video player with ad context and automatic ad triggering
 */
function VideoPlayerWithAds({ className }: { className?: string }) {
  const { state: videoState, controls: videoControls } = useVideoPlayer();
  const { state: adState, controls: adControls, adVideoRef, config: adConfig, componentAdProps } = useVideoAds();

  const hasPlayedPreRoll = useRef(false);
  const playedMidRolls = useRef<Set<string>>(new Set());
  const hasPlayedPostRoll = useRef(false);
  const pendingPlay = useRef(false);

  // Find ad breaks by position
  const preRollAds = adConfig.adBreaks?.filter((ab) => ab.position === 'pre-roll') ?? [];
  const midRollAds = adConfig.adBreaks?.filter((ab) => ab.position === 'mid-roll') ?? [];
  const postRollAds = adConfig.adBreaks?.filter((ab) => ab.position === 'post-roll') ?? [];

  /*
    The master switch.

    `enabled` is a required field on `AdConfig`, and every other consumer of it
    honours it — `AdService`, `useReelsFeed`, `reelsAdScheduler`. This player
    did not, so a host switching ads off for a paying subscriber, or for a
    region that opted out, still got a pre-roll.

    Only the automatic triggers are gated. A host calling `startAdBreak`
    directly is asking for a break explicitly, and silently dropping that would
    be its own surprise.

    Undefined counts as enabled: the field is required by the type, so a value
    that is missing at runtime comes from untyped JS, and losing booked
    inventory is the worse of the two failures. Only an explicit `false`
    suppresses anything.
  */
  const adsEnabled = adConfig.enabled !== false;

  // Handle pre-roll: intercept first play and show ad first
  const handlePlayWithAds = useCallback(() => {
    if (adsEnabled && !hasPlayedPreRoll.current && preRollAds.length > 0) {
      hasPlayedPreRoll.current = true;
      pendingPlay.current = true;
      adControls.startAdBreak(preRollAds[0] as VideoAdBreak);
    } else {
      videoControls.play();
    }
  }, [adsEnabled, preRollAds, adControls, videoControls]);

  // Resume main video after ad ends
  useEffect(() => {
    if (!adState.isPlayingAd && pendingPlay.current) {
      pendingPlay.current = false;
      videoControls.play();
    }
  }, [adState.isPlayingAd, videoControls]);

  // Handle mid-roll: trigger ads at specific times
  useEffect(() => {
    if (!adsEnabled || adState.isPlayingAd || videoState.duration <= 0) return;

    for (const adBreak of midRollAds) {
      if (
        adBreak.triggerTime &&
        videoState.currentTime >= adBreak.triggerTime &&
        !playedMidRolls.current.has(adBreak.id)
      ) {
        playedMidRolls.current.add(adBreak.id);
        videoControls.pause();
        pendingPlay.current = true;
        adControls.startAdBreak(adBreak as VideoAdBreak);
        break;
      }
    }
  }, [adsEnabled, videoState.currentTime, videoState.duration, adState.isPlayingAd, midRollAds, videoControls, adControls]);

  // Handle post-roll: trigger ads when video ends
  useEffect(() => {
    if (
      adsEnabled &&
      videoState.isEnded &&
      !hasPlayedPostRoll.current &&
      postRollAds.length > 0
    ) {
      hasPlayedPostRoll.current = true;
      adControls.startAdBreak(postRollAds[0] as VideoAdBreak);
    }
  }, [adsEnabled, videoState.isEnded, postRollAds, adControls]);

  // Reset ad tracking when source changes
  useEffect(() => {
    hasPlayedPreRoll.current = false;
    playedMidRolls.current.clear();
    hasPlayedPostRoll.current = false;
    pendingPlay.current = false;
  }, [videoState.duration]);

  const companionAd = adState.isPlayingAd ? (adState.currentAd as VideoAd | null) : null;
  const showCompanion = Boolean(adConfig.showCompanion && companionAd?.companion);

  const player = (
    <VideoPlayerInner
      className={className}
      adState={adState}
      adControls={adControls}
      adVideoRef={adVideoRef}
      onPlayWithAds={handlePlayWithAds}
      componentAdProps={componentAdProps}
    />
  );

  // Only wrap when there is something to wrap with — an unconditional extra
  // element would change the layout of every existing integration.
  if (!showCompanion || !companionAd) return player;

  return (
    <>
      {player}
      <CompanionAd
        ad={companionAd}
        onClick={() => adConfig.onAdClick?.(companionAd, adState.currentAdBreak!)}
        className="mt-3 w-full max-w-[300px]"
      />
    </>
  );
}

export default VideoPlayer;
