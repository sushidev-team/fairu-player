import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePauseAd } from './usePauseAd';
import type { PauseAd } from '@/types/pauseAd';

const mockAd: PauseAd = {
  id: 'pause-ad-1',
  imageUrl: 'https://example.com/ad.jpg',
  clickThroughUrl: 'https://example.com/landing',
  title: 'Test Ad',
  altText: 'Test advertisement',
};

describe('usePauseAd', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not show ad initially', () => {
    const { result } = renderHook(() =>
      usePauseAd({ ad: mockAd, isPaused: false, isPlaying: false })
    );
    expect(result.current.state.isVisible).toBe(false);
    expect(result.current.state.currentAd).toBeNull();
  });

  it('should not show ad on initial pause (before any play)', () => {
    const { result } = renderHook(() =>
      usePauseAd({ ad: mockAd, isPaused: true, isPlaying: false })
    );
    expect(result.current.state.isVisible).toBe(false);
  });

  it('should show ad when paused after playing', () => {
    const onShow = vi.fn();
    const { result, rerender } = renderHook(
      (props) => usePauseAd(props),
      { initialProps: { ad: mockAd, isPaused: false, isPlaying: true, onShow } }
    );

    // Pause
    rerender({ ad: mockAd, isPaused: true, isPlaying: false, onShow });

    expect(result.current.state.isVisible).toBe(true);
    expect(result.current.state.currentAd).toEqual(mockAd);
    expect(onShow).toHaveBeenCalledWith(mockAd);
  });

  it('should hide ad when playback resumes', () => {
    const onHide = vi.fn();
    const { result, rerender } = renderHook(
      (props) => usePauseAd(props),
      { initialProps: { ad: mockAd, isPaused: false, isPlaying: true, onHide } }
    );

    // Pause
    rerender({ ad: mockAd, isPaused: true, isPlaying: false, onHide });
    expect(result.current.state.isVisible).toBe(true);

    // Resume
    rerender({ ad: mockAd, isPaused: false, isPlaying: true, onHide });
    expect(result.current.state.isVisible).toBe(false);
    expect(onHide).toHaveBeenCalledWith(mockAd);
  });

  it('should respect minPauseDuration', () => {
    const adWithDelay: PauseAd = { ...mockAd, minPauseDuration: 3 };
    const onShow = vi.fn();

    const { result, rerender } = renderHook(
      (props) => usePauseAd(props),
      { initialProps: { ad: adWithDelay, isPaused: false, isPlaying: true, onShow } }
    );

    // Pause
    rerender({ ad: adWithDelay, isPaused: true, isPlaying: false, onShow });

    // Not visible yet
    expect(result.current.state.isVisible).toBe(false);

    // Advance time
    act(() => { vi.advanceTimersByTime(3000); });

    expect(result.current.state.isVisible).toBe(true);
    expect(onShow).toHaveBeenCalled();
  });

  it('should not show ad when disabled', () => {
    const { result, rerender } = renderHook(
      (props) => usePauseAd(props),
      { initialProps: { ad: mockAd, isPaused: false, isPlaying: true, enabled: false } }
    );

    rerender({ ad: mockAd, isPaused: true, isPlaying: false, enabled: false });
    expect(result.current.state.isVisible).toBe(false);
  });

  it('should not show ad when no ad provided', () => {
    const { result, rerender } = renderHook(
      (props) => usePauseAd(props),
      { initialProps: { ad: undefined, isPaused: false, isPlaying: true } }
    );

    rerender({ ad: undefined, isPaused: true, isPlaying: false });
    expect(result.current.state.isVisible).toBe(false);
  });

  it('should dismiss ad manually', () => {
    const onHide = vi.fn();
    const { result, rerender } = renderHook(
      (props) => usePauseAd(props),
      { initialProps: { ad: mockAd, isPaused: false, isPlaying: true, onHide } }
    );

    rerender({ ad: mockAd, isPaused: true, isPlaying: false, onHide });
    expect(result.current.state.isVisible).toBe(true);

    act(() => { result.current.dismiss(); });
    expect(result.current.state.isVisible).toBe(false);
    expect(onHide).toHaveBeenCalled();
  });
});
