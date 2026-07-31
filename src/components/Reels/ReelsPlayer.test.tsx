import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReelsPlayer } from './ReelsPlayer';
import { parseVast } from '@/utils/vast/parseVast';
import { vastAdToReelAd } from '@/utils/vast/toReelAd';
import type { Reel, ReelAd } from '@/types/reels';

const reels = (count: number): Reel[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${i + 1}`,
    src: `https://cdn.example.com/r${i + 1}.mp4`,
    caption: `Reel ${i + 1}`,
    author: { name: `@author${i + 1}` },
    stats: { likes: 100 * (i + 1), comments: 10, shares: 5 },
  }));

const houseAd: ReelAd = {
  id: 'house-1',
  src: 'https://cdn.example.com/ad.mp4',
  duration: 10,
  skipOffset: 3,
  title: 'House ad',
  advertiser: 'Fairu',
  clickThroughUrl: 'https://example.com/landing',
};

/** Videos never actually play in jsdom, so `active` is asserted structurally. */
function mountedVideos(container: HTMLElement): HTMLVideoElement[] {
  return Array.from(container.querySelectorAll('video'));
}

describe('ReelsPlayer', () => {
  it('renders the feed region with an accessible label', () => {
    render(<ReelsPlayer reels={reels(3)} />);
    expect(screen.getByRole('region', { name: /short video feed/i })).toBeInTheDocument();
  });

  it('mounts only the active slide and its neighbours', () => {
    const { container } = render(<ReelsPlayer reels={reels(10)} config={{ windowSize: 1 }} />);

    // At index 0 the window is [0, 1] — there is no slide -1.
    expect(mountedVideos(container)).toHaveLength(2);
  });

  it('honours windowSize: 0 by mounting a single video', () => {
    const { container } = render(<ReelsPlayer reels={reels(10)} config={{ windowSize: 0 }} />);
    expect(mountedVideos(container)).toHaveLength(1);
  });

  it('starts muted, because no browser autoplays with sound', () => {
    const { container } = render(<ReelsPlayer reels={reels(3)} />);
    expect(mountedVideos(container)[0].muted).toBe(true);
  });

  it('advances with the ArrowDown key and reports the change', () => {
    const onReelChange = vi.fn();
    render(<ReelsPlayer reels={reels(5)} onReelChange={onReelChange} />);

    const region = screen.getByRole('region');
    onReelChange.mockClear();

    fireEvent.keyDown(region, { key: 'ArrowDown' });

    expect(onReelChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'r2' }), 1);
  });

  it('goes back with ArrowUp and stops at the first slide', () => {
    const onSlideChange = vi.fn();
    render(<ReelsPlayer reels={reels(4)} onSlideChange={onSlideChange} />);

    const region = screen.getByRole('region');
    fireEvent.keyDown(region, { key: 'ArrowDown' });
    fireEvent.keyDown(region, { key: 'ArrowUp' });
    fireEvent.keyDown(region, { key: 'ArrowUp' });

    // 0 → 1 → 0, and the extra ArrowUp is clamped.
    expect(onSlideChange).toHaveBeenLastCalledWith(expect.objectContaining({ index: 0 }), 0);
  });

  it('jumps to the ends with Home and End', () => {
    const onSlideChange = vi.fn();
    render(<ReelsPlayer reels={reels(6)} onSlideChange={onSlideChange} />);

    const region = screen.getByRole('region');
    fireEvent.keyDown(region, { key: 'End' });
    expect(onSlideChange).toHaveBeenLastCalledWith(expect.anything(), 5);

    fireEvent.keyDown(region, { key: 'Home' });
    expect(onSlideChange).toHaveBeenLastCalledWith(expect.anything(), 0);
  });

  it('toggles mute with the m key', () => {
    const onMuteChange = vi.fn();
    render(<ReelsPlayer reels={reels(2)} onMuteChange={onMuteChange} />);

    fireEvent.keyDown(screen.getByRole('region'), { key: 'm' });

    expect(onMuteChange).toHaveBeenCalledWith(false);
  });

  it('does not hijack keys while an overlay input has focus', () => {
    const onSlideChange = vi.fn();
    render(
      <ReelsPlayer
        reels={reels(4)}
        onSlideChange={onSlideChange}
        renderOverlay={() => <input aria-label="comment" />}
      />
    );

    onSlideChange.mockClear();
    fireEvent.keyDown(screen.getByLabelText('comment'), { key: 'ArrowDown' });

    expect(onSlideChange).not.toHaveBeenCalled();
  });

  it('reports likes and applies the local delta immediately', () => {
    const onLike = vi.fn();
    render(<ReelsPlayer reels={reels(2)} onLike={onLike} />);

    // 100 likes on r1 → formatted as "100".
    expect(screen.getByText('100')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^like$/i }));

    expect(onLike).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }), true);
    expect(screen.getByText('101')).toBeInTheDocument();
  });

  it('renders the caption and the author', () => {
    render(<ReelsPlayer reels={reels(1)} />);
    expect(screen.getByText('Reel 1')).toBeInTheDocument();
    expect(screen.getByText('@author1')).toBeInTheDocument();
  });

  it('can hide the whole action rail', () => {
    render(<ReelsPlayer reels={reels(1)} config={{ features: { actionRail: false } }} />);
    expect(screen.queryByRole('button', { name: /^like$/i })).not.toBeInTheDocument();
  });

  it('fires onLoadMore when the tail comes into range', async () => {
    const onLoadMore = vi.fn();
    render(
      <ReelsPlayer reels={reels(4)} config={{ loadMoreThreshold: 3 }} onLoadMore={onLoadMore} />
    );

    // 3 content reels remain ahead of index 0, which is at the threshold.
    await waitFor(() => expect(onLoadMore).toHaveBeenCalled());
  });

  it('does not fire onLoadMore while plenty of reels remain', () => {
    const onLoadMore = vi.fn();
    render(
      <ReelsPlayer reels={reels(20)} config={{ loadMoreThreshold: 3 }} onLoadMore={onLoadMore} />
    );
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('shows the counter when enabled', () => {
    render(<ReelsPlayer reels={reels(7)} config={{ features: { counter: true } }} />);
    expect(screen.getByText('1 / 7')).toBeInTheDocument();
  });
});

describe('ReelsPlayer — ad slides', () => {
  it('interleaves an ad slide at the configured position', () => {
    const onSlideChange = vi.fn();
    render(
      <ReelsPlayer
        reels={reels(6)}
        onSlideChange={onSlideChange}
        config={{
          features: { counter: true },
          ads: { enabled: true, frequency: 4, startAfter: 2, ads: [houseAd] },
        }}
      />
    );

    // 6 content + 1 ad slot after 2 reels = 7 slides.
    expect(screen.getByText('1 / 7')).toBeInTheDocument();
  });

  it('resolves a pre-supplied ad and renders its advertiser block', async () => {
    render(
      <ReelsPlayer
        reels={reels(4)}
        config={{ ads: { enabled: true, frequency: 4, startAfter: 1, ads: [houseAd] } }}
      />
    );

    const region = screen.getByRole('region');
    fireEvent.keyDown(region, { key: 'ArrowDown' }); // → the ad slide

    await waitFor(() => {
      expect(screen.getByText('House ad')).toBeInTheDocument();
    });
    expect(screen.getByText('Sponsored')).toBeInTheDocument();
  });

  it('shows a skip countdown, not a skip button, before skipOffset', async () => {
    render(
      <ReelsPlayer
        reels={reels(4)}
        config={{ ads: { enabled: true, frequency: 4, startAfter: 1, ads: [houseAd] } }}
      />
    );

    fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowDown' });

    await waitFor(() => expect(screen.getByText(/Skip in 3s/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /skip ad/i })).not.toBeInTheDocument();
  });

  it('renders no skip affordance at all for a non-skippable ad', async () => {
    render(
      <ReelsPlayer
        reels={reels(4)}
        config={{
          ads: {
            enabled: true,
            frequency: 4,
            startAfter: 1,
            ads: [{ ...houseAd, skipOffset: null }],
          },
        }}
      />
    );

    fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowDown' });

    await waitFor(() => expect(screen.getByText('House ad')).toBeInTheDocument());
    expect(screen.queryByText(/Skip in/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /skip ad/i })).not.toBeInTheDocument();
  });

  it('respects maxAdsPerSession by resolving the slot to empty', async () => {
    const onSlotEmpty = vi.fn();
    const onSlotFilled = vi.fn();

    render(
      <ReelsPlayer
        reels={reels(12)}
        config={{
          ads: {
            enabled: true,
            frequency: 2,
            startAfter: 1,
            maxAdsPerSession: 0,
            ads: [houseAd],
            onSlotEmpty,
            onSlotFilled,
          },
        }}
      />
    );

    await waitFor(() => expect(onSlotEmpty).toHaveBeenCalled());
    expect(onSlotFilled).not.toHaveBeenCalled();
  });

  it('reports a slot as empty when no inventory is configured', async () => {
    const onSlotEmpty = vi.fn();

    render(
      <ReelsPlayer
        reels={reels(6)}
        config={{ ads: { enabled: true, frequency: 3, startAfter: 1, onSlotEmpty } }}
      />
    );

    await waitFor(() => expect(onSlotEmpty).toHaveBeenCalled());
  });

  it('escapes an unfilled slot at the head of the feed', async () => {
    // `startAfter: 0` puts an ad slot at index 0. With no inventory it resolves
    // to `empty`, and the viewer must not be stranded there.
    const onSlideChange = vi.fn();

    render(
      <ReelsPlayer
        reels={reels(4)}
        onSlideChange={onSlideChange}
        config={{ ads: { enabled: true, frequency: 4, startAfter: 0 } }}
      />
    );

    // The feed should land on a content slide, not sit on the empty ad slot.
    await waitFor(() => {
      expect(onSlideChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: 'content' }),
        expect.any(Number)
      );
    });
  });

  it('escapes an unfilled slot reached while scrolling backwards', async () => {
    const onSlideChange = vi.fn();

    render(
      <ReelsPlayer
        reels={reels(4)}
        onSlideChange={onSlideChange}
        config={{ ads: { enabled: true, frequency: 4, startAfter: 0 } }}
      />
    );

    const region = screen.getByRole('region');

    // Move forward, then come back up over the empty head slot.
    fireEvent.keyDown(region, { key: 'ArrowDown' });
    fireEvent.keyDown(region, { key: 'ArrowDown' });
    fireEvent.keyDown(region, { key: 'ArrowUp' });
    fireEvent.keyDown(region, { key: 'ArrowUp' });
    fireEvent.keyDown(region, { key: 'ArrowUp' });

    await waitFor(() => {
      expect(onSlideChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: 'content' }),
        expect.any(Number)
      );
    });
  });

  it('adds no slides at all when ads are disabled', () => {
    render(
      <ReelsPlayer
        reels={reels(6)}
        config={{ features: { counter: true }, ads: { enabled: false, frequency: 2, ads: [houseAd] } }}
      />
    );
    expect(screen.getByText('1 / 6')).toBeInTheDocument();
  });

  it('plays an ad resolved from inline VAST XML', async () => {
    const vast = `<VAST version="4.2">
      <Ad id="inline-1"><InLine>
        <AdSystem>Test</AdSystem>
        <AdTitle>Inline VAST spot</AdTitle>
        <Advertiser>Acme</Advertiser>
        <Impression><![CDATA[https://tracking.invalid/imp]]></Impression>
        <Creatives><Creative><Linear skipoffset="00:00:02">
          <Duration>00:00:12</Duration>
          <VideoClicks><ClickThrough><![CDATA[https://example.com/x]]></ClickThrough></VideoClicks>
          <MediaFiles>
            <MediaFile type="video/mp4" bitrate="900" width="720" height="1280"><![CDATA[https://cdn.example.com/inline.mp4]]></MediaFile>
          </MediaFiles>
        </Linear></Creative></Creatives>
      </InLine></Ad>
    </VAST>`;

    // Pre-resolve so the test needs no network, exercising the same conversion
    // path the player uses internally.
    const ad = vastAdToReelAd(parseVast(vast).ads[0], {
      mediaFileOptions: { height: 1280, pixelRatio: 1, maxBitrate: Infinity },
    });

    render(
      <ReelsPlayer
        reels={reels(4)}
        config={{ ads: { enabled: true, frequency: 4, startAfter: 1, ads: [ad] } }}
      />
    );

    fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowDown' });

    await waitFor(() => expect(screen.getByText('Inline VAST spot')).toBeInTheDocument());
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
    expect(screen.getByText(/Skip in 2s/)).toBeInTheDocument();
  });

  it('places slots from a VMAP document', async () => {
    const vmap = `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
      <vmap:AdBreak timeOffset="position:3" breakType="linear" breakId="slot-a">
        <vmap:AdSource><vmap:AdTagURI><![CDATA[https://ads.invalid/tag]]></vmap:AdTagURI></vmap:AdSource>
      </vmap:AdBreak>
    </vmap:VMAP>`;

    render(
      <ReelsPlayer
        reels={reels(8)}
        config={{ features: { counter: true }, ads: { enabled: true, vmapXml: vmap } }}
      />
    );

    // 8 content + 1 linear break = 9 slides.
    await waitFor(() => expect(screen.getByText('1 / 9')).toBeInTheDocument());
  });
});

describe('ReelsPlayer — layout', () => {
  const feed = (container: HTMLElement) =>
    container.querySelector('.fairu-reels') as HTMLElement;

  it('owns its size in the default portrait layout', () => {
    const { container } = render(<ReelsPlayer reels={reels(2)} />);
    const cls = feed(container).className;

    expect(cls).toContain('aspect-[9/16]');
    expect(cls).toContain('max-h-[100dvh]');
    expect(cls).toContain('w-full');
  });

  // Every slide is absolutely positioned, so the container has no intrinsic
  // height. If it is ever emitted without something that gives it one, the whole
  // feed collapses to 0px and renders nothing — which is invisible to jsdom,
  // since it does no layout. Asserting on the class is the only guard available
  // here, so it is worth being explicit about.
  it.each([
    ['portrait' as const, 'aspect-[9/16]'],
    ['fill' as const, 'h-full'],
  ])('always emits a height source in %s layout', (layout, expected) => {
    const { container } = render(<ReelsPlayer reels={reels(2)} config={{ layout }} />);
    expect(feed(container).className).toContain(expected);
  });

  it('takes the parent box in fill layout, without a max-height cap', () => {
    const { container } = render(
      <ReelsPlayer reels={reels(2)} config={{ layout: 'fill' }} />
    );
    const cls = feed(container).className;

    expect(cls).toContain('h-full');
    expect(cls).toContain('w-full');
    // No aspect ratio and no height cap, so a sized parent fully governs it.
    expect(cls).not.toContain('aspect-');
    expect(cls).not.toContain('max-h-');
  });

  it('lets the host override the height in fill layout', () => {
    const { container } = render(
      <ReelsPlayer reels={reels(2)} config={{ layout: 'fill' }} className="h-dvh w-screen" />
    );
    const cls = feed(container).className;

    // `h-*` and `w-*` are dedupable groups, unlike `max-h-*`.
    expect(cls).toContain('h-dvh');
    expect(cls).toContain('w-screen');
    expect(cls).not.toContain('h-full');
    expect(cls).not.toContain('w-full');
  });

  it('still overrides the aspect ratio in portrait layout', () => {
    const { container } = render(
      <ReelsPlayer reels={reels(2)} config={{ layout: 'portrait' }} className="aspect-square" />
    );
    const cls = feed(container).className;

    // tailwind-merge does dedupe the aspect group, so this override works.
    expect(cls).toContain('aspect-square');
    expect(cls).not.toContain('aspect-[9/16]');
  });

  it('works identically with no frame — the feed renders and navigates', () => {
    const onSlideChange = vi.fn();
    render(
      <ReelsPlayer
        reels={reels(4)}
        config={{ layout: 'fill', features: { counter: true } }}
        onSlideChange={onSlideChange}
      />
    );

    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowDown' });
    expect(onSlideChange).toHaveBeenLastCalledWith(expect.anything(), 1);
  });
});

describe('ReelsPlayer — tap handling', () => {
  it('does not toggle playback of the next slide when a tap is followed by a swipe', async () => {
    vi.useFakeTimers();

    try {
      const { container, unmount } = render(
        <ReelsPlayer reels={reels(4)} config={{ windowSize: 0 }} />
      );

      const slide = container.querySelector('video')?.parentElement as HTMLElement;
      expect(slide).toBeTruthy();

      // Tap, then unmount before the single-tap timer resolves.
      fireEvent.click(slide);
      unmount();

      // If the timer survived the unmount it would fire here and call a
      // callback belonging to a torn-down tree.
      expect(() => {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ReelsPlayer — gestures', () => {
  it('advances on a drag that clears the threshold', () => {
    const onSlideChange = vi.fn();
    const { container } = render(
      <ReelsPlayer reels={reels(5)} onSlideChange={onSlideChange} config={{ swipeThreshold: 0.1 }} />
    );

    const region = container.querySelector('.fairu-reels') as HTMLElement;
    // jsdom reports clientHeight 0, so force a measurable height.
    Object.defineProperty(region, 'clientHeight', { configurable: true, value: 800 });

    onSlideChange.mockClear();

    act(() => {
      fireEvent.pointerDown(region, { pointerId: 1, clientY: 600, isPrimary: true });
      fireEvent.pointerMove(region, { pointerId: 1, clientY: 400 });
      fireEvent.pointerUp(region, { pointerId: 1, clientY: 400 });
    });

    expect(onSlideChange).toHaveBeenCalledWith(expect.anything(), 1);
  });

  it('does not advance on a drag below the threshold', () => {
    const onSlideChange = vi.fn();
    const { container } = render(
      <ReelsPlayer reels={reels(5)} onSlideChange={onSlideChange} config={{ swipeThreshold: 0.5 }} />
    );

    const region = container.querySelector('.fairu-reels') as HTMLElement;
    Object.defineProperty(region, 'clientHeight', { configurable: true, value: 800 });

    onSlideChange.mockClear();

    act(() => {
      fireEvent.pointerDown(region, { pointerId: 1, clientY: 600, isPrimary: true });
      fireEvent.pointerMove(region, { pointerId: 1, clientY: 560 });
      fireEvent.pointerUp(region, { pointerId: 1, clientY: 560 });
    });

    expect(onSlideChange).not.toHaveBeenCalled();
  });

  it('ignores swipes when the feature is off', () => {
    const onSlideChange = vi.fn();
    const { container } = render(
      <ReelsPlayer
        reels={reels(5)}
        onSlideChange={onSlideChange}
        config={{ features: { swipe: false } }}
      />
    );

    const region = container.querySelector('.fairu-reels') as HTMLElement;
    Object.defineProperty(region, 'clientHeight', { configurable: true, value: 800 });

    onSlideChange.mockClear();

    act(() => {
      fireEvent.pointerDown(region, { pointerId: 1, clientY: 700, isPrimary: true });
      fireEvent.pointerMove(region, { pointerId: 1, clientY: 100 });
      fireEvent.pointerUp(region, { pointerId: 1, clientY: 100 });
    });

    expect(onSlideChange).not.toHaveBeenCalled();
  });
});
