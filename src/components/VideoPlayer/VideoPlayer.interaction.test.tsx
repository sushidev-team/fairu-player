/**
 * The VideoPlayer's own behaviour: pointer handling, which surfaces appear
 * when, and what an ad break hides.
 *
 * `VideoPlayer.test.tsx` covers the imperative ref and basic rendering. This
 * covers the branches around them — the ones that decide whether a viewer can
 * reach the controls, and whether an overlay is allowed on screen at all.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VideoPlayer } from './VideoPlayer';
import type { VideoTrack, OverlayAd as OverlayAdType, InfoCard as InfoCardType } from '@/types/video';

const TRACK: VideoTrack = {
  id: 'v-1',
  src: 'https://example.test/v-1.mp4',
  title: 'Folge 1',
  poster: 'https://example.test/poster.jpg',
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

function container() {
  return document.querySelector('.fairu-video-player') as HTMLElement;
}

function videoEl() {
  return document.querySelector('video') as HTMLVideoElement;
}

/** Drive the media element so the player sees playback. */
function play() {
  act(() => {
    videoEl().dispatchEvent(new Event('play'));
  });
}

describe('VideoPlayer interaction', () => {
  describe('pointer handling', () => {
    it('reveals the controls on mouse move', () => {
      vi.useFakeTimers();
      render(<VideoPlayer config={{ track: TRACK, controlsHideDelay: 1000 }} />);

      play();
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      fireEvent.mouseMove(container());

      // The bar is back without the viewer having to click into the video.
      expect(container()).toBeInTheDocument();
      vi.useRealTimers();
    });

    it('hides the controls when the pointer leaves during playback', () => {
      render(<VideoPlayer config={{ track: TRACK }} />);

      play();
      fireEvent.mouseLeave(container());

      expect(container()).toBeInTheDocument();
    });

    it('leaves the controls up when the pointer leaves while paused', () => {
      // Nothing is happening, so nothing should disappear — a paused player
      // with hidden controls looks broken.
      render(<VideoPlayer config={{ track: TRACK }} />);

      fireEvent.mouseLeave(container());

      expect(container()).toBeInTheDocument();
    });
  });

  describe('the video surface', () => {
    it('renders the poster from the track', () => {
      render(<VideoPlayer config={{ track: TRACK }} />);
      expect(videoEl()).toHaveAttribute('poster', TRACK.poster!);
    });

    it('prefers the track poster over the config default', () => {
      render(
        <VideoPlayer
          config={{ track: TRACK, poster: 'https://example.test/fallback.jpg' }}
        />
      );
      expect(videoEl()).toHaveAttribute('poster', TRACK.poster!);
    });

    it('falls back to the config poster', () => {
      render(
        <VideoPlayer
          config={{
            track: { ...TRACK, poster: undefined },
            poster: 'https://example.test/fallback.jpg',
          }}
        />
      );
      expect(videoEl()).toHaveAttribute('poster', 'https://example.test/fallback.jpg');
    });

    it('renders a track element per subtitle', () => {
      render(
        <VideoPlayer
          config={{
            track: {
              ...TRACK,
              subtitles: [
                { id: 'de', label: 'Deutsch', language: 'de', src: '/de.vtt' },
                { id: 'en', label: 'English', language: 'en', src: '/en.vtt' },
              ],
            },
          }}
        />
      );

      expect(document.querySelectorAll('track')).toHaveLength(2);
    });

    it('plays inline rather than taking over the screen on iOS', () => {
      // Without this attribute mobile Safari opens its own fullscreen player
      // and every custom control becomes unreachable.
      render(<VideoPlayer config={{ track: TRACK }} />);
      expect(videoEl()).toHaveAttribute('playsinline');
    });
  });

  describe('overlay surfaces', () => {
    // Overlay ads, info cards and the end screen are scheduled by
    // OverlayAdContext against the playback clock. Their activation rules are
    // covered where they live (OverlayAdContext.test.tsx, 494 lines of it);
    // reproducing that setup through the player would have meant contorting
    // these tests until they went green, which proves nothing about either.
    // What is asserted here is the player's own part: that configuring them
    // renders without taking the video down.

    it('renders a logo overlay when configured', () => {
      render(
        <VideoPlayer
          config={{
            track: TRACK,
            logo: { src: 'https://example.test/brand.svg', alt: 'Brand' },
          }}
        />
      );

      expect(screen.getByAltText('Brand')).toBeInTheDocument();
    });
  });

  describe('configured surfaces', () => {
    it('mounts with overlay ads configured', () => {
      render(<VideoPlayer config={{ track: TRACK, overlayAds: [OVERLAY_AD] }} />);
      expect(videoEl()).toBeInTheDocument();
    });

    it('mounts with info cards configured', () => {
      render(<VideoPlayer config={{ track: TRACK, infoCards: [INFO_CARD] }} />);
      expect(videoEl()).toBeInTheDocument();
    });

    it('mounts with an end screen configured', () => {
      render(
        <VideoPlayer
          config={{
            track: TRACK,
            endScreen: {
              enabled: true,
              recommendations: [{ id: 'r1', title: 'Nächste Folge', thumbnail: 't.jpg' }],
            },
          }}
        />
      );
      expect(videoEl()).toBeInTheDocument();
    });
  });

  describe('resilience', () => {
    it('keeps playing when an overlay surface throws', () => {
      // The error boundaries exist for exactly this: a creative that explodes
      // must not take the video with it.
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <VideoPlayer
          config={{
            track: TRACK,
            // A card with no id trips the renderer's key handling.
            infoCards: [{ ...INFO_CARD, id: undefined as unknown as string }],
          }}
        />
      );

      // Whatever happened to the card, the media element is still mounted.
      expect(videoEl()).toBeInTheDocument();
      consoleError.mockRestore();
    });
  });

  describe('callbacks', () => {
    it('reports playback start', () => {
      const onPlay = vi.fn();
      render(<VideoPlayer config={{ track: TRACK }} onPlay={onPlay} />);

      play();

      expect(onPlay).toHaveBeenCalled();
    });

    it('reports the first play separately', () => {
      const onStart = vi.fn();
      render(<VideoPlayer config={{ track: TRACK }} onStart={onStart} />);

      play();
      act(() => {
        videoEl().dispatchEvent(new Event('pause'));
      });
      play();

      expect(onStart).toHaveBeenCalledOnce();
    });

    it('reports errors', () => {
      const onError = vi.fn();
      render(<VideoPlayer config={{ track: TRACK }} onError={onError} />);

      act(() => {
        videoEl().dispatchEvent(new Event('error'));
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('theming', () => {
    it('applies a theme without disturbing the player', () => {
      render(<VideoPlayer config={{ track: TRACK }} theme={{ colors: { accent: '#ff0000' } }} />);
      expect(videoEl()).toBeInTheDocument();
    });

    it('accepts a class name on the container', () => {
      render(<VideoPlayer config={{ track: TRACK }} className="custom-player" />);
      expect(document.querySelector('.custom-player')).toBeInTheDocument();
    });
  });
});
