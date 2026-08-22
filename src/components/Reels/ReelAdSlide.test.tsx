/**
 * An ad rendered as a feed slide.
 *
 * The claims this component makes are measurement claims — an impression says a
 * human saw the creative, a quartile says they stayed. Getting them wrong is not
 * a rendering bug, it is over-reporting to an advertiser. So the tests assert on
 * the pixels that actually leave, not on component state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { ReelAdSlide } from './ReelAdSlide';
import type { ReelAd, ReelAdSlot, ReelAdSlotState } from '@/types/reels';

vi.mock('@/hooks/useHLS', () => ({
  useHLS: () => ({
    isHLS: false,
    isUsingHlsJs: false,
    hlsInstance: null,
    levels: [],
    currentLevel: -1,
  }),
}));

/** Every pixel the slide attempts to send. */
let beacons: string[];

beforeEach(() => {
  beacons = [];
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    sendBeacon: (url: string) => {
      beacons.push(url);
      return true;
    },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      beacons.push(String(url));
      return Promise.resolve({ ok: true } as Response);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const sent = (needle: string) => beacons.filter((url) => url.includes(needle)).length;

const AD: ReelAd = {
  id: 'ad-1',
  src: 'https://example.test/ad-1.mp4',
  duration: 15,
  skipOffset: 5,
  title: 'Ein Angebot',
  advertiser: 'Acme',
  clickThroughUrl: 'https://example.test/landing',
  clickTrackingUrls: ['https://track.test/click'],
  impressionUrls: ['https://track.test/impression'],
  errorUrls: ['https://track.test/error?code=[ERRORCODE]'],
  trackingEvents: {
    complete: ['https://track.test/complete'],
    skip: ['https://track.test/skip'],
    mute: ['https://track.test/mute'],
    unmute: ['https://track.test/unmute'],
  },
};

const SLOT: ReelAdSlot = { id: 'slot-1', afterContentCount: 4, source: { ad: AD } };

function slotState(ad: ReelAd = AD): ReelAdSlotState {
  return { status: 'filled', ads: [ad], podIndex: 0 };
}

type Props = Partial<React.ComponentProps<typeof ReelAdSlide>>;

function renderSlide(props: Props = {}) {
  const view = render(
    <ReelAdSlide
      slot={SLOT}
      slotState={slotState()}
      active
      playing
      muted
      shouldLoad
      {...props}
    />
  );

  const video = view.container.querySelector('video') as HTMLVideoElement;

  return {
    ...view,
    video,
    update(next: Props) {
      view.rerender(
        <ReelAdSlide
          slot={SLOT}
          slotState={slotState()}
          active
          playing
          muted
          shouldLoad
          {...props}
          {...next}
        />
      );
    },
  };
}

/** Move the ad playhead and let the component see it. */
function playTo(video: HTMLVideoElement, seconds: number, total = AD.duration) {
  act(() => {
    Object.defineProperty(video, 'currentTime', { value: seconds, configurable: true });
    Object.defineProperty(video, 'duration', { value: total, configurable: true });
    video.dispatchEvent(new Event('timeupdate'));
  });
}

describe('ReelAdSlide', () => {
  describe('the impression', () => {
    it('does not fire merely because the slide is prefetched', () => {
      renderSlide({ active: false });

      // Firing on prefetch is the single most common way a feed integration
      // over-reports: the neighbour slides all load before anyone sees them.
      expect(sent('impression')).toBe(0);
    });

    it('does not fire while the ad is loaded but not in view', () => {
      const { video } = renderSlide({ active: false });

      playTo(video, 3);

      expect(sent('impression')).toBe(0);
    });

    it('fires on the first frame the viewer sees', () => {
      const { video } = renderSlide();

      playTo(video, 0.2);

      expect(sent('impression')).toBe(1);
    });

    it('fires once, not once per timeupdate', () => {
      const { video } = renderSlide();

      playTo(video, 0.2);
      playTo(video, 1);
      playTo(video, 2);

      expect(sent('impression')).toBe(1);
    });

    it('announces the start to the host once', () => {
      const onAdStart = vi.fn();
      const { video } = renderSlide({ onAdStart });

      playTo(video, 0.2);
      playTo(video, 1);

      expect(onAdStart).toHaveBeenCalledTimes(1);
      expect(onAdStart).toHaveBeenCalledWith(AD, SLOT);
    });
  });

  describe('progress', () => {
    it('reports the playhead to the host', () => {
      const onAdProgress = vi.fn();
      const { video } = renderSlide({ onAdProgress });

      playTo(video, 4);

      expect(onAdProgress).toHaveBeenCalledWith(AD, 4, 15);
    });

    it('falls back to the declared duration when the element has none', () => {
      const onAdProgress = vi.fn();
      const { video } = renderSlide({ onAdProgress });

      playTo(video, 4, NaN);

      // A creative that never reports metadata still owes quartiles, and VAST
      // gives a duration for exactly this reason.
      expect(onAdProgress).toHaveBeenCalledWith(AD, 4, 15);
    });

    it('completes when the ad plays out', () => {
      const onAdComplete = vi.fn();
      const { video } = renderSlide({ onAdComplete });

      playTo(video, 15);
      act(() => {
        video.dispatchEvent(new Event('ended'));
      });

      expect(sent('complete')).toBe(1);
      expect(onAdComplete).toHaveBeenCalledWith(AD, SLOT);
    });

    it('does not complete for a slide nobody is watching', () => {
      const { video } = renderSlide({ active: false });

      act(() => {
        video.dispatchEvent(new Event('ended'));
      });

      expect(sent('complete')).toBe(0);
    });
  });

  describe('skipping', () => {
    it('renders no skip control for a non-skippable creative', () => {
      const { queryByText } = renderSlide({
        slotState: slotState({ ...AD, skipOffset: null }),
      });

      expect(queryByText(/skip/i)).not.toBeInTheDocument();
    });

    it('counts down before it unlocks', () => {
      const { video, getByText } = renderSlide();

      playTo(video, 2);

      // 5s offset, 2s played — three to go.
      expect(getByText('Skip in 3s')).toBeInTheDocument();
    });

    it('fires the skip pixel once the offset passes', () => {
      const onAdSkip = vi.fn();
      const { video, getByRole } = renderSlide({ onAdSkip });

      playTo(video, 6);
      fireEvent.click(getByRole('button', { name: /skip/i }));

      expect(sent('skip')).toBe(1);
      expect(onAdSkip).toHaveBeenCalledWith(AD, SLOT, 6);
    });
  });

  describe('the click-through', () => {
    it('fires its pixel and opens the landing page safely', () => {
      const open = vi.fn();
      vi.stubGlobal('open', open);
      const onAdClick = vi.fn();
      const { getByRole } = renderSlide({ onAdClick });

      fireEvent.click(getByRole('button', { name: /learn more/i }));

      expect(sent('click')).toBe(1);
      expect(onAdClick).toHaveBeenCalledWith(AD, SLOT);
      // Without noopener the landing page can reach back through window.opener
      // and navigate the player away.
      expect(open).toHaveBeenCalledWith(
        'https://example.test/landing',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('refuses a click-through that is not http', () => {
      const open = vi.fn();
      vi.stubGlobal('open', open);
      const { getByRole } = renderSlide({
        slotState: slotState({ ...AD, clickThroughUrl: 'javascript:alert(1)' }),
      });

      fireEvent.click(getByRole('button', { name: /learn more/i }));

      // The URL comes from a third-party VAST document.
      expect(open).not.toHaveBeenCalled();
    });
  });

  describe('failures', () => {
    it('sends an error pixel with the code filled in', () => {
      const onAdError = vi.fn();
      const { video } = renderSlide({ onAdError });

      act(() => {
        video.dispatchEvent(new Event('error'));
      });

      expect(beacons.some((url) => url.includes('track.test/error?code=405'))).toBe(true);
      expect(onAdError).toHaveBeenCalled();
    });

    it('rejects a media URL that is not http', () => {
      const onAdError = vi.fn();
      renderSlide({
        slotState: slotState({ ...AD, src: 'javascript:alert(1)' }),
        onAdError,
      });

      expect(onAdError).toHaveBeenCalled();
      expect(beacons.some((url) => url.includes('track.test/error?code=403'))).toBe(true);
    });
  });

  describe('audibility', () => {
    it('reports an unmute to the ad server', () => {
      const { update } = renderSlide({ muted: true });

      update({ muted: false });

      // Advertisers buy on audibility, so the state change is worth a pixel —
      // and VAST separates the two directions into distinct events.
      expect(sent('/unmute')).toBe(1);
    });

    it('reports a mute to the ad server', () => {
      const { update } = renderSlide({ muted: false });

      update({ muted: true });

      expect(sent('/mute')).toBe(1);
    });

    it('says nothing when the mute state has not moved', () => {
      const { update } = renderSlide({ muted: true });

      update({ muted: true });

      expect(sent('/mute')).toBe(0);
      expect(sent('/unmute')).toBe(0);
    });
  });

  describe('before the ad resolves', () => {
    it('shows a spinner while the slot is loading', () => {
      const { container } = renderSlide({
        slotState: { status: 'loading', ads: [], podIndex: 0 },
      });

      expect(container.querySelector('.fp-animate-spin')).toBeInTheDocument();
      expect(container.querySelector('video')).not.toBeInTheDocument();
    });
  });
});
