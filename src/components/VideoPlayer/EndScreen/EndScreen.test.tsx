import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { EndScreen } from './EndScreen';
import { RecommendedCard } from './RecommendedCard';
import { AutoPlayCountdown } from './AutoPlayCountdown';
import type { EndScreenConfig, RecommendedVideo } from '@/types/video';

// ─── Helpers ────────────────────────────────────────────────────────

function createRecommendedVideo(overrides: Partial<RecommendedVideo> = {}): RecommendedVideo {
  return {
    id: 'rec-1',
    title: 'Recommended Video 1',
    thumbnail: 'https://example.com/thumb1.jpg',
    duration: 120,
    channel: 'Test Channel',
    channelAvatar: 'https://example.com/avatar.jpg',
    views: '1.2M views',
    ...overrides,
  };
}

function createEndScreenConfig(overrides: Partial<EndScreenConfig> = {}): EndScreenConfig {
  return {
    enabled: true,
    recommendations: [
      createRecommendedVideo({ id: 'rec-1', title: 'Video One' }),
      createRecommendedVideo({ id: 'rec-2', title: 'Video Two' }),
      createRecommendedVideo({ id: 'rec-3', title: 'Video Three' }),
    ],
    ...overrides,
  };
}

// ─── EndScreen ──────────────────────────────────────────────────────

describe('EndScreen', () => {
  it('renders nothing when not ended and not near end', () => {
    const { container } = render(
      <EndScreen
        config={createEndScreenConfig()}
        currentTime={50}
        duration={300}
        isEnded={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when not enabled', () => {
    const { container } = render(
      <EndScreen
        config={createEndScreenConfig({ enabled: false })}
        currentTime={300}
        duration={300}
        isEnded={true}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no recommendations', () => {
    const { container } = render(
      <EndScreen
        config={createEndScreenConfig({ recommendations: [] })}
        currentTime={300}
        duration={300}
        isEnded={true}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders when video has ended', () => {
    render(
      <EndScreen
        config={createEndScreenConfig()}
        currentTime={300}
        duration={300}
        isEnded={true}
      />
    );
    expect(screen.getByText('Recommended Videos')).toBeInTheDocument();
  });

  it('renders when near end (within showAt seconds)', () => {
    render(
      <EndScreen
        config={createEndScreenConfig({ showAt: 10 })}
        currentTime={292}
        duration={300}
        isEnded={false}
      />
    );
    expect(screen.getByText('Recommended Videos')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(
      <EndScreen
        config={createEndScreenConfig({ title: 'More Videos' })}
        currentTime={300}
        duration={300}
        isEnded={true}
      />
    );
    expect(screen.getByText('More Videos')).toBeInTheDocument();
  });

  it('renders replay button when showReplay is true and onReplay is provided', () => {
    const onReplay = vi.fn();
    render(
      <EndScreen
        config={createEndScreenConfig()}
        currentTime={300}
        duration={300}
        isEnded={true}
        onReplay={onReplay}
      />
    );
    expect(screen.getByText('Replay')).toBeInTheDocument();
  });

  it('calls onReplay when replay button is clicked', () => {
    const onReplay = vi.fn();
    render(
      <EndScreen
        config={createEndScreenConfig()}
        currentTime={300}
        duration={300}
        isEnded={true}
        onReplay={onReplay}
      />
    );
    fireEvent.click(screen.getByText('Replay'));
    expect(onReplay).toHaveBeenCalledTimes(1);
  });

  it('does not render replay button when showReplay is false', () => {
    render(
      <EndScreen
        config={createEndScreenConfig({ showReplay: false })}
        currentTime={300}
        duration={300}
        isEnded={true}
        onReplay={vi.fn()}
      />
    );
    expect(screen.queryByText('Replay')).not.toBeInTheDocument();
  });

  it('does not render replay button when onReplay is not provided', () => {
    render(
      <EndScreen
        config={createEndScreenConfig()}
        currentTime={300}
        duration={300}
        isEnded={true}
      />
    );
    expect(screen.queryByText('Replay')).not.toBeInTheDocument();
  });

  it('renders all recommendation cards in grid layout', () => {
    render(
      <EndScreen
        config={createEndScreenConfig({ layout: 'grid' })}
        currentTime={300}
        duration={300}
        isEnded={true}
      />
    );
    expect(screen.getByText('Video One')).toBeInTheDocument();
    expect(screen.getByText('Video Two')).toBeInTheDocument();
    expect(screen.getByText('Video Three')).toBeInTheDocument();
  });

  it('renders recommendations in carousel layout', () => {
    render(
      <EndScreen
        config={createEndScreenConfig({ layout: 'carousel' })}
        currentTime={300}
        duration={300}
        isEnded={true}
      />
    );
    expect(screen.getByText('Video One')).toBeInTheDocument();
    expect(screen.getByText('Video Two')).toBeInTheDocument();
  });

  it('limits displayed videos to columns * 2 in grid', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      createRecommendedVideo({ id: `rec-${i}`, title: `Video ${i}` })
    );
    render(
      <EndScreen
        config={createEndScreenConfig({ recommendations: many, columns: 2 })}
        currentTime={300}
        duration={300}
        isEnded={true}
      />
    );
    // columns=2, max = 4
    expect(screen.getByText('Video 0')).toBeInTheDocument();
    expect(screen.getByText('Video 3')).toBeInTheDocument();
    expect(screen.queryByText('Video 4')).not.toBeInTheDocument();
  });

  it('applies 2-column grid class', () => {
    const { container } = render(
      <EndScreen
        config={createEndScreenConfig({ columns: 2 })}
        currentTime={300}
        duration={300}
        isEnded={true}
      />
    );
    const grid = container.querySelector('.grid');
    expect(grid?.className).toContain('grid-cols-2');
  });

  it('applies 4-column grid class', () => {
    const { container } = render(
      <EndScreen
        config={createEndScreenConfig({ columns: 4 })}
        currentTime={300}
        duration={300}
        isEnded={true}
      />
    );
    const grid = container.querySelector('.grid');
    expect(grid?.className).toContain('md:grid-cols-4');
  });

  it('calls onVideoSelect and config.onVideoSelect when a card is clicked', () => {
    const onVideoSelect = vi.fn();
    const configOnVideoSelect = vi.fn();
    const config = createEndScreenConfig({ onVideoSelect: configOnVideoSelect });
    render(
      <EndScreen
        config={config}
        currentTime={300}
        duration={300}
        isEnded={true}
        onVideoSelect={onVideoSelect}
      />
    );
    fireEvent.click(screen.getByText('Video One'));
    expect(onVideoSelect).toHaveBeenCalledWith(config.recommendations[0]);
    expect(configOnVideoSelect).toHaveBeenCalledWith(config.recommendations[0]);
  });

  it('renders autoplay countdown when autoPlayNext is true and video ended', () => {
    render(
      <EndScreen
        config={createEndScreenConfig({ autoPlayNext: true, autoPlayDelay: 5 })}
        currentTime={300}
        duration={300}
        isEnded={true}
      />
    );
    // "Up next" appears in both badge and countdown area
    const upNextElements = screen.getAllByText('Up next');
    expect(upNextElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does not render autoplay countdown when video has not ended', () => {
    render(
      <EndScreen
        config={createEndScreenConfig({ autoPlayNext: true, showAt: 10 })}
        currentTime={292}
        duration={300}
        isEnded={false}
      />
    );
    // The autoplay countdown should not show (it only appears when isEnded=true).
    // However, the first card still shows an "Up next" badge.
    // The countdown-specific text is "Cancel" which should not appear.
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('hides autoplay countdown after cancel', () => {
    render(
      <EndScreen
        config={createEndScreenConfig({ autoPlayNext: true })}
        currentTime={300}
        duration={300}
        isEnded={true}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Up next')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EndScreen
        config={createEndScreenConfig()}
        currentTime={300}
        duration={300}
        isEnded={true}
        className="my-custom-end"
      />
    );
    expect(container.querySelector('.fairu-end-screen')?.className).toContain('my-custom-end');
  });

  it('marks first card as "up next" when autoPlayNext is enabled', () => {
    render(
      <EndScreen
        config={createEndScreenConfig({ autoPlayNext: true })}
        currentTime={300}
        duration={300}
        isEnded={true}
      />
    );
    // "Up next" appears both as badge on card and in the autoplay countdown
    const upNextElements = screen.getAllByText('Up next');
    expect(upNextElements.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── RecommendedCard ────────────────────────────────────────────────

describe('RecommendedCard', () => {
  it('renders video title', () => {
    const video = createRecommendedVideo({ title: 'My Great Video' });
    render(<RecommendedCard video={video} />);
    expect(screen.getByText('My Great Video')).toBeInTheDocument();
  });

  it('renders thumbnail image', () => {
    const video = createRecommendedVideo({ thumbnail: 'https://example.com/thumb.jpg' });
    render(<RecommendedCard video={video} />);
    const img = screen.getByAltText('Recommended Video 1');
    expect(img).toBeInTheDocument();
  });

  it('renders duration badge', () => {
    const video = createRecommendedVideo({ duration: 125 });
    render(<RecommendedCard video={video} />);
    // 125 seconds = 2:05
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('does not render duration badge when duration is undefined', () => {
    const video = createRecommendedVideo({ duration: undefined });
    render(<RecommendedCard video={video} />);
    expect(screen.queryByText(/^\d+:\d+$/)).not.toBeInTheDocument();
  });

  it('renders channel name', () => {
    const video = createRecommendedVideo({ channel: 'Cool Channel' });
    render(<RecommendedCard video={video} />);
    expect(screen.getByText('Cool Channel')).toBeInTheDocument();
  });

  it('renders channel avatar when provided', () => {
    const video = createRecommendedVideo({
      channelAvatar: 'https://example.com/avatar.jpg',
      channel: 'Cool Channel',
    });
    render(<RecommendedCard video={video} />);
    const avatarImg = screen.getByAltText('Cool Channel');
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg.getAttribute('src')).toBe('https://example.com/avatar.jpg');
  });

  it('does not render channel avatar when not provided', () => {
    const video = createRecommendedVideo({ channelAvatar: undefined, channel: 'Cool Channel' });
    render(<RecommendedCard video={video} />);
    expect(screen.queryByAltText('Cool Channel')).not.toBeInTheDocument();
  });

  it('renders views count', () => {
    const video = createRecommendedVideo({ views: '1.2M views' });
    render(<RecommendedCard video={video} />);
    expect(screen.getByText('1.2M views')).toBeInTheDocument();
  });

  it('does not render views when not provided', () => {
    const video = createRecommendedVideo({ views: undefined });
    render(<RecommendedCard video={video} />);
    expect(screen.queryByText(/views/)).not.toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    const video = createRecommendedVideo();
    render(<RecommendedCard video={video} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(video);
  });

  it('calls onSelect when Enter key is pressed', () => {
    const onSelect = vi.fn();
    const video = createRecommendedVideo();
    render(<RecommendedCard video={video} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(video);
  });

  it('opens external URL when video has url but no src', () => {
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    const video = createRecommendedVideo({ url: 'https://example.com/watch', src: undefined });
    render(<RecommendedCard video={video} />);
    fireEvent.click(screen.getByRole('button'));
    expect(windowOpen).toHaveBeenCalledWith('https://example.com/watch', '_blank');
    windowOpen.mockRestore();
  });

  it('does not open external URL when video has src', () => {
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    const video = createRecommendedVideo({ url: 'https://example.com/watch', src: 'https://example.com/video.mp4' });
    render(<RecommendedCard video={video} />);
    fireEvent.click(screen.getByRole('button'));
    expect(windowOpen).not.toHaveBeenCalled();
    windowOpen.mockRestore();
  });

  it('shows "Up next" badge when isUpNext is true', () => {
    const video = createRecommendedVideo();
    render(<RecommendedCard video={video} isUpNext={true} />);
    expect(screen.getByText('Up next')).toBeInTheDocument();
  });

  it('does not show "Up next" badge by default', () => {
    const video = createRecommendedVideo();
    render(<RecommendedCard video={video} />);
    expect(screen.queryByText('Up next')).not.toBeInTheDocument();
  });

  it('applies ring styling when isUpNext', () => {
    const video = createRecommendedVideo();
    const { container } = render(<RecommendedCard video={video} isUpNext={true} />);
    const card = container.querySelector('.fairu-recommended-card');
    expect(card?.className).toContain('ring-2');
  });

  it('applies custom className', () => {
    const video = createRecommendedVideo();
    const { container } = render(<RecommendedCard video={video} className="my-card" />);
    const card = container.querySelector('.fairu-recommended-card');
    expect(card?.className).toContain('my-card');
  });

  it('has tabIndex 0 for keyboard accessibility', () => {
    const video = createRecommendedVideo();
    render(<RecommendedCard video={video} />);
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '0');
  });

  it('renders without channel info', () => {
    const video = createRecommendedVideo({ channel: undefined, channelAvatar: undefined });
    render(<RecommendedCard video={video} />);
    expect(screen.getByText(video.title)).toBeInTheDocument();
  });
});

// ─── AutoPlayCountdown ─────────────────────────────────────────────

describe('AutoPlayCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders when active', () => {
    const video = createRecommendedVideo();
    render(<AutoPlayCountdown video={video} active={true} />);
    expect(screen.getByText('Up next')).toBeInTheDocument();
    expect(screen.getByText(video.title)).toBeInTheDocument();
  });

  it('renders nothing when not active', () => {
    const video = createRecommendedVideo();
    const { container } = render(<AutoPlayCountdown video={video} active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows countdown number', () => {
    const video = createRecommendedVideo();
    render(<AutoPlayCountdown video={video} active={true} duration={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('counts down every second', () => {
    const video = createRecommendedVideo();
    render(<AutoPlayCountdown video={video} active={true} duration={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('4')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls onComplete when countdown reaches 0', () => {
    const onComplete = vi.fn();
    const video = createRecommendedVideo();
    render(<AutoPlayCountdown video={video} active={true} duration={3} onComplete={onComplete} />);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(onComplete).toHaveBeenCalledWith(video);
  });

  it('shows cancel button when counting down', () => {
    const video = createRecommendedVideo();
    render(<AutoPlayCountdown video={video} active={true} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onCancel when cancel is clicked', () => {
    const onCancel = vi.fn();
    const video = createRecommendedVideo();
    render(<AutoPlayCountdown video={video} active={true} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('hides cancel button after cancelling', () => {
    const video = createRecommendedVideo();
    render(<AutoPlayCountdown video={video} active={true} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('shows "Autoplay paused" text after cancel', () => {
    const video = createRecommendedVideo();
    render(<AutoPlayCountdown video={video} active={true} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('Autoplay paused')).toBeInTheDocument();
  });

  it('shows "Play" button text when paused', () => {
    const video = createRecommendedVideo();
    render(<AutoPlayCountdown video={video} active={true} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('Play')).toBeInTheDocument();
  });

  it('shows "Play now" button when actively counting', () => {
    const video = createRecommendedVideo();
    render(<AutoPlayCountdown video={video} active={true} />);
    expect(screen.getByText('Play now')).toBeInTheDocument();
  });

  it('calls onComplete when "Play now" is clicked', () => {
    const onComplete = vi.fn();
    const video = createRecommendedVideo();
    render(<AutoPlayCountdown video={video} active={true} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Play now'));
    expect(onComplete).toHaveBeenCalledWith(video);
  });

  it('stops countdown after cancel', () => {
    const onComplete = vi.fn();
    const video = createRecommendedVideo();
    render(<AutoPlayCountdown video={video} active={true} duration={3} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Cancel'));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('renders channel name when provided', () => {
    const video = createRecommendedVideo({ channel: 'My Channel' });
    render(<AutoPlayCountdown video={video} active={true} />);
    expect(screen.getByText('My Channel')).toBeInTheDocument();
  });

  it('does not render channel name when not provided', () => {
    const video = createRecommendedVideo({ channel: undefined });
    render(<AutoPlayCountdown video={video} active={true} />);
    expect(screen.queryByText('Test Channel')).not.toBeInTheDocument();
  });

  it('renders thumbnail image', () => {
    const video = createRecommendedVideo({ thumbnail: 'https://example.com/thumb.jpg' });
    render(<AutoPlayCountdown video={video} active={true} />);
    const img = screen.getByAltText(video.title);
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('https://example.com/thumb.jpg');
  });

  it('applies custom className', () => {
    const video = createRecommendedVideo();
    const { container } = render(
      <AutoPlayCountdown video={video} active={true} className="my-countdown" />
    );
    expect(container.querySelector('.fairu-autoplay-countdown')?.className).toContain('my-countdown');
  });

  it('calls onComplete via play button when paused', () => {
    const onComplete = vi.fn();
    const video = createRecommendedVideo();
    render(<AutoPlayCountdown video={video} active={true} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Play'));
    expect(onComplete).toHaveBeenCalledWith(video);
  });
});
