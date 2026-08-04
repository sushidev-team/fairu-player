import { useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';
import { sanitizeUrl } from '@/utils/security';
import { sendBeacon } from '@/utils/vast';
import { useLabels } from '@/context/LabelsContext';
import type { VastIcon } from '@/types/vast';

export interface AdChoicesIconProps {
  /** `<Icons>` from the creative. The AdChoices entry is picked out. */
  icons?: VastIcon[];
  /**
   * Id of the ad the badge belongs to.
   *
   * Used to scope the once-only view pixel. Two ads in a pod normally carry the
   * same badge URL and each owes its own `IconViewTracking`, so the URL alone
   * cannot be the dedupe key — and object identity cannot either, because a
   * parent re-render routinely produces a fresh ad object.
   */
  adId?: string;
  className?: string;
  /** Rendered size in pixels. VAST icons are typically 16×16. */
  size?: number;
}

/**
 * Pick the icon to render.
 *
 * `program="AdChoices"` is the conventional marker, but plenty of ad servers
 * ship the badge with no program at all, so any icon with a static resource is
 * accepted as a fallback. Icons the player cannot render — iframe and HTML
 * resources — are skipped rather than shown as a broken image.
 */
export function selectAdChoicesIcon(icons: VastIcon[] | undefined): VastIcon | undefined {
  if (!icons?.length) return undefined;

  return (
    icons.find((icon) => icon.program?.toLowerCase() === 'adchoices' && icon.staticResource) ??
    icons.find((icon) => Boolean(icon.staticResource))
  );
}

/**
 * The AdChoices / privacy badge that a VAST creative declares in `<Icons>`.
 *
 * This is a compliance surface, not decoration: EU rules require advertising to
 * be identifiable, and ad networks require the badge contractually. A creative
 * that declares an icon which the player then drops is a breach on the
 * publisher's side, so the badge renders wherever an ad plays.
 *
 * `IconViewTracking` fires once when the badge is actually shown, and
 * `IconClickTracking` on interaction — both are separate from the ad's own
 * pixels and are what let a network verify the badge was served.
 */
export function AdChoicesIcon({ icons, adId, className, size = 16 }: AdChoicesIconProps) {
  const labels = useLabels();
  const icon = selectAdChoicesIcon(icons);
  const viewKey = icon ? `${adId ?? ''}|${icon.staticResource ?? ''}` : null;
  const viewFired = useRef<string | null>(null);

  useEffect(() => {
    if (!icon || !viewKey || viewFired.current === viewKey) return;
    viewFired.current = viewKey;
    for (const url of icon.viewTrackingUrls) sendBeacon(url);
  }, [icon, viewKey]);

  if (!icon?.staticResource) return null;

  const href = sanitizeUrl(icon.clickThroughUrl, ['http:', 'https:']);
  const src = sanitizeUrl(icon.staticResource, ['http:', 'https:']);
  if (!src) return null;

  const image = (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="h-full w-full object-contain"
    />
  );

  const shared = cn('block overflow-hidden rounded-sm bg-white/80', className);
  const style = { width: size, height: size };

  // Without a click-through there is nothing to navigate to, and a link that
  // goes nowhere is worse for a screen reader than a plain image.
  if (!href) {
    return (
      <span className={shared} style={style} aria-label={labels.ad}>
        {image}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        // The badge sits on top of player surfaces that treat a click as
        // play/pause or as an ad click-through; neither is what was meant.
        event.stopPropagation();
        for (const url of icon.clickTrackingUrls) sendBeacon(url);
      }}
      className={shared}
      style={style}
      aria-label={labels.learnMore}
    >
      {image}
    </a>
  );
}

export default AdChoicesIcon;
