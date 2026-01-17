import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/utils';
import { PlayerProvider } from '@/context/PlayerContext';
import { LabelsProvider } from '@/context/LabelsContext';
import { usePlayer } from '@/hooks/usePlayer';
import { Stats, StatIcons } from '@/components/stats/Stats';
import { PodcastHeader } from './PodcastHeader';
import { EpisodeList } from './EpisodeList';
import { StickyPlayer } from './StickyPlayer';
import type { PodcastPageProps, Episode, EpisodeSortOrder } from '@/types/podcast';
import type { StatItem } from '@/types/stats';
import type { Track } from '@/types/player';

/**
 * Default stats for a podcast
 */
function getDefaultStats(episodes: Episode[]): StatItem[] {
  const totalDuration = episodes.reduce((sum, ep) => sum + (ep.duration || 0), 0);
  const avgDuration = episodes.length > 0 ? Math.round(totalDuration / episodes.length) : 0;

  return [
    {
      id: 'episodes',
      label: 'Episodes',
      value: String(episodes.length),
      icon: StatIcons.episodes,
    },
    {
      id: 'avg-duration',
      label: 'Avg. Duration',
      value: `${Math.floor(avgDuration / 60)}:${String(avgDuration % 60).padStart(2, '0')}`,
      icon: StatIcons.duration,
    },
  ];
}

/**
 * Sort episodes by given order
 */
function sortEpisodes(episodes: Episode[], order: EpisodeSortOrder): Episode[] {
  return [...episodes].sort((a, b) => {
    if (order === 'newest' || order === 'oldest') {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return order === 'newest' ? dateB - dateA : dateA - dateB;
    }
    // 'popular' - could be based on plays/views if available, for now just return as-is
    return 0;
  });
}

/**
 * Inner podcast page content (uses player context)
 */
function PodcastPageInner({
  podcast,
  episodes,
  stats,
  rating,
  sortOrder: initialSortOrder = 'newest',
  stickyPlayer: showStickyPlayer = true,
  onEpisodeSelect,
  onSubscribe,
  onSortChange,
  className,
}: PodcastPageProps) {
  const { state, playlistState, controls } = usePlayer();
  const [sortOrder, setSortOrder] = useState<EpisodeSortOrder>(initialSortOrder);

  // Sort episodes
  const sortedEpisodes = useMemo(
    () => sortEpisodes(episodes, sortOrder),
    [episodes, sortOrder]
  );

  // Handle sort change
  const handleSortChange = useCallback((order: EpisodeSortOrder) => {
    setSortOrder(order);
    onSortChange?.(order);
  }, [onSortChange]);

  // Handle episode selection
  const handleEpisodeClick = useCallback((episode: Episode, _index: number) => {
    // Find the actual index in the sorted list
    const sortedIndex = sortedEpisodes.findIndex(e => e.id === episode.id);
    onEpisodeSelect?.(episode, sortedIndex);
  }, [sortedEpisodes, onEpisodeSelect]);

  // Merge provided stats with defaults
  const displayStats = stats || getDefaultStats(episodes);

  // Current episode
  const currentEpisode = playlistState.currentTrack as Episode | null;

  return (
    <div
      className={cn(
        'fairu-podcast-page min-h-screen',
        'bg-[var(--fp-glass-bg)]',
        showStickyPlayer && currentEpisode && 'pb-24', // Space for sticky player
        className
      )}
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <PodcastHeader
          podcast={podcast}
          rating={rating}
          onSubscribe={onSubscribe}
          showSubscribe={!!onSubscribe}
          className="mb-8"
        />

        {/* Stats */}
        {displayStats.length > 0 && (
          <div className="mb-8 p-4 rounded-xl bg-[var(--fp-color-surface)]/50 border border-[var(--fp-glass-border)]">
            <Stats
              items={displayStats}
              layout="horizontal"
              showDividers
            />
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-[var(--fp-glass-border)] my-8" />

        {/* Episode list */}
        <EpisodeList
          episodes={sortedEpisodes}
          currentIndex={playlistState.currentIndex}
          isPlaying={state.isPlaying}
          sortOrder={sortOrder}
          onEpisodeClick={handleEpisodeClick}
          onSortChange={handleSortChange}
        />
      </div>

      {/* Sticky player */}
      {showStickyPlayer && currentEpisode && (
        <StickyPlayer
          episode={currentEpisode}
          isPlaying={state.isPlaying}
          isLoading={state.isLoading}
          currentTime={state.currentTime}
          duration={state.duration}
          onTogglePlay={controls.toggle}
          onSeek={controls.seek}
        />
      )}
    </div>
  );
}

/**
 * Full podcast page component with episode list, stats, and player
 */
export function PodcastPage(props: PodcastPageProps) {
  const { episodes, autoPlay = false } = props;

  // Convert episodes to tracks for the player
  const tracks: Track[] = episodes.map(episode => ({
    id: episode.id,
    src: episode.src,
    title: episode.title,
    artist: episode.artist,
    artwork: episode.artwork,
    duration: episode.duration,
    chapters: episode.chapters,
  }));

  return (
    <LabelsProvider>
      <PlayerProvider
        config={{
          playlist: tracks,
          autoPlay,
          features: {
            chapters: true,
            playlistView: false, // We use our own episode list
          },
        }}
      >
        <PodcastPageInner {...props} />
      </PlayerProvider>
    </LabelsProvider>
  );
}

/**
 * PodcastPage without built-in providers (for use with external player state)
 */
export function PodcastPageContent(props: PodcastPageProps) {
  return <PodcastPageInner {...props} />;
}

export default PodcastPage;
