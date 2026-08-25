import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import { resolveLabels, type PlayerLabels } from '@/types/labels';
import { sanitizeUrl } from '@/utils/security';
import type { PauseAd as PauseAdType } from '@/core/pauseAd';

export interface PauseAdProps {
  ad: PauseAdType;
  onClick: () => void;
  onDismiss: () => void;
  labels?: PlayerLabels;
  className?: string;
}

/**
 * The banner shown over a paused player.
 *
 * Dismissible on purpose. A pause ad that cannot be closed covers the frame the
 * viewer paused *to look at*, which is the one thing it must not do.
 */
export function PauseAd({ ad, onClick, onDismiss, labels: labelsProp, className }: PauseAdProps) {
  const contextLabels = useLabels();
  const labels = resolveLabels(labelsProp ?? contextLabels);

  // The creative comes from an ad server; the scheme is checked before it
  // reaches an `<img>`.
  const image = sanitizeUrl(ad.imageUrl, ['http:', 'https:', 'data:', 'blob:']);
  if (!image) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6',
        className
      )}
    >
      <div className="relative max-h-full max-w-full">
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">
          {labels.pauseAd}
        </span>

        <button
          type="button"
          onClick={onDismiss}
          aria-label={labels.pauseAdClose}
          className={cn(
            'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full',
            'bg-black/60 text-white transition-colors hover:bg-black/80'
          )}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {ad.clickThroughUrl ? (
          <button
            type="button"
            onClick={onClick}
            className="block max-h-full max-w-full"
            aria-label={ad.altText ?? ad.title ?? labels.pauseAd}
          >
            <img src={image} alt={ad.altText ?? ''} className="max-h-full max-w-full rounded-lg" />
          </button>
        ) : (
          <img src={image} alt={ad.altText ?? ''} className="max-h-full max-w-full rounded-lg" />
        )}

        {(ad.title || ad.description) && (
          <div className="absolute inset-x-0 bottom-0 rounded-b-lg bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8 text-white">
            {ad.title && <p className="text-sm font-semibold">{ad.title}</p>}
            {ad.description && <p className="text-xs opacity-80">{ad.description}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
