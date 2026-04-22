import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdOverlay } from './AdOverlay';
import { createMockAd, createMockAdBreak } from '@/test/helpers';
import type { AdState, AdControls } from '@/types/ads';

function createMockAdState(overrides: Partial<AdState> = {}): AdState {
  return {
    isPlayingAd: true,
    currentAd: createMockAd(),
    currentAdBreak: createMockAdBreak(),
    adProgress: 5,
    adDuration: 15,
    canSkip: false,
    skipCountdown: 3,
    adsRemaining: 0,
    ...overrides,
  };
}

function createMockControls(overrides: Partial<Pick<AdControls, 'skipAd' | 'clickThrough'>> = {}) {
  return {
    skipAd: vi.fn(),
    clickThrough: vi.fn(),
    ...overrides,
  };
}

function renderAdOverlay(
  stateOverrides: Partial<AdState> = {},
  controlOverrides: Partial<Pick<AdControls, 'skipAd' | 'clickThrough'>> = {},
  className?: string
) {
  const state = createMockAdState(stateOverrides);
  const controls = createMockControls(controlOverrides);
  return render(
    <AdOverlay state={state} controls={controls} className={className} />
  );
}

describe('AdOverlay', () => {
  // ── Rendering ──────────────────────────────────────────────────────

  it('renders the ad overlay when isPlayingAd is true', () => {
    renderAdOverlay();
    expect(screen.getByRole('dialog', { name: 'Advertisement' })).toBeInTheDocument();
  });

  it('renders the "Ad" badge', () => {
    renderAdOverlay();
    expect(screen.getByText('Ad')).toBeInTheDocument();
  });

  it('does not render when isPlayingAd is false', () => {
    renderAdOverlay({ isPlayingAd: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not render when currentAd is null', () => {
    renderAdOverlay({ currentAd: null });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // ── Ad title ───────────────────────────────────────────────────────

  it('shows ad title when provided', () => {
    renderAdOverlay({
      currentAd: createMockAd({ title: 'My Great Ad' }),
    });
    expect(screen.getByText('My Great Ad')).toBeInTheDocument();
  });

  it('does not show title when not provided', () => {
    renderAdOverlay({
      currentAd: createMockAd({ title: undefined }),
    });
    expect(screen.queryByText('My Great Ad')).not.toBeInTheDocument();
  });

  // ── Remaining time display ─────────────────────────────────────────

  it('shows remaining time countdown', () => {
    renderAdOverlay({ adProgress: 5, adDuration: 15 });
    // remaining = ceil(15 - 5) = 10
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('seconds remaining')).toBeInTheDocument();
  });

  it('shows 0 remaining time when ad is complete', () => {
    renderAdOverlay({ adProgress: 15, adDuration: 15 });
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('calculates remaining correctly for partial progress', () => {
    renderAdOverlay({ adProgress: 12.3, adDuration: 15 });
    // remaining = ceil(15 - 12.3) = ceil(2.7) = 3
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  // ── Progress bar ───────────────────────────────────────────────────

  it('renders a progress bar', () => {
    const { container } = renderAdOverlay({ adProgress: 7.5, adDuration: 15 });
    const progressBar = container.querySelector('[style*="width"]');
    expect(progressBar).toBeTruthy();
    // 7.5 / 15 * 100 = 50%
    expect(progressBar?.getAttribute('style')).toContain('50%');
  });

  it('shows 0% progress when adDuration is 0', () => {
    const { container } = renderAdOverlay({ adProgress: 0, adDuration: 0 });
    const progressBar = container.querySelector('[style*="width"]');
    expect(progressBar?.getAttribute('style')).toContain('0%');
  });

  // ── Ads remaining ──────────────────────────────────────────────────

  it('shows ads remaining count when greater than 0', () => {
    renderAdOverlay({ adsRemaining: 2 });
    expect(screen.getByText('3 ads')).toBeInTheDocument(); // adsRemaining + 1
  });

  it('does not show ads remaining count when 0', () => {
    renderAdOverlay({ adsRemaining: 0 });
    expect(screen.queryByText(/ads$/)).not.toBeInTheDocument();
  });

  // ── Skip button ────────────────────────────────────────────────────

  it('renders AdSkipButton with skip countdown when canSkip is false', () => {
    renderAdOverlay({ canSkip: false, skipCountdown: 5 });
    expect(screen.getByText('Skip in 5s')).toBeInTheDocument();
  });

  it('renders "Skip Ad" button when canSkip is true', () => {
    renderAdOverlay({ canSkip: true });
    expect(screen.getByText('Skip Ad')).toBeInTheDocument();
  });

  it('calls controls.skipAd when skip button is clicked', () => {
    const skipAd = vi.fn();
    renderAdOverlay({ canSkip: true }, { skipAd });
    fireEvent.click(screen.getByText('Skip Ad'));
    expect(skipAd).toHaveBeenCalledTimes(1);
  });

  // ── Click through ──────────────────────────────────────────────────

  it('shows "Click to learn more" when ad has clickThroughUrl', () => {
    renderAdOverlay({
      currentAd: createMockAd({ clickThroughUrl: 'https://example.com' }),
    });
    expect(screen.getByText('Click to learn more')).toBeInTheDocument();
  });

  it('does not show click prompt when no clickThroughUrl', () => {
    renderAdOverlay({
      currentAd: createMockAd({ clickThroughUrl: undefined }),
    });
    expect(screen.queryByText('Click to learn more')).not.toBeInTheDocument();
  });

  it('calls controls.clickThrough when clickable area is clicked', () => {
    const clickThrough = vi.fn();
    renderAdOverlay(
      { currentAd: createMockAd({ clickThroughUrl: 'https://example.com' }) },
      { clickThrough }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Click to learn more' }));
    expect(clickThrough).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard Enter on clickable area', () => {
    const clickThrough = vi.fn();
    renderAdOverlay(
      { currentAd: createMockAd({ clickThroughUrl: 'https://example.com' }) },
      { clickThrough }
    );
    const clickArea = screen.getByRole('button', { name: 'Click to learn more' });
    fireEvent.keyDown(clickArea, { key: 'Enter' });
    expect(clickThrough).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard Space on clickable area', () => {
    const clickThrough = vi.fn();
    renderAdOverlay(
      { currentAd: createMockAd({ clickThroughUrl: 'https://example.com' }) },
      { clickThrough }
    );
    const clickArea = screen.getByRole('button', { name: 'Click to learn more' });
    fireEvent.keyDown(clickArea, { key: ' ' });
    expect(clickThrough).toHaveBeenCalledTimes(1);
  });

  // ── className ──────────────────────────────────────────────────────

  it('passes custom className', () => {
    renderAdOverlay({}, {}, 'my-ad-overlay');
    expect(screen.getByRole('dialog').className).toContain('my-ad-overlay');
  });

  // ── Accessibility ──────────────────────────────────────────────────

  it('has aria-live="polite" for screen readers', () => {
    renderAdOverlay();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-live', 'polite');
  });
});
