import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRewardedAd } from './useRewardedAd';
import type { RewardedAd } from '@/types/rewardedAd';

const mockAd: RewardedAd = {
  id: 'rewarded-1',
  src: 'https://example.com/ad.mp4',
  duration: 30,
  title: 'Watch to unlock',
  rewardDescription: 'Watch this ad to unlock premium content',
};

describe('useRewardedAd', () => {
  it('should start with initial state', () => {
    const { result } = renderHook(() => useRewardedAd({ ad: mockAd }));
    expect(result.current.state.isShowing).toBe(false);
    expect(result.current.state.isRewarded).toBe(false);
    expect(result.current.state.currentAd).toBeNull();
    expect(result.current.isAvailable).toBe(true);
  });

  it('should not be available when no ad provided', () => {
    const { result } = renderHook(() => useRewardedAd());
    expect(result.current.isAvailable).toBe(false);
  });

  it('should show ad when show() is called', () => {
    const onStart = vi.fn();
    const { result } = renderHook(() => useRewardedAd({ ad: mockAd, onStart }));

    act(() => { result.current.show(); });

    expect(result.current.state.isShowing).toBe(true);
    expect(result.current.state.currentAd).toEqual(mockAd);
    expect(result.current.state.duration).toBe(30);
    expect(onStart).toHaveBeenCalledWith(mockAd);
  });

  it('should not show when no ad', () => {
    const { result } = renderHook(() => useRewardedAd());

    act(() => { result.current.show(); });
    expect(result.current.state.isShowing).toBe(false);
  });

  it('should close and call onClose', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useRewardedAd({ ad: mockAd, onClose }));

    act(() => { result.current.show(); });
    act(() => { result.current.close(); });

    expect(result.current.state.isShowing).toBe(false);
    expect(onClose).toHaveBeenCalledWith(mockAd, false);
  });

  it('should reset state on close', () => {
    const { result } = renderHook(() => useRewardedAd({ ad: mockAd }));

    act(() => { result.current.show(); });
    expect(result.current.state.isShowing).toBe(true);

    act(() => { result.current.close(); });
    expect(result.current.state.isShowing).toBe(false);
    expect(result.current.state.currentAd).toBeNull();
    expect(result.current.state.progress).toBe(0);
  });
});
