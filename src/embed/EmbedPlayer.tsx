import { PlayerProvider } from '@/context/PlayerContext';
import { TrackingProvider } from '@/context/TrackingContext';
import { Player } from '@/components/Player';
import type { EmbedConfig } from './parseConfig';

export interface EmbedPlayerProps {
  config: EmbedConfig;
}

export function EmbedPlayer({ config }: EmbedPlayerProps) {
  const { player, tracking, theme } = config;

  return (
    <div data-theme={theme} className="fairu-player-embed">
      <TrackingProvider config={tracking}>
        <PlayerProvider config={player}>
          <Player
            showChapters={player.features?.chapters !== false}
            showPlaylist={player.features?.playlistView !== false && (player.playlist?.length || 0) > 1}
          />
        </PlayerProvider>
      </TrackingProvider>
    </div>
  );
}
