import { cn } from '@/utils/cn';
import { useLabels } from '@/context/LabelsContext';
import { formatStatNumber } from '@/types/stats';
import type { Reel, ReelInteraction, ReelsFeatures } from '@/types/reels';

export interface ReelActionRailProps {
  reel: Reel;
  interaction: ReelInteraction;
  features?: ReelsFeatures;
  muted: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onSave?: () => void;
  onToggleMute?: () => void;
  className?: string;
}

interface ActionButtonProps {
  label: string;
  count?: number;
  active?: boolean;
  activeClassName?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

function ActionButton({
  label,
  count,
  active,
  activeClassName = 'text-[#ff2d55]',
  onClick,
  children,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={(event) => {
        // The slide itself toggles play on click; rail buttons must not.
        event.stopPropagation();
        onClick?.();
      }}
      className="group flex flex-col items-center gap-1 outline-none"
    >
      <span
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full',
          'bg-black/25 backdrop-blur-sm transition-transform duration-150',
          'group-hover:bg-black/40 group-active:scale-90',
          'group-focus-visible:ring-2 group-focus-visible:ring-white',
          active ? activeClassName : 'text-white'
        )}
      >
        {children}
      </span>
      {count !== undefined && (
        <span className="text-[11px] font-semibold tabular-nums text-white drop-shadow">
          {formatStatNumber(Math.max(0, count))}
        </span>
      )}
    </button>
  );
}

/**
 * The vertical action rail on the right edge of a reel.
 *
 * Counts are rendered from `reel.stats` plus the local `likeDelta`, so a tap
 * updates instantly without waiting for the host to round-trip the mutation.
 */
export function ReelActionRail({
  reel,
  interaction,
  features = {},
  muted,
  onLike,
  onComment,
  onShare,
  onSave,
  onToggleMute,
  className,
}: ReelActionRailProps) {
  const labels = useLabels();
  const stats = reel.stats ?? {};

  return (
    <div
      className={cn(
        'absolute bottom-24 right-2 z-20 flex flex-col items-center gap-4',
        className
      )}
    >
      {features.like !== false && (
        <ActionButton
          label={interaction.liked ? labels.unlike : labels.like}
          count={stats.likes !== undefined ? stats.likes + interaction.likeDelta : undefined}
          active={interaction.liked}
          onClick={onLike}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={interaction.liked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l8.84 8.84 8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </ActionButton>
      )}

      {features.comment !== false && (
        <ActionButton label={labels.comment} count={stats.comments} onClick={onComment}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </ActionButton>
      )}

      {features.save !== false && (
        <ActionButton
          label={interaction.saved ? labels.unsave : labels.save}
          active={interaction.saved}
          activeClassName="text-[var(--fp-color-accent)]"
          onClick={onSave}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={interaction.saved ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </ActionButton>
      )}

      {features.share !== false && (
        <ActionButton label={labels.share} count={stats.shares} onClick={onShare}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </ActionButton>
      )}

      {features.muteToggle !== false && (
        <ActionButton
          label={muted ? labels.unmute : labels.mute}
          active={false}
          onClick={onToggleMute}
        >
          {muted ? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </ActionButton>
      )}

      {/* The audio disc doubles as the "sound" affordance and spins while playing. */}
      {reel.audio?.cover && (
        <span className="mt-1 h-11 w-11 overflow-hidden rounded-lg border-2 border-white/70 shadow-lg">
          <img
            src={reel.audio.cover}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </span>
      )}
    </div>
  );
}

export default ReelActionRail;
