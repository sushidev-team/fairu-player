import { useContext } from 'react';
import { PlayerContext } from '@/context/PlayerContext';
import type { PlayerContextValue } from '@/types/player';

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);

  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }

  return context;
}
