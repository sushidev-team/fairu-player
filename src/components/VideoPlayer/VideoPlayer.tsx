import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { cn } from '@/utils/cn';
import { VideoProvider, useVideoPlayer } from '@/context/VideoContext';
import { VideoAdProvider, useVideoAds } from '@/context/VideoAdContext';
import { OverlayAdProvider, useOverlayAds, type OverlayAdControls } from '@/context/OverlayAdContext';
import { useLabels } from '@/context/LabelsContext';
import { interpolateLabel } from '@/types/labels';
import { VideoOverlay } from './VideoOverlay';
import { VideoControls } from './VideoControls';
import { LogoOverlay } from './LogoOverlay';
import { EndScreen } from './EndScreen';
import { OverlayAd } from '@/components/ads/OverlayAd';
import { InfoCard, InfoCardIcon } from '@/components/ads/InfoCard';
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
    if (!isAdPlaying) {
      controls.toggle();
    }
  }, [isAdPlaying, controls]);

  // Handle replay
  const handleReplay = useCallback(() => {
    controls.seek(0);
    controls.play();
  }, [controls]);

  // Handle video selection from end screen
  const handleVideoSelect = useCallback((video: RecommendedVideo) => {
    config.endScreen?.onVideoSelect?.(video);
    onVideoSelect?.(video);

    // If the video has a src, load it into the player
    if (video.src) {
      // This would require playlist support to work fully
      // For now, just trigger the callback
    }
  }, [config.endScreen, onVideoSelect]);

  // Keyboard controls
  useKeyboardControls({
    controls: isAdPlaying ? undefined : controls,
    enabled: !isAdPlaying,
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
      {!isAdPlaying && activeOverlayAds.map((ad) => (
        <OverlayAd
          key={ad.id}
          ad={ad}
          currentTime={state.currentTime}
          visible={state.isPlaying}
          onClose={(closedAd) => {
            overlayControls.hideOverlayAd(closedAd.id);
            onOverlayAdClose?.(closedAd);
          }}
          onClick={onOverlayAdClick}
        />
      ))}

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
      {!isAdPlaying && activeInfoCards.map((card) => (
        <InfoCard
          key={card.id}
          card={card}
          currentTime={state.currentTime}
          duration={state.duration}
          expanded={infoCardsExpanded}
          onDismiss={(dismissedCard) => {
            overlayControls.hideInfoCard(dismissedCard.id);
            onInfoCardDismiss?.(dismissedCard);
          }}
          onSelect={onInfoCardSelect}
        />
      ))}

      {/* End Screen */}
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

      {/* Video Controls */}
      {!isAdPlaying && (
        <VideoControls
          visible={state.controlsVisible || !state.isPlaying}
          state={state}
          controls={controls}
          features={config.features}
          disabled={controlsDisabled}
          playlistState={playlistState}
          playlistControls={playlistControls}
          subtitles={currentTrack?.subtitles}
        />
      )}
    </div>
  );
}

export interface VideoPlayerWithProviderProps extends VideoPlayerProps {
  adConfig?: VideoAdConfig;
  /** Called when playback starts (first play) */
  onStart?: () => void;
  /** Called when video has been fully watched (all segments covered) */
  onFinished?: () => void;
  /** Called when watch progress updates */
  onWatchProgressUpdate?: (progress: WatchProgress) => void;
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
}, ref) {
  const videoConfig: VideoConfig = {
    ...config,
    track,
    playlist,
  };

  return (
    <VideoProvider
      config={videoConfig}
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
    >
      <VideoPlayerWithOverlayProvider
        className={className}
        videoConfig={videoConfig}
        adConfig={adConfig}
        playerRef={ref}
      />
    </VideoProvider>
  );
});

/**
 * Internal component that wraps OverlayAdProvider with video state access
 */
function VideoPlayerWithOverlayProvider({
  className,
  videoConfig,
  adConfig,
  playerRef,
}: {
  className?: string;
  videoConfig: VideoConfig;
  adConfig?: VideoAdConfig;
  playerRef: React.ForwardedRef<VideoPlayerRef>;
}) {
  const { state } = useVideoPlayer();

  return (
    <OverlayAdProvider
      overlayAds={videoConfig.overlayAds}
      infoCards={videoConfig.infoCards}
      currentTime={state.currentTime}
      duration={state.duration}
    >
      <VideoPlayerRefHandler playerRef={playerRef} />
      {adConfig?.enabled ? (
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

  // Handle pre-roll: intercept first play and show ad first
  const handlePlayWithAds = useCallback(() => {
    if (!hasPlayedPreRoll.current && preRollAds.length > 0) {
      hasPlayedPreRoll.current = true;
      pendingPlay.current = true;
      adControls.startAdBreak(preRollAds[0] as VideoAdBreak);
    } else {
      videoControls.play();
    }
  }, [preRollAds, adControls, videoControls]);

  // Resume main video after ad ends
  useEffect(() => {
    if (!adState.isPlayingAd && pendingPlay.current) {
      pendingPlay.current = false;
      videoControls.play();
    }
  }, [adState.isPlayingAd, videoControls]);

  // Handle mid-roll: trigger ads at specific times
  useEffect(() => {
    if (adState.isPlayingAd || videoState.duration <= 0) return;

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
  }, [videoState.currentTime, videoState.duration, adState.isPlayingAd, midRollAds, videoControls, adControls]);

  // Handle post-roll: trigger ads when video ends
  useEffect(() => {
    if (
      videoState.isEnded &&
      !hasPlayedPostRoll.current &&
      postRollAds.length > 0
    ) {
      hasPlayedPostRoll.current = true;
      adControls.startAdBreak(postRollAds[0] as VideoAdBreak);
    }
  }, [videoState.isEnded, postRollAds, adControls]);

  // Reset ad tracking when source changes
  useEffect(() => {
    hasPlayedPreRoll.current = false;
    playedMidRolls.current.clear();
    hasPlayedPostRoll.current = false;
    pendingPlay.current = false;
  }, [videoState.duration]);

  return (
    <VideoPlayerInnerWithAds
      className={className}
      adState={adState}
      adControls={adControls}
      adVideoRef={adVideoRef}
      onPlayWithAds={handlePlayWithAds}
      componentAdProps={componentAdProps}
    />
  );
}

interface VideoPlayerInnerWithAdsProps extends VideoPlayerInnerProps {
  onPlayWithAds?: () => void;
  componentAdProps?: CustomAdComponentProps | null;
}

/**
 * Inner player that uses custom play handler for ad integration
 */
function VideoPlayerInnerWithAds({
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
}: VideoPlayerInnerWithAdsProps) {
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

  // Handle click to toggle play/pause with ad support
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

  // Wrapped controls for ad integration
  const wrappedControls = {
    ...controls,
    play: async () => {
      if (onPlayWithAds) {
        onPlayWithAds();
      } else {
        await controls.play();
      }
    },
    toggle: async () => {
      if (!state.isPlaying && onPlayWithAds) {
        onPlayWithAds();
      } else {
        await controls.toggle();
      }
    },
  };

  // Keyboard controls
  useKeyboardControls({
    controls: isAdPlaying ? undefined : wrappedControls,
    enabled: !isAdPlaying,
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

                  {/* Skip button - only show if skipping is allowed */}
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
      {!isAdPlaying && activeOverlayAds.map((ad) => (
        <OverlayAd
          key={ad.id}
          ad={ad}
          currentTime={state.currentTime}
          visible={state.isPlaying}
          onClose={(closedAd) => {
            overlayControls.hideOverlayAd(closedAd.id);
            onOverlayAdClose?.(closedAd);
          }}
          onClick={onOverlayAdClick}
        />
      ))}

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
      {!isAdPlaying && activeInfoCards.map((card) => (
        <InfoCard
          key={card.id}
          card={card}
          currentTime={state.currentTime}
          duration={state.duration}
          expanded={infoCardsExpanded}
          onDismiss={(dismissedCard) => {
            overlayControls.hideInfoCard(dismissedCard.id);
            onInfoCardDismiss?.(dismissedCard);
          }}
          onSelect={onInfoCardSelect}
        />
      ))}

      {/* End Screen */}
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
        />
      )}
    </div>
  );
}

export default VideoPlayer;
