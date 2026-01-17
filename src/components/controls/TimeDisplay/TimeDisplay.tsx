import { cn, formatTime } from '@/utils';
import { useLabels } from '@/context/LabelsContext';
import type { PlayerLabels } from '@/types/labels';

export interface TimeDisplayProps {
  currentTime: number;
  duration: number;
  showRemaining?: boolean;
  className?: string;
  labels?: Pick<PlayerLabels, 'timeSeparator'>;
}

export function TimeDisplay({
  currentTime,
  duration,
  showRemaining = false,
  className,
  labels: labelsProp,
}: TimeDisplayProps) {
  const contextLabels = useLabels();
  const labels = labelsProp ?? contextLabels;
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
      <span>{labels.timeSeparator}</span>
      <span>{showRemaining ? `-${formatTime(remaining)}` : formatTime(duration)}</span>
    </div>
  );
}
