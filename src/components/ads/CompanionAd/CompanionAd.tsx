import { useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import { sanitizeUrl } from '@/utils/security';
import { sendBeacon, substituteMacros, defaultMacroContext } from '@/utils/vast';
import type { Ad } from '@/types/ads';

/**
 * The parts of an ad this component reads.
 *
 * Structural rather than `Ad`, so the video player's `VideoAd` — a separate
 * type that also carries a companion — can use the same component instead of
 * growing a near-identical copy.
 */
export type CompanionCapableAd = Pick<Ad, 'id' | 'title' | 'companion'>;

export interface CompanionAdProps {
  /** The ad whose `companion` should be rendered. */
  ad: CompanionCapableAd;
  /**
   * Fallback artwork shown when the ad carries no companion — normally the
   * episode cover, so the slot never collapses mid-ad.
   */
  fallbackArtwork?: string;
  /** Alt text for the fallback. */
  fallbackAlt?: string;
  /** Called after the click pixels have been sent. */
  onClick?: (ad: CompanionCapableAd) => void;
  /** Rendered over the artwork, e.g. a skip control. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The `<Companion>` slot for an audio or video ad.
 *
 * In a podcast player this is the only visual the advertiser gets; beside a
 * video it is separately sold inventory that also survives a muted autoplay.
 * Either way it is worth getting right:
 *
 * - **`creativeView` fires on display, not on load.** The companion counts as
 *   seen when it is actually on screen; firing when the image object is created
 *   would over-report.
 * - **Click fires `CompanionClickTracking` *and* navigates**, with
 *   `noopener,noreferrer` so the landing page cannot reach the player.
 * - **A missing companion falls back to the episode artwork** rather than
 *   collapsing the layout for the length of the spot.
 */
export function CompanionAd({
  ad,
  fallbackArtwork,
  fallbackAlt,
  onClick,
  children,
  className,
}: CompanionAdProps) {
  const labels = useLabels();
  const companion = ad.companion;
  const [failed, setFailed] = useState(false);

  const imageUrl = !failed ? sanitizeUrl(companion?.imageUrl) : undefined;
  const showCompanion = Boolean(imageUrl);

  // Fire `creativeView` once, when the companion is genuinely displayed.
  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!showCompanion || !companion) return;
    if (viewedRef.current === ad.id) return;
    viewedRef.current = ad.id;

    const macros = defaultMacroContext();
    for (const url of companion.trackingEvents?.creativeView ?? []) {
      sendBeacon(substituteMacros(url, macros));
    }
  }, [showCompanion, companion, ad.id]);

  const handleClick = () => {
    if (!companion) return;

    const macros = defaultMacroContext();
    for (const url of companion.clickTrackingUrls ?? []) {
      sendBeacon(substituteMacros(url, macros));
    }

    onClick?.(ad);

    const target = sanitizeUrl(companion.clickUrl, ['http:', 'https:']);
    if (target && typeof window !== 'undefined') {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  };

  const artwork = showCompanion ? imageUrl : sanitizeUrl(fallbackArtwork);

  return (
    <div
      className={cn(
        'fp-companion-ad relative overflow-hidden rounded-lg',
        'bg-[var(--fp-color-surface)]',
        className
      )}
    >
      {artwork ? (
        <img
          src={artwork}
          alt={showCompanion ? (ad.title ?? labels.ad) : (fallbackAlt ?? '')}
          className="h-full w-full object-cover"
          // A broken companion must not leave a hole; fall through to artwork.
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-xs" style={{ color: 'var(--fp-color-text-muted)' }}>
            {labels.ad}
          </span>
        </div>
      )}

      {showCompanion && (
        <>
          <span className="absolute left-2 top-2 rounded bg-[var(--fp-color-accent)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
            {labels.ad}
          </span>

          {/* Only clickable when the companion declares a destination. */}
          {companion?.clickUrl && (
            <button
              type="button"
              onClick={handleClick}
              aria-label={ad.title ? `${labels.ad}: ${ad.title}` : labels.learnMore}
              className="absolute inset-0 cursor-pointer"
            />
          )}
        </>
      )}

      {children}
    </div>
  );
}

export default CompanionAd;
