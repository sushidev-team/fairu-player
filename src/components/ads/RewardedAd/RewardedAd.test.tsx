import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RewardedAdOverlay } from './RewardedAd';
import type { RewardedAd } from '@/types/rewardedAd';

const mockAd: RewardedAd = {
  id: 'test-rewarded',
  src: 'https://example.com/ad.mp4',
  duration: 30,
  title: 'Watch to unlock',
  rewardDescription: 'Watch to get premium',
  poster: 'https://example.com/poster.jpg',
  clickThroughUrl: 'https://example.com/landing',
};

describe('RewardedAdOverlay', () => {
  it('should render nothing when not visible', () => {
    const { container } = render(
      <RewardedAdOverlay ad={mockAd} visible={false} onReward={() => {}} onClose={() => {}} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('should render overlay when visible', () => {
    render(
      <RewardedAdOverlay ad={mockAd} visible={true} onReward={() => {}} onClose={() => {}} />
    );
    expect(screen.getByTestId('rewarded-ad')).toBeInTheDocument();
  });

  it('should show ad title', () => {
    render(
      <RewardedAdOverlay ad={mockAd} visible={true} onReward={() => {}} onClose={() => {}} />
    );
    expect(screen.getByText('Watch to unlock')).toBeInTheDocument();
  });

  it('should show AD badge', () => {
    render(
      <RewardedAdOverlay ad={mockAd} visible={true} onReward={() => {}} onClose={() => {}} />
    );
    expect(screen.getByText('AD')).toBeInTheDocument();
  });

  it('should show reward description', () => {
    render(
      <RewardedAdOverlay ad={mockAd} visible={true} onReward={() => {}} onClose={() => {}} />
    );
    expect(screen.getByTestId('rewarded-ad-description')).toBeInTheDocument();
    expect(screen.getByText('Watch to get premium')).toBeInTheDocument();
  });

  it('should show countdown', () => {
    render(
      <RewardedAdOverlay ad={mockAd} visible={true} onReward={() => {}} onClose={() => {}} />
    );
    expect(screen.getByTestId('rewarded-ad-countdown')).toBeInTheDocument();
  });

  it('should have a video element', () => {
    render(
      <RewardedAdOverlay ad={mockAd} visible={true} onReward={() => {}} onClose={() => {}} />
    );
    expect(screen.getByTestId('rewarded-ad-video')).toBeInTheDocument();
  });

  it('should have a progress bar', () => {
    render(
      <RewardedAdOverlay ad={mockAd} visible={true} onReward={() => {}} onClose={() => {}} />
    );
    expect(screen.getByTestId('rewarded-ad-progress')).toBeInTheDocument();
  });
});
