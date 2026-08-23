/**
 * Feed navigation that is not a swipe.
 *
 * `ReelsPlayer.test.tsx` covers the pointer gestures; the wheel, the keyboard,
 * the share sheet and the end-of-reel handling were all untested. They are the
 * paths a desktop viewer and a screen-reader user actually take, so "the feed
 * works" was only ever established for a finger on glass.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { ReelsPlayer } from './ReelsPlayer';
import type { Reel } from '@/types/reels';

const reels = (count: number): Reel[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${i + 1}`,
    src: `https://cdn.example.com/r${i + 1}.mp4`,
    caption: `Reel ${i + 1}`,
    author: { name: `@author${i + 1}` },
    cta: { label: 'Mehr', url: 'https://example.test/r' },
  }));

function mount(props: Partial<React.ComponentProps<typeof ReelsPlayer>> = {}) {
  const onSlideChange = vi.fn();
  const view = render(
    <ReelsPlayer reels={reels(5)} onSlideChange={onSlideChange} {...props} />
  );
  const region = view.container.querySelector('.fairu-reels') as HTMLElement;
  onSlideChange.mockClear();
  return { ...view, region, onSlideChange };
}

/** One wheel notch past the commit threshold. */
function wheel(region: HTMLElement, deltaY: number) {
  act(() => {
    fireEvent.wheel(region, { deltaY });
  });
}

function press(region: HTMLElement, key: string) {
  act(() => {
    fireEvent.keyDown(region, { key });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('ReelsPlayer navigation', () => {
  describe('the wheel', () => {
    it('advances once the accumulated delta commits', () => {
      const { region, onSlideChange } = mount();

      wheel(region, 60);

      expect(onSlideChange).toHaveBeenCalledWith(expect.anything(), 1);
    });

    it('ignores a nudge below the threshold', () => {
      const { region, onSlideChange } = mount();

      wheel(region, 10);

      // A trackpad reports dozens of tiny deltas per flick; committing on each
      // would fly through the feed.
      expect(onSlideChange).not.toHaveBeenCalled();
    });

    it('accumulates several nudges into one advance', () => {
      const { region, onSlideChange } = mount();

      wheel(region, 15);
      wheel(region, 15);
      wheel(region, 15);

      expect(onSlideChange).toHaveBeenCalledTimes(1);
    });

    it('goes back on an upward wheel', () => {
      const { region, onSlideChange } = mount({ initialIndex: 2 });

      wheel(region, -60);

      expect(onSlideChange).toHaveBeenCalledWith(expect.anything(), 1);
    });

    it('holds a cooldown so one flick moves one slide', () => {
      const { region, onSlideChange } = mount();

      wheel(region, 60);
      wheel(region, 60);
      wheel(region, 60);

      // The inertia tail of a single trackpad flick keeps firing for a few
      // hundred milliseconds after the finger has left.
      expect(onSlideChange).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the feature is off', () => {
      const { region, onSlideChange } = mount({ config: { features: { wheel: false } } });

      wheel(region, 200);

      expect(onSlideChange).not.toHaveBeenCalled();
    });
  });

  describe('the keyboard', () => {
    it('advances on ArrowDown and PageDown', () => {
      const { region, onSlideChange } = mount();

      press(region, 'ArrowDown');
      expect(onSlideChange).toHaveBeenCalledWith(expect.anything(), 1);

      press(region, 'PageDown');
      expect(onSlideChange).toHaveBeenCalledWith(expect.anything(), 2);
    });

    it('goes back on ArrowUp and PageUp', () => {
      const { region, onSlideChange } = mount({ initialIndex: 3 });

      press(region, 'ArrowUp');
      expect(onSlideChange).toHaveBeenCalledWith(expect.anything(), 2);

      press(region, 'PageUp');
      expect(onSlideChange).toHaveBeenCalledWith(expect.anything(), 1);
    });

    it('jumps to the ends with Home and End', () => {
      const { region, onSlideChange } = mount({ initialIndex: 2 });

      press(region, 'End');
      expect(onSlideChange).toHaveBeenCalledWith(expect.anything(), 4);

      press(region, 'Home');
      expect(onSlideChange).toHaveBeenCalledWith(expect.anything(), 0);
    });

    it('toggles playback on space and k', () => {
      const { region, container } = mount();
      const video = container.querySelector('video') as HTMLVideoElement;

      const pause = vi.fn();
      Object.defineProperty(video, 'pause', { value: pause, configurable: true });
      press(region, ' ');
      expect(pause).toHaveBeenCalled();

      const play = vi.fn(() => Promise.resolve());
      Object.defineProperty(video, 'play', { value: play, configurable: true });
      press(region, 'k');
      expect(play).toHaveBeenCalled();
    });

    it('toggles mute on m', () => {
      const onMuteChange = vi.fn();
      const { region } = mount({ onMuteChange });

      press(region, 'm');

      expect(onMuteChange).toHaveBeenCalled();
    });

    it('keeps its hands off the keys while someone is typing', () => {
      const { region, onSlideChange } = mount();

      const input = document.createElement('input');
      region.appendChild(input);
      act(() => {
        fireEvent.keyDown(input, { key: 'ArrowDown' });
      });

      // A comment box inside the feed would otherwise be unusable: every space
      // would pause the reel instead of typing.
      expect(onSlideChange).not.toHaveBeenCalled();
    });

    it('does nothing when the feature is off', () => {
      const { region, onSlideChange } = mount({
        config: { features: { keyboard: false } },
      });

      press(region, 'ArrowDown');

      expect(onSlideChange).not.toHaveBeenCalled();
    });
  });

  describe('sharing', () => {
    it('hands the reel to the host when it wants it', () => {
      const onShare = vi.fn();
      const share = vi.fn(() => Promise.resolve());
      vi.stubGlobal('navigator', { ...globalThis.navigator, share });
      const { getByRole } = mount({ onShare });

      fireEvent.click(getByRole('button', { name: /share/i }));

      expect(onShare).toHaveBeenCalled();
      // The host took it, so the platform sheet must not also open.
      expect(share).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('falls back to the platform share sheet', () => {
      const share = vi.fn(() => Promise.resolve());
      vi.stubGlobal('navigator', { ...globalThis.navigator, share });
      const { getByRole } = mount();

      fireEvent.click(getByRole('button', { name: /share/i }));

      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.test/r' })
      );
      vi.unstubAllGlobals();
    });

    it('survives a share the viewer cancels', () => {
      const share = vi.fn(() => Promise.reject(new Error('AbortError')));
      vi.stubGlobal('navigator', { ...globalThis.navigator, share });
      const { getByRole } = mount();

      // Dismissing the sheet rejects, and an unhandled rejection here would
      // surface in a console the host page does not own.
      expect(() =>
        fireEvent.click(getByRole('button', { name: /share/i }))
      ).not.toThrow();
      vi.unstubAllGlobals();
    });
  });

  describe('the end of a reel', () => {
    function endActiveReel(container: HTMLElement) {
      const video = container.querySelector('video') as HTMLVideoElement;
      act(() => {
        video.dispatchEvent(new Event('ended'));
      });
      return video;
    }

    it('reports completion once', () => {
      const onReelComplete = vi.fn();
      const { container } = mount({ onReelComplete, config: { loop: false } });

      endActiveReel(container);
      endActiveReel(container);

      // A reel that ends twice — a replay, a re-render — is still one view.
      expect(onReelComplete).toHaveBeenCalledTimes(1);
    });

    it('advances when auto-advance is on', () => {
      const { container, onSlideChange } = mount({
        config: { loop: false, autoAdvance: true },
      });

      endActiveReel(container);

      expect(onSlideChange).toHaveBeenCalledWith(expect.anything(), 1);
    });

    it('stays put when auto-advance is off', () => {
      const { container, onSlideChange } = mount({
        config: { loop: false, autoAdvance: false },
      });

      endActiveReel(container);

      expect(onSlideChange).not.toHaveBeenCalled();
    });
  });
});
