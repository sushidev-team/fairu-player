/**
 * The overlay a rewarded spot plays in.
 *
 * The one thing worth being strict about: closing is offered only once the
 * reward is earned. That is the deal the viewer accepted.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { RewardedAd } from './RewardedAd';
import type { RewardedAd as RewardedAdType } from '@/core/rewardedAd';

const AD: RewardedAdType = {
  id: 'r1',
  src: 'https://cdn.example.test/spot.mp4',
  duration: 30,
  title: 'Weiter ohne Wartezeit',
  rewardDescription: 'Schaltet die nächste Folge frei',
  clickThroughUrl: 'https://example.test/landing',
};

let onClose: Mock<() => void>;
let onClick: Mock<() => void>;

beforeEach(() => {
  onClose = vi.fn();
  onClick = vi.fn();
});

function mount(props: Partial<React.ComponentProps<typeof RewardedAd>> = {}) {
  return render(
    <RewardedAd
      ad={AD}
      remaining={12}
      percentage={40}
      earned={false}
      videoRef={createRef<HTMLVideoElement>()}
      onClose={onClose}
      onClick={onClick}
      {...props}
    />
  );
}

describe('RewardedAd', () => {
  it('announces itself as a dialog', () => {
    mount();

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Weiter ohne Wartezeit');
  });

  it('plays the spot', () => {
    const { container } = mount();

    expect(container.querySelector('video')).toHaveAttribute('src', AD.src);
  });

  describe('before the reward is earned', () => {
    it('shows the countdown and no way out', () => {
      mount({ remaining: 12 });

      expect(screen.getByText('12s to go')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    });

    it('announces the countdown politely', () => {
      mount();

      // Assertive would interrupt a screen reader every second.
      expect(screen.getByText('12s to go')).toHaveAttribute('aria-live', 'polite');
    });

    it('shows what is on offer', () => {
      mount();

      expect(screen.getByText('Schaltet die nächste Folge frei')).toBeInTheDocument();
    });
  });

  describe('once it is earned', () => {
    it('offers the way out', () => {
      mount({ earned: true, remaining: 0 });

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      expect(onClose).toHaveBeenCalled();
    });

    it('says so', () => {
      mount({ earned: true, remaining: 0 });

      expect(screen.getByText('Reward unlocked')).toBeInTheDocument();
    });
  });

  describe('when autoplay is refused', () => {
    it('offers a way to start the spot', () => {
      const onPlay = vi.fn();
      mount({ needsGesture: true, onPlay });

      fireEvent.click(screen.getByRole('button', { name: 'Play' }));

      // Without this the spot never starts, the reward is never earned, and the
      // close button — which only appears once it is — never arrives either.
      expect(onPlay).toHaveBeenCalled();
    });

    it('offers nothing once the reward is earned', () => {
      mount({ needsGesture: true, earned: true, remaining: 0 });

      expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    });
  });

  describe('progress', () => {
    it('reports how far along the spot is', () => {
      mount({ percentage: 40 });

      const bar = screen.getByRole('progressbar');
      expect(bar).toHaveAttribute('aria-valuenow', '40');
    });
  });

  describe('the click-through', () => {
    it('reports a click', () => {
      mount();

      fireEvent.click(screen.getByRole('button', { name: 'Learn more' }));

      expect(onClick).toHaveBeenCalled();
    });

    it('is absent without a destination', () => {
      mount({ ad: { ...AD, clickThroughUrl: undefined } });

      expect(screen.queryByRole('button', { name: 'Learn more' })).not.toBeInTheDocument();
    });
  });
});
