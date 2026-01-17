import { cn } from '@/utils';
import { AdSkipButton } from '../AdSkipButton';
import type { AdState, AdControls } from '@/types/ads';

export interface AdOverlayProps {
  state: AdState;
  controls: Pick<AdControls, 'skipAd' | 'clickThrough'>;
  className?: string;
}

export function AdOverlay({ state, controls, className }: AdOverlayProps) {
  const {
    isPlayingAd,
    currentAd,
    adProgress,
    adDuration,
    canSkip,
    skipCountdown,
    adsRemaining,
  } = state;

  if (!isPlayingAd || !currentAd) {
    return null;
  }

  const progress = adDuration > 0 ? (adProgress / adDuration) * 100 : 0;
  const remainingTime = Math.max(0, Math.ceil(adDuration - adProgress));

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col',
        'bg-gradient-to-b from-black/90 via-black/70 to-black/90',
        'text-white z-50',
        'backdrop-blur-sm',
        className
      )}
      role="dialog"
      aria-label="Advertisement"
      aria-live="polite"
    >
      {/* Top bar with Ad badge and info */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 bg-[var(--fp-color-accent)] text-white text-[10px] font-bold rounded uppercase tracking-wider">
            Ad
          </span>
          {currentAd.title && (
            <span className="text-sm text-white/80 font-medium">
              {currentAd.title}
            </span>
          )}
        </div>
        {adsRemaining > 0 && (
          <span className="text-xs text-white/50">
            {adsRemaining + 1} ads
          </span>
        )}
      </div>

      {/* Center content - Big countdown timer */}
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center',
          currentAd.clickThroughUrl && 'cursor-pointer'
        )}
        onClick={currentAd.clickThroughUrl ? controls.clickThrough : undefined}
        role={currentAd.clickThroughUrl ? 'button' : undefined}
        tabIndex={currentAd.clickThroughUrl ? 0 : undefined}
        aria-label={currentAd.clickThroughUrl ? 'Click to learn more' : undefined}
        onKeyDown={(e) => {
          if (currentAd.clickThroughUrl && (e.key === 'Enter' || e.key === ' ')) {
            controls.clickThrough();
          }
        }}
      >
        {/* Big remaining time display */}
        <div className="text-center mb-4">
          <div className="text-6xl font-bold tabular-nums text-white/90">
            {remainingTime}
          </div>
          <div className="text-sm text-white/60 mt-1">
            seconds remaining
          </div>
        </div>

        {/* Click prompt */}
        {currentAd.clickThroughUrl && (
          <div className="flex items-center gap-2 text-white/60 hover:text-white/80 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="15,3 21,3 21,9" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round"/>
            </svg>
            <span className="text-sm">Click to learn more</span>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="px-4 py-4">
        {/* Progress bar */}
        <div className="mb-3">
          <div className="h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--fp-color-accent)] transition-all duration-200 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Skip button row */}
        <div className="flex items-center justify-end">
          <AdSkipButton
            canSkip={canSkip}
            countdown={skipCountdown}
            onClick={controls.skipAd}
          />
        </div>
      </div>
    </div>
  );
}
