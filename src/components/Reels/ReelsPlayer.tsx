import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { LabelsProvider } from '@/context/LabelsContext';
import { useLabels } from '@/context/LabelsContext';
import { useReelsFeed } from '@/hooks/useReelsFeed';
import type { Reel, ReelSlide, ReelsPlayerProps } from '@/types/reels';
import { ReelItem } from './ReelItem';
import { ReelAdSlide } from './ReelAdSlide';

const DEFAULT_TRANSITION_MS = 320;
const DEFAULT_SWIPE_THRESHOLD = 0.18;
/** Wheel delta that has to accumulate before a scroll commits to a slide change. */
const WHEEL_COMMIT_DELTA = 40;
/** Ignore further wheel events for this long after a commit, so one flick = one slide. */
const WHEEL_COOLDOWN_MS = 420;

/**
 * A vertical short-form video feed — the Shorts / Reels / TikTok interaction
 * model, with VAST-backed ad slides interleaved.
 *
 * ## How it works
 *
 * The track is a single `translate3d` column, not a native scroll container.
 * Native scroll-snap gives better momentum on iOS but makes two requirements
 * awkward: pinning playback to exactly one slide, and refusing to advance while
 * a gated ad is on screen. A transform-driven track makes both trivial and
 * behaves identically in every browser.
 *
 * Only `config.windowSize` neighbours are mounted, and only the active slide
 * plays — see {@link ReelItem} for why that matters on mobile.
 *
 * ```tsx
 * <ReelsPlayer
 *   reels={reels}
 *   config={{
 *     ads: {
 *       enabled: true,
 *       frequency: 4,
 *       startAfter: 2,
 *       tagUrl: 'https://ads.example.com/vast?cb=[CACHEBUSTING]',
 *       defaultSkipOffset: 5,
 *     },
 *   }}
 *   onLoadMore={fetchNextPage}
 * />
 * ```
 */
export function ReelsPlayer(props: ReelsPlayerProps) {
  // Labels have to be available to every child, including the ad slide.
  return (
    <LabelsProvider labels={props.config?.labels}>
      <ReelsPlayerInner {...props} />
    </LabelsProvider>
  );
}

function ReelsPlayerInner({
  reels,
  config = {},
  initialIndex = 0,
  className,
  renderOverlay,
  onSlideChange,
  onReelChange,
  onReelComplete,
  onReelProgress,
  onLike,
  onSave,
  onFollow,
  onComment,
  onShare,
  onCtaClick,
  onMuteChange,
  onLoadMore,
  onError,
}: ReelsPlayerProps) {
  const labels = useLabels();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const features = config.features ?? {};
  const layout = config.layout ?? 'portrait';
  const transitionMs = config.transitionMs ?? DEFAULT_TRANSITION_MS;
  const swipeThreshold = config.swipeThreshold ?? DEFAULT_SWIPE_THRESHOLD;
  const preloadCount = Math.max(0, config.preloadCount ?? 1);

  const { state, controls, adPlayback } = useReelsFeed({
    reels,
    config,
    initialIndex,
    onSlideChange,
    onReelChange,
    onLoadMore,
    onMuteChange,
    onLike,
    onSave,
    onFollow,
    onError,
  });

  const { slides, activeIndex, mountedIndices, muted, playing, advanceBlocked } = state;

  /* ------------------------------ Drag state ------------------------------ */

  // The gesture is tracked in refs and only mirrored into state for the visual
  // transform. Reading it back from state would make the commit depend on when
  // React flushes between pointermove and pointerup, which is not a guarantee
  // worth betting a navigation gesture on.
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef(0);
  const draggingRef = useRef(false);
  const dragStartRef = useRef<{ y: number; pointerId: number } | null>(null);
  const containerHeightRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      containerHeightRef.current = container.clientHeight;
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const commitDrag = useCallback(() => {
    const height = containerHeightRef.current || 1;
    const ratio = dragOffsetRef.current / height;

    // Dragging up (negative offset) advances.
    if (ratio <= -swipeThreshold) controls.next();
    else if (ratio >= swipeThreshold) controls.previous();

    dragOffsetRef.current = 0;
    draggingRef.current = false;
    dragStartRef.current = null;
    setDragOffset(0);
    setDragging(false);
  }, [controls, swipeThreshold]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (features.swipe === false) return;
      // Only primary pointers drive navigation; a second finger is a pinch.
      if (!event.isPrimary) return;

      // Re-measure here rather than trusting the ResizeObserver alone: a layout
      // change that does not trigger the observer (or an environment without
      // one) would otherwise leave the drag maths using a stale height.
      const height = event.currentTarget.clientHeight;
      if (height > 0) containerHeightRef.current = height;

      dragStartRef.current = { y: event.clientY, pointerId: event.pointerId };
    },
    [features.swipe]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = dragStartRef.current;
      if (!start || start.pointerId !== event.pointerId) return;

      const delta = event.clientY - start.y;

      // Only treat it as a drag once it clears the tap slop, so taps still work.
      if (!draggingRef.current && Math.abs(delta) < 8) return;
      if (!draggingRef.current) {
        draggingRef.current = true;
        setDragging(true);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Capture fails if the pointer was already released. The drag still
          // works via the element's own handlers, so this is not fatal.
        }
      }

      const height = containerHeightRef.current || 1;
      const atStart = activeIndex === 0 && delta > 0;
      const atEnd = activeIndex === slides.length - 1 && delta < 0;
      const blocked = advanceBlocked && delta < 0;

      // Rubber-band at the ends and against a gated ad instead of hard-stopping.
      const resistance = atStart || atEnd || blocked ? 0.25 : 1;
      const offset = Math.max(-height, Math.min(height, delta * resistance));

      dragOffsetRef.current = offset;
      setDragOffset(offset);
    },
    [activeIndex, slides.length, advanceBlocked]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = dragStartRef.current;
      if (!start || start.pointerId !== event.pointerId) return;

      if (!draggingRef.current) {
        dragStartRef.current = null;
        return;
      }
      commitDrag();
    },
    [commitDrag]
  );

  /* -------------------------------- Wheel -------------------------------- */

  const wheelAccumRef = useRef(0);
  const wheelLockedUntilRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || features.wheel === false) return;

    const handleWheel = (event: WheelEvent) => {
      // The feed owns vertical scrolling; without this the page scrolls instead.
      event.preventDefault();

      const now = Date.now();
      if (now < wheelLockedUntilRef.current) return;

      wheelAccumRef.current += event.deltaY;

      if (Math.abs(wheelAccumRef.current) < WHEEL_COMMIT_DELTA) return;

      const direction = wheelAccumRef.current > 0 ? 1 : -1;
      wheelAccumRef.current = 0;
      wheelLockedUntilRef.current = now + WHEEL_COOLDOWN_MS;

      if (direction > 0) controls.next();
      else controls.previous();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [controls, features.wheel]);

  /* ------------------------------- Keyboard ------------------------------- */

  useEffect(() => {
    const container = containerRef.current;
    if (!container || features.keyboard === false) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Never hijack keys while the viewer is typing in an overlay input.
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      switch (event.key) {
        case 'ArrowDown':
        case 'PageDown':
          event.preventDefault();
          controls.next();
          break;
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          controls.previous();
          break;
        case ' ':
        case 'k':
          event.preventDefault();
          controls.togglePlay();
          break;
        case 'm':
          event.preventDefault();
          controls.toggleMuted();
          break;
        case 'Home':
          event.preventDefault();
          controls.goTo(0);
          break;
        case 'End':
          event.preventDefault();
          controls.goTo(slides.length - 1);
          break;
        default:
          break;
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [controls, features.keyboard, slides.length]);

  /* ------------------------------- Rendering ------------------------------ */

  const completedRef = useRef<Set<string>>(new Set());

  const handleReelEnded = useCallback(
    (slide: ReelSlide & { kind: 'content' }) => {
      if (!completedRef.current.has(slide.key)) {
        completedRef.current.add(slide.key);
        onReelComplete?.(slide.reel);
      }

      // With `loop` on, the element restarts itself and never fires `ended`;
      // this path only runs when looping is off.
      if (config.autoAdvance) controls.next();
    },
    [onReelComplete, config.autoAdvance, controls]
  );

  const handleShare = useCallback(
    (reel: Reel) => {
      onShare?.(reel);

      // Use the platform share sheet when the host has not handled it.
      if (!onShare && typeof navigator !== 'undefined' && navigator.share) {
        void navigator
          .share({ title: reel.author?.name, text: reel.caption, url: reel.cta?.url })
          .catch(() => {});
      }
    },
    [onShare]
  );

  const translate = -activeIndex * 100;

  return (
    <div
      ref={containerRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={labels.reelsFeed}
      tabIndex={0}
      className={cn(
        'fairu-reels relative overflow-hidden bg-black outline-none select-none',
        // Every slide is absolutely positioned, so the container has no intrinsic
        // height — it must always get one from somewhere or it collapses to 0.
        //
        // `portrait` derives it from the aspect ratio; `fill` takes it from a
        // sized parent via `h-full`. What `fill` deliberately does NOT emit is
        // `max-h-*`: tailwind-merge v2 cannot dedupe `max-h-none` against
        // `max-h-[100dvh]`, so a caller could not un-set that cap. `h-full` and
        // `w-full` are dedupable, so those stay overridable.
        layout === 'portrait'
          ? 'aspect-[9/16] max-h-[100dvh] w-full'
          : 'h-full w-full',
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: features.swipe === false ? 'auto' : 'none' }}
    >
      <div
        className="absolute inset-0 will-change-transform"
        style={{
          transform: `translate3d(0, calc(${translate}% + ${dragOffset}px), 0)`,
          transition: dragging ? 'none' : `transform ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      >
        {slides.map((slide) => {
          const mounted = mountedIndices.includes(slide.index);
          const isActive = slide.index === activeIndex;
          const distance = slide.index - activeIndex;

          // Off-screen slides must neither swallow taps nor hold focus.
          // `inert` covers focus and AT; `pointer-events` covers React 18, where
          // `inert` is passed through as a plain attribute.
          const inertProps = isActive
            ? {}
            : ({ inert: '' } as React.HTMLAttributes<HTMLDivElement>);

          return (
            <div
              key={slide.key}
              className={cn('absolute inset-x-0 h-full', !isActive && 'pointer-events-none')}
              style={{ top: `${slide.index * 100}%` }}
              aria-hidden={!isActive}
              {...inertProps}
            >
              {mounted &&
                (slide.kind === 'content' ? (
                  <ReelItem
                    reel={slide.reel}
                    interaction={
                      state.interactions[slide.reel.id] ?? {
                        liked: false,
                        saved: false,
                        following: false,
                        likeDelta: 0,
                      }
                    }
                    active={isActive}
                    playing={playing}
                    muted={muted}
                    shouldLoad
                    eager={distance >= 0 && distance <= preloadCount}
                    loop={config.loop ?? true}
                    features={features}
                    hls={config.hls}
                    onProgress={(time, duration) =>
                      isActive && onReelProgress?.(slide.reel, time, duration)
                    }
                    onEnded={() => isActive && handleReelEnded(slide)}
                    onError={onError}
                    onTogglePlay={controls.togglePlay}
                    onLike={() => controls.toggleLike(slide.reel.id)}
                    onSave={() => controls.toggleSave(slide.reel.id)}
                    onFollow={() => controls.toggleFollow(slide.reel.id)}
                    onComment={() => onComment?.(slide.reel)}
                    onShare={() => handleShare(slide.reel)}
                    onToggleMute={controls.toggleMuted}
                    onCtaClick={() => onCtaClick?.(slide.reel)}
                  />
                ) : (
                  <ReelAdSlide
                    slot={slide.slot}
                    slotState={state.adSlots[slide.slot.id]}
                    active={isActive}
                    playing={playing}
                    muted={muted}
                    shouldLoad={isActive || distance === 1}
                    hls={config.hls}
                    gated={isActive && advanceBlocked}
                    onAdStart={adPlayback.onAdStart}
                    onAdProgress={adPlayback.onAdProgress}
                    onAdComplete={adPlayback.onAdComplete}
                    onAdSkip={(ad, slot, atTime) => {
                      config.ads?.onAdSkip?.(ad, slot, atTime);
                      adPlayback.releaseGate();
                      controls.skipAd();
                    }}
                    onAdClick={config.ads?.onAdClick}
                    onAdError={adPlayback.onAdError}
                    onToggleMute={controls.toggleMuted}
                  />
                ))}

              {isActive && renderOverlay?.(slide, slide.index)}
            </div>
          );
        })}
      </div>

      {/* Slide counter. */}
      {features.counter && slides.length > 0 && (
        <div className="absolute right-3 top-3 z-30 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/90 backdrop-blur-sm">
          {activeIndex + 1} / {slides.length}
        </div>
      )}

      {/* Pointer navigation for desktop, where there is no swipe. */}
      {features.navArrows !== false && (
        <div className="pointer-events-none absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 md:flex">
          <button
            type="button"
            onClick={controls.previous}
            disabled={activeIndex === 0}
            aria-label={labels.previousReel}
            className={cn(
              'pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full',
              'bg-black/40 text-white backdrop-blur-sm transition-opacity hover:bg-black/60',
              activeIndex === 0 && 'opacity-30'
            )}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
          <button
            type="button"
            onClick={controls.next}
            disabled={activeIndex >= slides.length - 1 || advanceBlocked}
            aria-label={labels.nextReel}
            className={cn(
              'pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full',
              'bg-black/40 text-white backdrop-blur-sm transition-opacity hover:bg-black/60',
              (activeIndex >= slides.length - 1 || advanceBlocked) && 'opacity-30'
            )}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}

      {/* Tail spinner while the host fetches the next page. */}
      {state.loadingMore && activeIndex >= slides.length - 2 && (
        <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2">
          <span
            className="fp-animate-spin block h-5 w-5 rounded-full border-2 border-white/25 border-t-white"
            role="status"
            aria-label={labels.loadingMore}
          />
        </div>
      )}

      {slides.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/40">
          {labels.reelsFeed}
        </div>
      )}
    </div>
  );
}

export default ReelsPlayer;
