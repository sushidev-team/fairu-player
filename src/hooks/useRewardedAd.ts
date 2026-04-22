import { useState, useCallback, useRef } from 'react';
import type { RewardedAdState, UseRewardedAdOptions, UseRewardedAdReturn } from '@/types/rewardedAd';

const initialState: RewardedAdState = {
  isShowing: false,
  isPlaying: false,
  isRewarded: false,
  progress: 0,
  duration: 0,
  percentage: 0,
  currentAd: null,
};

export function useRewardedAd(options: UseRewardedAdOptions = {}): UseRewardedAdReturn {
  const { ad, onReward, onStart, onClose } = options;
  const [state, setState] = useState<RewardedAdState>(initialState);

  const callbacksRef = useRef({ onReward, onStart, onClose });
  callbacksRef.current = { onReward, onStart, onClose };

  const show = useCallback(() => {
    if (!ad) return;
    setState({
      isShowing: true,
      isPlaying: false,
      isRewarded: false,
      progress: 0,
      duration: ad.duration,
      percentage: 0,
      currentAd: ad,
    });
    callbacksRef.current.onStart?.(ad);
  }, [ad]);

  const close = useCallback(() => {
    const currentAd = state.currentAd;
    const wasRewarded = state.isRewarded;
    setState(initialState);
    if (currentAd) {
      callbacksRef.current.onClose?.(currentAd, wasRewarded);
    }
  }, [state.currentAd, state.isRewarded]);

  return {
    state,
    show,
    close,
    isAvailable: !!ad,
  };
}
