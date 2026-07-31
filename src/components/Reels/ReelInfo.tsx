import { useState } from 'react';
import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import type { Reel, ReelInteraction, ReelsFeatures } from '@/types/reels';

export interface ReelInfoProps {
  reel: Reel;
  interaction: ReelInteraction;
  features?: ReelsFeatures;
  onFollow?: () => void;
  onCtaClick?: () => void;
  className?: string;
}

/** Caption length before the "more" toggle appears. */
const CAPTION_CLAMP = 90;

/**
 * The bottom-left information block: author, caption and audio credit.
 *
 * Sits inside a bottom gradient so white text stays legible over any frame —
 * a plain text shadow is not enough on bright footage.
 */
export function ReelInfo({
  reel,
  interaction,
  features = {},
  onFollow,
  onCtaClick,
  className,
}: ReelInfoProps) {
  const labels = useLabels();
  const [expanded, setExpanded] = useState(false);

  const caption = reel.caption ?? '';
  const needsClamp = caption.length > CAPTION_CLAMP;
  const visibleCaption = expanded || !needsClamp ? caption : `${caption.slice(0, CAPTION_CLAMP)}…`;

  const stop = (event: React.MouseEvent) => event.stopPropagation();

  return (
    <div
      className={cn(
        // Reserve room for the action rail so long captions never slide under it.
        'absolute bottom-0 left-0 right-16 z-20 px-3 pb-5 pt-16',
        'bg-gradient-to-t from-black/75 via-black/35 to-transparent',
        className
      )}
    >
      {reel.author && (
        <div className="mb-2 flex items-center gap-2">
          {reel.author.avatar && (
            <img
              src={reel.author.avatar}
              alt=""
              className="h-8 w-8 rounded-full border border-white/60 object-cover"
              loading="lazy"
            />
          )}
          <span className="flex items-center gap-1 text-sm font-semibold text-white drop-shadow">
            {reel.author.name}
            {reel.author.verified && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-[var(--fp-color-accent)]"
                aria-label="Verified"
                role="img"
              >
                <path d="M12 2l2.4 2.4 3.4-.5.5 3.4L21 9.6l-1.7 3 1.7 3-2.7 2.3-.5 3.4-3.4-.5L12 22l-2.4-2.2-3.4.5-.5-3.4L3 14.6l1.7-3L3 8.6l2.7-2.3.5-3.4 3.4.5z" />
                <path d="M10.6 15.2l-2.8-2.8 1.1-1.1 1.7 1.7 4-4 1.1 1.1z" fill="#fff" />
              </svg>
            )}
          </span>

          {features.follow !== false && (
            <button
              type="button"
              onClick={(event) => {
                stop(event);
                onFollow?.();
              }}
              className={cn(
                'ml-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors',
                interaction.following
                  ? 'border-white/40 text-white/70'
                  : 'border-white bg-white/10 text-white hover:bg-white/20'
              )}
            >
              {interaction.following ? labels.following : labels.follow}
            </button>
          )}
        </div>
      )}

      {features.caption !== false && caption && (
        <p className="mb-2 max-w-full text-[13px] leading-snug text-white drop-shadow">
          {visibleCaption}
          {needsClamp && (
            <button
              type="button"
              onClick={(event) => {
                stop(event);
                setExpanded((value) => !value);
              }}
              className="ml-1 font-semibold text-white/70 underline-offset-2 hover:underline"
            >
              {expanded ? labels.showLess : labels.showMore}
            </button>
          )}
        </p>
      )}

      {features.audioTicker !== false && (reel.audio?.title || reel.audio?.artist) && (
        <div className="flex items-center gap-1.5 text-[11px] text-white/85">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          {/* One long line that scrolls, mirroring the "original audio" ticker. */}
          <span className="fp-reel-ticker max-w-[60%] overflow-hidden whitespace-nowrap">
            {[reel.audio?.artist, reel.audio?.title].filter(Boolean).join(' · ')}
          </span>
        </div>
      )}

      {reel.cta && (
        <button
          type="button"
          onClick={(event) => {
            stop(event);
            onCtaClick?.();
          }}
          className={cn(
            'mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg',
            'bg-white/95 px-4 py-2 text-[13px] font-semibold text-black',
            'transition-colors hover:bg-white'
          )}
        >
          {reel.cta.label}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default ReelInfo;
