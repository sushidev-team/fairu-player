/**
 * The ad-aware VideoPlayer.
 *
 * `<VideoPlayer adConfig={…}>` renders a different tree than `<VideoPlayer>`
 * does: one that intercepts the first play for a pre-roll, suppresses every
 * overlay surface while a spot runs, and takes the keyboard away. None of it
 * was pinned anywhere — which is why `VideoPlayer.tsx` sat at 61 % while the
 * rest of the package was above 90.
 *
 * Everything here goes through the public `<VideoPlayer>` surface rather than
 * the inner components, because the routing (`adConfig ? … : …`) is itself part
 * of what can break.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VideoPlayer } from './VideoPlayer';
import type {
  CustomAdComponentProps,
  InfoCard as InfoCardType,
  OverlayAd as OverlayAdType,
  VideoAd,
  VideoAdBreak,
  VideoAdConfig,
  VideoTrack,
} from '@/types/video';

const TRACK: VideoTrack = {
  id: 'v-1',
  src: 'https://example.test/v-1.mp4',
  title: 'Folge 1',
};

const OVERLAY_AD: OverlayAdType = {
  id: 'ov-1',
  imageUrl: 'https://example.test/banner.png',
  clickThroughUrl: 'https://example.test/landing',
  displayAt: 0,
  duration: 3600,
};

const INFO_CARD: InfoCardType = {
  id: 'card-1',
  type: 'link',
  title: 'Mehr erfahren',
  displayAt: 0,
  duration: 3600,
};

function spot(id: string, extra: Partial<VideoAd> = {}): VideoAd {
  return { id, src: `https://example.test/${id}.mp4`, duration: 10, ...extra };
}

function adBreak(
  id: string,
  position: VideoAdBreak['position'],
  extra: Partial<VideoAdBreak> = {}
): VideoAdBreak {
  return { id, position, ads: [spot(`${id}-spot`)], ...extra };
}

// ── Reading the rendered player ──────────────────────────────────────────────

/** The main video is rendered first, the ad element second. */
const videos = () => Array.from(document.querySelectorAll('video'));
const mainVideo = () => videos()[0];
const adVideo = () => videos()[1];

/** The ad element is always mounted; only its display flips. */
const spotIsOnScreen = () => adVideo()?.style.display === 'block';

const bigPlayButton = () => screen.queryByRole('button', { name: 'Play video' });
const overlayAd = () => screen.queryByRole('button', { name: 'Sponsored content' });
const infoCardIcon = () => screen.queryByRole('button', { name: /info cards/i });

// ── Driving it ───────────────────────────────────────────────────────────────

/**
 * Replace an element's `play` with a spy.
 *
 * An own property shadows the prototype stub from `src/test/setup.ts`, which is
 * what makes the main video and the ad element separable — they otherwise share
 * one implementation and one call count.
 */
function watchPlay(element: HTMLMediaElement) {
  const spy = vi.fn(() => Promise.resolve());
  Object.defineProperty(element, 'play', { value: spy, configurable: true });
  return spy;
}

function fire(element: HTMLMediaElement, type: string) {
  act(() => {
    element.dispatchEvent(new Event(type));
  });
}

/** Give the main video a duration — several ad effects bail out without one. */
function loadMetadata(seconds: number) {
  act(() => {
    Object.defineProperty(mainVideo(), 'duration', { value: seconds, configurable: true });
    mainVideo().dispatchEvent(new Event('loadedmetadata'));
  });
}

function advanceTo(seconds: number) {
  act(() => {
    Object.defineProperty(mainVideo(), 'currentTime', {
      value: seconds,
      writable: true,
      configurable: true,
    });
    mainVideo().dispatchEvent(new Event('timeupdate'));
  });
}

/**
 * Render, then take the player out of its loading state.
 *
 * A loading player shows a spinner where the play button goes, so nothing here
 * is clickable until the media reports it can start — which is also the honest
 * order of events: no viewer can press play on a video that has not loaded.
 */
function mount(adConfig: VideoAdConfig, config: Record<string, unknown> = {}) {
  const result = render(<VideoPlayer config={{ track: TRACK, ...config }} adConfig={adConfig} />);
  loadMetadata(120);
  fire(mainVideo(), 'canplay');
  return result;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VideoPlayer with ads', () => {
  describe('pre-roll', () => {
    it('starts the spot instead of the video on the first play', () => {
      mount({ enabled: true, adBreaks: [adBreak('pre', 'pre-roll')] });
      const main = watchPlay(mainVideo());
      const ad = watchPlay(adVideo());

      fireEvent.click(bigPlayButton()!);

      // The whole point of a pre-roll: the viewer asked for the video and gets
      // the advert first.
      expect(ad).toHaveBeenCalled();
      expect(main).not.toHaveBeenCalled();
      expect(spotIsOnScreen()).toBe(true);
    });

    it('plays the video itself when no pre-roll is booked', () => {
      mount({ enabled: true, adBreaks: [adBreak('post', 'post-roll')] });
      const main = watchPlay(mainVideo());

      fireEvent.click(bigPlayButton()!);

      expect(main).toHaveBeenCalled();
      expect(spotIsOnScreen()).toBe(false);
    });

    it('resumes the main video once the spot ends', () => {
      mount({ enabled: true, adBreaks: [adBreak('pre', 'pre-roll')] });
      const main = watchPlay(mainVideo());

      fireEvent.click(bigPlayButton()!);
      fire(adVideo(), 'ended');

      expect(main).toHaveBeenCalled();
      expect(spotIsOnScreen()).toBe(false);
    });

    it('does not run the pre-roll a second time', () => {
      mount({ enabled: true, adBreaks: [adBreak('pre', 'pre-roll')] });

      fireEvent.click(bigPlayButton()!);
      fire(adVideo(), 'ended');

      const ad = watchPlay(adVideo());
      const main = watchPlay(mainVideo());
      fireEvent.click(bigPlayButton()!);

      // Pausing and resuming must not re-advertise. `hasPlayedPreRoll` is what
      // stops it, and it is a ref — nothing would re-render if it broke.
      expect(ad).not.toHaveBeenCalled();
      expect(main).toHaveBeenCalled();
    });
  });

  describe('while a spot runs', () => {
    function startSpot(config: Record<string, unknown> = {}) {
      mount({ enabled: true, adBreaks: [adBreak('pre', 'pre-roll')] }, config);
      fireEvent.click(bigPlayButton()!);
    }

    it('ignores a click on the video surface', () => {
      startSpot();
      const main = watchPlay(mainVideo());

      // The overlay is gone, so click the container the way a viewer would.
      fireEvent.click(document.querySelector('.fairu-video-player')!);

      expect(main).not.toHaveBeenCalled();
      expect(spotIsOnScreen()).toBe(true);
    });

    it('takes the big play button off screen', () => {
      startSpot();

      // A play button over a running advert invites a click that would either
      // do nothing or start the video underneath it.
      expect(bigPlayButton()).not.toBeInTheDocument();
    });

    it('suppresses overlay ads', () => {
      startSpot({ overlayAds: [OVERLAY_AD] });

      expect(overlayAd()).not.toBeInTheDocument();

      fire(adVideo(), 'ended');
      fire(mainVideo(), 'play');

      // …and lets them back afterwards, which is the half that a naive
      // `hidden` flag gets wrong.
      expect(overlayAd()).toBeInTheDocument();
    });

    it('suppresses the info-card icon', () => {
      startSpot({ infoCards: [INFO_CARD] });

      expect(infoCardIcon()).not.toBeInTheDocument();

      fire(adVideo(), 'ended');

      expect(infoCardIcon()).toBeInTheDocument();
    });

    it('ignores the keyboard', () => {
      startSpot();
      const main = watchPlay(mainVideo());

      fireEvent.keyDown(document, { key: ' ' });

      // Space during an advert must not start the content behind it.
      expect(main).not.toHaveBeenCalled();
    });

    it('answers the keyboard again once the spot is over', () => {
      startSpot();
      fire(adVideo(), 'ended');

      const main = watchPlay(mainVideo());
      fireEvent.keyDown(document, { key: ' ' });

      expect(main).toHaveBeenCalled();
    });
  });

  describe('switched off', () => {
    /*
      `enabled: false` with breaks still configured is what a host sends when a
      viewer has paid not to see ads, or when a region opts out. Every other
      consumer of `AdConfig` honours it — `AdService`, `useReelsFeed` and
      `reelsAdScheduler` all bail on `!enabled`.

      Note the second assertion in each case: switching ads off must not break
      playback. Suppressing the break without letting the video through would
      turn a disabled advert into a dead play button.
    */

    it('plays no pre-roll', () => {
      mount({ enabled: false, adBreaks: [adBreak('pre', 'pre-roll')] });
      const main = watchPlay(mainVideo());

      fireEvent.click(bigPlayButton()!);

      expect(spotIsOnScreen()).toBe(false);
      expect(main).toHaveBeenCalled();
    });

    it('plays no mid-roll', () => {
      mount({
        enabled: false,
        adBreaks: [adBreak('mid', 'mid-roll', { triggerTime: 30 })],
      });

      advanceTo(31);

      expect(spotIsOnScreen()).toBe(false);
    });

    it('plays no post-roll', () => {
      mount({ enabled: false, adBreaks: [adBreak('post', 'post-roll')] });

      fire(mainVideo(), 'ended');

      expect(spotIsOnScreen()).toBe(false);
    });
  });

  describe('the ad element', () => {
    it('is mounted but hidden while no spot runs', () => {
      mount({ enabled: true, adBreaks: [adBreak('pre', 'pre-roll')] });

      // Mounted up front on purpose: creating it at ad time would cost a load
      // and lose the autoplay gesture.
      expect(adVideo()).toBeInTheDocument();
      expect(adVideo().style.display).toBe('none');
    });
  });

  describe('mid-roll', () => {
    it('starts once its trigger time passes', () => {
      mount({
        enabled: true,
        adBreaks: [adBreak('mid', 'mid-roll', { triggerTime: 30 })],
      });
      loadMetadata(120);

      advanceTo(29);
      expect(spotIsOnScreen()).toBe(false);

      advanceTo(31);
      expect(spotIsOnScreen()).toBe(true);
    });

    it('does not start the same break twice', () => {
      mount({
        enabled: true,
        adBreaks: [adBreak('mid', 'mid-roll', { triggerTime: 30 })],
      });
      loadMetadata(120);

      advanceTo(31);
      fire(adVideo(), 'ended');

      const ad = watchPlay(adVideo());
      advanceTo(32);

      // `currentTime` is still past the trigger, so without the played-set this
      // would re-arm on every single timeupdate.
      expect(ad).not.toHaveBeenCalled();
      expect(spotIsOnScreen()).toBe(false);
    });
  });

  describe('post-roll', () => {
    it('starts when the video ends', () => {
      mount({ enabled: true, adBreaks: [adBreak('post', 'post-roll')] });
      loadMetadata(120);

      fire(mainVideo(), 'ended');

      expect(spotIsOnScreen()).toBe(true);
    });
  });

  describe('companion banner', () => {
    const withCompanion = (): VideoAdBreak => ({
      id: 'pre',
      position: 'pre-roll',
      ads: [
        spot('pre-spot', {
          title: 'Sponsor',
          companion: {
            imageUrl: 'https://example.test/companion.png',
            clickUrl: 'https://example.test/companion-landing',
            width: 300,
            height: 250,
          },
        }),
      ],
    });

    it('stays away unless it is asked for', () => {
      mount({ enabled: true, adBreaks: [withCompanion()] });
      fireEvent.click(bigPlayButton()!);

      // Off by default: adding an element below the player would silently
      // change the layout of every existing integration.
      expect(screen.queryByAltText('Sponsor')).not.toBeInTheDocument();
    });

    it('appears beside the spot when enabled', () => {
      mount({ enabled: true, showCompanion: true, adBreaks: [withCompanion()] });
      fireEvent.click(bigPlayButton()!);

      expect(screen.getByAltText('Sponsor')).toBeInTheDocument();
    });

    it('goes away with the spot', () => {
      mount({ enabled: true, showCompanion: true, adBreaks: [withCompanion()] });
      fireEvent.click(bigPlayButton()!);
      fire(adVideo(), 'ended');

      expect(screen.queryByAltText('Sponsor')).not.toBeInTheDocument();
    });
  });

  describe('component ads', () => {
    it('renders the component instead of the ad video', () => {
      const Sponsored = ({ ad }: CustomAdComponentProps) => (
        <div data-testid="component-ad">{ad.id}</div>
      );

      mount({
        enabled: true,
        adBreaks: [
          {
            id: 'pre',
            position: 'pre-roll',
            ads: [spot('house', { component: Sponsored })],
          },
        ],
      });

      fireEvent.click(bigPlayButton()!);

      expect(screen.getByTestId('component-ad')).toHaveTextContent('house');
    });
  });
});
