import { cn } from '@/utils/cn';
import type { StatItem, StatsConfig } from '@/types/stats';

export interface StatsProps extends StatsConfig {
  /** Custom class name */
  className?: string;
}

/**
 * Single stat item display
 */
function StatItemDisplay({
  item,
  compact,
}: {
  item: StatItem;
  compact?: boolean;
}) {
  const content = (
    <div
      className={cn(
        'flex items-center gap-2',
        compact ? 'text-xs' : 'text-sm',
        item.onClick && 'cursor-pointer hover:opacity-80 transition-opacity'
      )}
      onClick={item.onClick}
      title={item.tooltip}
    >
      {item.icon && (
        <span className={cn('flex-shrink-0', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')}>
          {item.icon}
        </span>
      )}
      <span className="text-gray-400">{item.label}:</span>
      <span className="font-medium text-gray-200">{item.value}</span>
    </div>
  );

  if (item.href) {
    return (
      <a
        href={item.href}
        className="hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </a>
    );
  }

  return content;
}

/**
 * Stats display component - shows dynamic key-value stats
 */
export function Stats({
  items,
  layout = 'horizontal',
  columns = 2,
  showDividers = false,
  compact = false,
  className,
}: StatsProps) {
  // Filter out hidden items and sort by order
  const visibleItems = items
    .filter((item) => !item.hidden)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  if (visibleItems.length === 0) {
    return null;
  }

  const layoutClasses = {
    horizontal: 'flex flex-wrap items-center gap-4',
    vertical: 'flex flex-col gap-2',
    grid: `grid gap-3`,
  };

  const gridStyle = layout === 'grid' ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined;

  return (
    <div
      className={cn(layoutClasses[layout], className)}
      style={gridStyle}
    >
      {visibleItems.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            'flex items-center',
            showDividers && layout === 'horizontal' && index > 0 && 'pl-4 border-l border-gray-600'
          )}
        >
          <StatItemDisplay
            item={item}
            compact={compact}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Preset stat icons
 */
export const StatIcons = {
  plays: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  views: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  likes: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
    </svg>
  ),
  comments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  ),
  shares: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  ),
  downloads: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  duration: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  episodes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  subscribers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
};

export default Stats;
