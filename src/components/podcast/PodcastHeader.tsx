import { cn } from '@/utils';
import { Rating } from '@/components/stats/Rating';
import type { PodcastHeaderProps } from '@/types/podcast';

/**
 * Podcast header with cover art, title, description, and rating
 */
export function PodcastHeader({
  podcast,
  rating,
  onSubscribe,
  showSubscribe = true,
  className,
}: PodcastHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row gap-6', className)}>
      {/* Cover artwork with glow effect */}
      <div className="relative flex-shrink-0">
        {/* Glow effect */}
        <div
          className="absolute inset-0 blur-2xl opacity-30 rounded-xl"
          style={{
            backgroundImage: `url(${podcast.artwork})`,
            backgroundSize: 'cover',
            transform: 'translateY(12px) scale(0.85)',
          }}
        />
        <img
          src={podcast.artwork}
          alt={`${podcast.title} cover`}
          className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-xl object-cover shadow-xl"
        />
      </div>

      {/* Podcast info */}
      <div className="flex-1 min-w-0">
        {/* Categories */}
        {podcast.categories && podcast.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {podcast.categories.map((category) => (
              <span
                key={category}
                className="px-2 py-0.5 text-xs rounded-full bg-[var(--fp-color-primary)]/20 text-[var(--fp-color-primary)]"
              >
                {category}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--fp-color-text)] mb-2">
          {podcast.title}
        </h1>

        {/* Author */}
        <p className="text-lg text-[var(--fp-color-text-secondary)] mb-4">
          {podcast.author}
        </p>

        {/* Description */}
        <p className="text-sm text-[var(--fp-color-text-muted)] mb-4 line-clamp-3">
          {podcast.description}
        </p>

        {/* Actions row */}
        <div className="flex items-center gap-4">
          {/* Subscribe button */}
          {showSubscribe && onSubscribe && (
            <button
              type="button"
              onClick={onSubscribe}
              className={cn(
                'px-6 py-2 rounded-full font-medium text-sm',
                'bg-[var(--fp-color-primary)] text-white',
                'hover:bg-[var(--fp-color-primary)]/90 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-[var(--fp-color-primary)] focus:ring-offset-2 focus:ring-offset-[var(--fp-glass-bg)]'
              )}
            >
              Subscribe
            </button>
          )}

          {/* Rating */}
          {rating && (
            <Rating
              initialState={rating.initialState}
              onRateUp={rating.onRateUp}
              onRateDown={rating.onRateDown}
              onRatingChange={rating.onRatingChange}
              size="md"
            />
          )}
        </div>

        {/* Links */}
        {(podcast.websiteUrl || podcast.feedUrl) && (
          <div className="flex items-center gap-4 mt-4 text-sm">
            {podcast.websiteUrl && (
              <a
                href={podcast.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--fp-color-primary)] hover:underline"
              >
                Website
              </a>
            )}
            {podcast.feedUrl && (
              <a
                href={podcast.feedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--fp-color-primary)] hover:underline"
              >
                RSS Feed
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PodcastHeader;
