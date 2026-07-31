import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AudioPlayer } from './AudioPlayer';
import type { Ad, AdBreak } from '@/types/ads';
import type { Track } from '@/types/player';

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
  vi.stubGlobal('open', vi.fn());
});

afterEach(() => vi.unstubAllGlobals());

const track: Track = {
  id: 'ep-1',
  src: 'https://cdn.example.com/episode.mp3',
  title: 'Folge 1',
  artist: 'Fairu Devcast',
  artwork: 'https://cdn.example.com/cover.jpg',
  duration: 1800,
};

const audioAd: Ad = {
  id: 'spot-1',
  src: 'https://cdn.example.com/spot.mp3',
  duration: 30,
  skipAfterSeconds: 5,
  title: 'Nordwind Kaffee',
  clickThroughUrl: 'https://nordwind.example.com',
  trackingUrls: {
    impression: ['https://t.example.com/imp-a', 'https://t.example.com/imp-b'],
    complete: 'https://t.example.com/complete',
  },
  companion: {
    imageUrl: 'https://cdn.example.com/companion.jpg',
    clickUrl: 'https://nordwind.example.com/promo',
    width: 640,
    height: 640,
    clickTrackingUrls: ['https://t.example.com/companion-click'],
    trackingEvents: { creativeView: ['https://t.example.com/companion-view'] },
  },
};

const preRoll: AdBreak = { id: 'pre', position: 'pre-roll', ads: [audioAd] };

const count = (needle: string) => beacons.filter((u) => u.includes(needle)).length;

/** The ad element is the second <audio> — the first belongs to the episode. */
const adAudio = (container: HTMLElement) => {
  const all = Array.from(container.querySelectorAll('audio'));
  return all[all.length - 1] as HTMLAudioElement;
};

describe('AudioPlayer', () => {
  it('renders without an ad config', () => {
    render(<AudioPlayer track={track} />);
    expect(screen.getByText('Folge 1')).toBeInTheDocument();
  });

  it('renders with an ad config and does not start an ad on load', () => {
    render(<AudioPlayer track={track} adConfig={{ enabled: true, adBreaks: [preRoll] }} />);

    expect(screen.getByText('Folge 1')).toBeInTheDocument();
    // A pre-roll must wait for the first play, not fire on mount.
    expect(count('/imp-')).toBe(0);
  });

  it('keeps the same audio element when adConfig.enabled toggles', () => {
    // Same regression as the video player: `enabled` flips while tags resolve,
    // and branching on it would remount the element and lose its source.
    const { container, rerender } = render(
      <AudioPlayer track={track} adConfig={{ enabled: false, adBreaks: [] }} />
    );
    const before = container.querySelector('audio');

    rerender(<AudioPlayer track={track} adConfig={{ enabled: true, adBreaks: [preRoll] }} />);

    expect(container.querySelector('audio')).toBe(before);
  });

  describe('when a pre-roll plays', () => {
    const startAd = () => {
      const utils = render(
        <AudioPlayer track={track} adConfig={{ enabled: true, adBreaks: [preRoll] }} />
      );
      const episode = utils.container.querySelector('audio') as HTMLAudioElement;

      // Simulate the listener pressing play.
      act(() => {
        episode.dispatchEvent(new Event('play'));
      });

      return utils;
    };

    it('fires every impression pixel once', async () => {
      startAd();
      await waitFor(() => expect(count('/imp-')).toBe(2));
    });

    it('shows the companion artwork with an AD badge', async () => {
      startAd();

      await waitFor(() => {
        const img = screen.getByAltText('Nordwind Kaffee') as HTMLImageElement;
        expect(img.src).toBe('https://cdn.example.com/companion.jpg');
      });
      expect(screen.getByText('AD')).toBeInTheDocument();
    });

    it('fires the companion creativeView pixel on display', async () => {
      startAd();
      await waitFor(() => expect(count('/companion-view')).toBe(1));
    });

    it('fires companion click tracking and opens the destination', async () => {
      startAd();
      await waitFor(() => expect(screen.getByAltText('Nordwind Kaffee')).toBeInTheDocument());

      const link = screen.getByRole('button', { name: /Nordwind/i });
      act(() => link.click());

      expect(count('/companion-click')).toBe(1);
      expect(window.open).toHaveBeenCalledWith(
        'https://nordwind.example.com/promo',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('substitutes macros in ad pixels', async () => {
      const withMacro: Ad = {
        ...audioAd,
        companion: undefined,
        trackingUrls: { impression: 'https://t.example.com/imp?cb=[CACHEBUSTING]' },
      };

      const { container } = render(
        <AudioPlayer
          track={track}
          adConfig={{
            enabled: true,
            adBreaks: [{ id: 'pre', position: 'pre-roll', ads: [withMacro] }],
          }}
        />
      );
      act(() => {
        (container.querySelector('audio') as HTMLAudioElement).dispatchEvent(new Event('play'));
      });

      await waitFor(() => expect(beacons.length).toBeGreaterThan(0));
      expect(beacons[0]).toMatch(/cb=\d{8}$/);
      expect(beacons[0]).not.toContain('[CACHEBUSTING]');
    });

    it('fires complete when the spot ends', async () => {
      const { container } = startAd();
      await waitFor(() => expect(count('/imp-')).toBe(2));

      const ad = adAudio(container);
      act(() => {
        ad.dispatchEvent(new Event('ended'));
      });

      await waitFor(() => expect(count('/complete')).toBe(1));
    });
  });

  it('falls back to the episode artwork when the ad has no companion', async () => {
    const noCompanion: Ad = { ...audioAd, companion: undefined };
    const { container } = render(
      <AudioPlayer
        track={track}
        adConfig={{
          enabled: true,
          adBreaks: [{ id: 'pre', position: 'pre-roll', ads: [noCompanion] }],
        }}
      />
    );
    act(() => {
      (container.querySelector('audio') as HTMLAudioElement).dispatchEvent(new Event('play'));
    });

    await waitFor(() => {
      // The slot keeps the cover rather than collapsing for the length of the
      // spot. Two images now carry that alt: the player's own artwork and the
      // companion fallback.
      const covers = screen.getAllByAltText('Folge 1') as HTMLImageElement[];
      expect(covers.length).toBeGreaterThan(1);
      expect(covers.every((i) => i.src === 'https://cdn.example.com/cover.jpg')).toBe(true);
    });
  });

  it('can hide the companion slot entirely', async () => {
    const { container } = render(
      <AudioPlayer
        track={track}
        showCompanion={false}
        adConfig={{ enabled: true, adBreaks: [preRoll] }}
      />
    );
    act(() => {
      (container.querySelector('audio') as HTMLAudioElement).dispatchEvent(new Event('play'));
    });

    await waitFor(() => expect(count('/imp-')).toBe(2));
    // Only the player's own artwork remains — no companion slot.
    expect(screen.queryByAltText('Nordwind Kaffee')).not.toBeInTheDocument();
    expect(screen.getAllByAltText('Folge 1')).toHaveLength(1);
  });

  it('triggers a mid-roll at its trigger time', async () => {
    const midRoll: AdBreak = {
      id: 'mid',
      position: 'mid-roll',
      triggerTime: 60,
      ads: [{ ...audioAd, id: 'mid-spot', companion: undefined }],
    };

    const { container } = render(
      <AudioPlayer track={track} adConfig={{ enabled: true, adBreaks: [midRoll] }} />
    );

    const episode = container.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(episode, 'duration', { configurable: true, value: 1800 });

    act(() => {
      episode.dispatchEvent(new Event('loadedmetadata'));
      episode.dispatchEvent(new Event('play'));
    });
    // Below the trigger: nothing yet.
    Object.defineProperty(episode, 'currentTime', { configurable: true, value: 30 });
    act(() => episode.dispatchEvent(new Event('timeupdate')));
    expect(count('/imp-')).toBe(0);

    // Past the trigger: the break starts.
    Object.defineProperty(episode, 'currentTime', { configurable: true, value: 61 });
    act(() => episode.dispatchEvent(new Event('timeupdate')));

    await waitFor(() => expect(count('/imp-')).toBe(2));
  });
});
