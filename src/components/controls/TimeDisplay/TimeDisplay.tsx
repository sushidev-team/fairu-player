import { cn, formatTime } from '@/utils';

export interface TimeDisplayProps {
  currentTime: number;
  duration: number;
  showRemaining?: boolean;
  className?: string;
}

export function TimeDisplay({
  currentTime,
  duration,
  showRemaining = false,
  className,
}: TimeDisplayProps) {
  const remaining = duration - currentTime;

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-sm tabular-nums',
        'text-[var(--fp-color-text-muted)]',
        className
      )}
      aria-label={`${formatTime(currentTime)} of ${formatTime(duration)}`}
    >
      <span>{formatTime(currentTime)}</span>
      <span>/</span>
      <span>{showRemaining ? `-${formatTime(remaining)}` : formatTime(duration)}</span>
    </div>
  );
}
