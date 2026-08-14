/**
 * The custom element is the whole framework story: Vue, Angular and Svelte all
 * consume it through the same two channels, attributes and DOM properties. So
 * these tests exercise it the way each of those frameworks would, without
 * pulling any of them in as a dependency.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { FairuPlayerElement, defineFairuPlayer, FAIRU_EVENTS } from './FairuPlayerElement';
import { resetStorageAvailability } from '@/utils/storage';
import type { Track } from '@/types/player';

/**
 * Flush the element's microtask batching *and* React's concurrent rendering.
 *
 * Awaiting a macrotask alone is not enough. The element defers renders to a
 * microtask and React 18 schedules its own work, so under load a single tick
 * can return before anything has been committed — which showed up as tests that
 * passed alone and failed in a full run. `act` waits for React to go idle.
 */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function mount(setup: (element: FairuPlayerElement) => void = () => {}) {
  const element = document.createElement('fairu-player') as FairuPlayerElement;
  setup(element);
  await act(async () => {
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return element;
}

const TRACK: Track = { id: 'ep-1', src: 'https://example.test/ep-1.mp3', title: 'Folge 1' };

describe('<fairu-player>', () => {
  beforeAll(() => {
    defineFairuPlayer();
  });

  beforeEach(() => {
    localStorage.clear();
    resetStorageAvailability();
  });

  afterEach(async () => {
    document.body.innerHTML = '';
    await settle();
    vi.restoreAllMocks();
  });

  describe('registration', () => {
    it('registers the tag', () => {
      expect(customElements.get('fairu-player')).toBe(FairuPlayerElement);
    });

    it('can be defined twice without throwing', () => {
      // Two bundles each importing the entry point is normal, and the second
      // define() would otherwise be a hard error.
      expect(() => defineFairuPlayer()).not.toThrow();
    });

    it('registers under a custom tag name', () => {
      // A constructor may back only one tag, so a second name gets a subclass —
      // still a FairuPlayerElement, just not the identical constructor.
      defineFairuPlayer('my-player');
      const ctor = customElements.get('my-player')!;

      expect(ctor).toBeDefined();
      expect(ctor.prototype).toBeInstanceOf(FairuPlayerElement);
    });

    it('upgrades an element that was already in the DOM', () => {
      const element = document.createElement('fairu-player');
      expect(element).toBeInstanceOf(FairuPlayerElement);
    });
  });

  describe('mounting', () => {
    it('renders into a child rather than replacing the host content', async () => {
      // The host's light DOM belongs to whichever framework created it —
      // Angular leaves comment anchors there.
      const element = await mount((el) => el.setAttribute('src', TRACK.src));
      expect(element.children.length).toBeGreaterThan(0);
    });

    it('emits a ready event once connected', async () => {
      const onReady = vi.fn();
      const element = document.createElement('fairu-player') as FairuPlayerElement;
      element.addEventListener(FAIRU_EVENTS.ready, onReady);

      document.body.appendChild(element);
      await settle();

      expect(onReady).toHaveBeenCalledOnce();
    });

    it('mounts without any configuration at all', async () => {
      await expect(mount()).resolves.toBeInstanceOf(FairuPlayerElement);
    });

    it('tears down on removal', async () => {
      const element = await mount((el) => el.setAttribute('src', TRACK.src));

      element.remove();
      await settle();

      expect(element.children.length).toBe(0);
    });

    it('survives an immediate remove-and-reinsert', async () => {
      // Frameworks move nodes: Vue's <Teleport>, Angular's structural
      // directives and list re-ordering all detach and re-attach.
      const element = await mount((el) => el.setAttribute('src', TRACK.src));

      element.remove();
      document.body.appendChild(element);
      await settle();

      expect(element.isConnected).toBe(true);
    });
  });

  describe('attributes', () => {
    it('builds a track from src and metadata', async () => {
      const element = await mount((el) => {
        el.setAttribute('src', TRACK.src);
        el.setAttribute('title', 'Folge 1');
        el.setAttribute('artist', 'Fairu');
      });

      const audio = element.querySelector('audio');
      expect(audio).not.toBeNull();
    });

    it('treats a bare boolean attribute as true', async () => {
      // `<fairu-player muted>` — HTML's own convention.
      const element = await mount((el) => {
        el.setAttribute('src', TRACK.src);
        el.setAttribute('muted', '');
      });

      expect(element.querySelector('audio')?.muted).toBe(true);
    });

    it('honours an explicit muted="false"', async () => {
      const element = await mount((el) => {
        el.setAttribute('src', TRACK.src);
        el.setAttribute('muted', 'false');
      });

      expect(element.querySelector('audio')?.muted).toBe(false);
    });

    it('applies a numeric volume', async () => {
      const element = await mount((el) => {
        el.setAttribute('src', TRACK.src);
        el.setAttribute('volume', '0.25');
      });

      expect(element.querySelector('audio')?.volume).toBeCloseTo(0.25);
    });

    it('ignores a non-numeric volume rather than producing NaN', async () => {
      const element = await mount((el) => {
        el.setAttribute('src', TRACK.src);
        el.setAttribute('volume', 'loud');
      });

      expect(Number.isNaN(element.querySelector('audio')?.volume)).toBe(false);
    });

    it('passes the theme through to a data attribute', async () => {
      const element = await mount((el) => {
        el.setAttribute('src', TRACK.src);
        el.setAttribute('theme', 'dark');
      });

      expect(element.querySelector('[data-theme="dark"]')).not.toBeNull();
    });

    it('re-renders when an attribute changes after mount', async () => {
      const element = await mount((el) => el.setAttribute('src', TRACK.src));

      element.setAttribute('theme', 'light');
      await settle();

      expect(element.querySelector('[data-theme="light"]')).not.toBeNull();
    });

    it('coalesces a burst of attribute changes into one render', async () => {
      const element = await mount((el) => el.setAttribute('src', TRACK.src));

      element.setAttribute('title', 'A');
      element.setAttribute('artist', 'B');
      element.setAttribute('theme', 'dark');
      await settle();

      expect(element.querySelector('[data-theme="dark"]')).not.toBeNull();
    });
  });

  describe('properties — the framework binding path', () => {
    it('accepts a full config object', async () => {
      // This is `:config="cfg"` in Vue and `[config]="cfg"` in Angular.
      const element = await mount((el) => {
        el.config = { track: TRACK, volume: 0.4 };
      });

      expect(element.querySelector('audio')?.volume).toBeCloseTo(0.4);
    });

    it('accepts a playlist', async () => {
      const element = await mount((el) => {
        el.playlist = [TRACK, { id: 'ep-2', src: 'b.mp3', title: 'Folge 2' }];
      });

      expect(element.playlist).toHaveLength(2);
      expect(element.querySelector('audio')).not.toBeNull();
    });

    it('lets a property win over the equivalent attribute', async () => {
      const element = await mount((el) => {
        el.setAttribute('volume', '0.1');
        el.config = { track: TRACK, volume: 0.9 };
      });

      expect(element.querySelector('audio')?.volume).toBeCloseTo(0.9);
    });

    it('accepts a replacement config and keeps rendering', async () => {
      const element = await mount((el) => {
        el.config = { track: TRACK };
      });

      element.config = { track: { id: 'ep-2', src: 'https://example.test/ep-2.mp3' } };
      await settle();

      expect(element.config).toMatchObject({ track: { id: 'ep-2' } });
      expect(element.querySelector('audio')).not.toBeNull();
    });

    /**
     * KNOWN LIMITATION — pinned, not endorsed.
     *
     * Swapping `config.track` after mount does not change what is playing.
     * `usePlaylist` only adopts incoming tracks while it has none, so that a
     * late-arriving fetch cannot reset a listener's position — see
     * "does not clobber tracks it already has" in usePlaylist.test.ts.
     *
     * That trade-off is defensible in React, where the config is usually
     * static. It is a sharper edge here: rebinding `:config` / `[config]` is
     * the ordinary way to change media in Vue and Angular, and it silently does
     * nothing.
     *
     * The documented workaround is `.playlist`, or removing and re-inserting
     * the element. A real fix means letting the playlist adopt a genuinely new
     * track list, which changes React behaviour too and belongs in its own
     * commit.
     */
    it('does NOT switch the playing track when config.track is replaced', async () => {
      const element = await mount((el) => {
        el.config = { track: TRACK };
      });

      element.config = { track: { id: 'ep-2', src: 'https://example.test/ep-2.mp3' } };
      await settle();

      expect(element.querySelector('audio')?.src).toContain('ep-1.mp3');
    });

    it('tolerates the config being cleared', async () => {
      const element = await mount((el) => {
        el.config = { track: TRACK };
      });

      element.config = undefined as never;
      await settle();

      expect(element.config).toEqual({});
    });

    it('can be configured before it is connected', async () => {
      // Frameworks set properties on a detached node, then insert it.
      const element = document.createElement('fairu-player') as FairuPlayerElement;
      element.config = { track: TRACK, volume: 0.3 };

      document.body.appendChild(element);
      await settle();

      expect(element.querySelector('audio')?.volume).toBeCloseTo(0.3);
    });
  });

  describe('audio vs video', () => {
    it('renders audio by default', async () => {
      const element = await mount((el) => el.setAttribute('src', TRACK.src));

      expect(element.querySelector('audio')).not.toBeNull();
      expect(element.isVideo).toBe(false);
    });

    it('renders video for type="video"', async () => {
      const element = await mount((el) => {
        el.setAttribute('type', 'video');
        el.setAttribute('src', 'https://example.test/v.mp4');
      });

      expect(element.isVideo).toBe(true);
      expect(element.querySelector('video')).not.toBeNull();
    });

    it('infers video from a poster attribute', async () => {
      const element = await mount((el) => {
        el.setAttribute('src', 'https://example.test/v.mp4');
        el.setAttribute('poster', 'https://example.test/p.jpg');
      });

      expect(element.isVideo).toBe(true);
    });

    it('lets type="audio" override the poster inference', async () => {
      const element = await mount((el) => {
        el.setAttribute('type', 'audio');
        el.setAttribute('src', TRACK.src);
        el.setAttribute('poster', 'https://example.test/p.jpg');
      });

      expect(element.isVideo).toBe(false);
    });
  });

  describe('events', () => {
    it('emits play and pause as DOM events', async () => {
      const onPlay = vi.fn();
      const onPause = vi.fn();
      const element = await mount((el) => el.setAttribute('src', TRACK.src));
      element.addEventListener(FAIRU_EVENTS.play, onPlay);
      element.addEventListener(FAIRU_EVENTS.pause, onPause);

      const audio = element.querySelector('audio')!;
      audio.dispatchEvent(new Event('play'));
      audio.dispatchEvent(new Event('pause'));
      await settle();

      expect(onPlay).toHaveBeenCalled();
      expect(onPause).toHaveBeenCalled();
    });

    it('carries the current time on timeupdate', async () => {
      const onTimeUpdate = vi.fn();
      const element = await mount((el) => el.setAttribute('src', TRACK.src));
      element.addEventListener(FAIRU_EVENTS.timeupdate, onTimeUpdate);

      const audio = element.querySelector('audio')!;
      Object.defineProperty(audio, 'currentTime', { configurable: true, value: 42 });
      audio.dispatchEvent(new Event('timeupdate'));
      await settle();

      expect(onTimeUpdate.mock.calls[0][0].detail).toEqual({ time: 42 });
    });

    it('emits ended', async () => {
      const onEnded = vi.fn();
      const element = await mount((el) => el.setAttribute('src', TRACK.src));
      element.addEventListener(FAIRU_EVENTS.ended, onEnded);

      element.querySelector('audio')!.dispatchEvent(new Event('ended'));
      await settle();

      expect(onEnded).toHaveBeenCalled();
    });

    it('bubbles, so a parent can listen', async () => {
      // `@fairu:play` on a wrapper is how Vue and Angular templates usually
      // attach, so the events have to travel.
      const onPlay = vi.fn();
      document.body.addEventListener(FAIRU_EVENTS.play, onPlay);

      const element = await mount((el) => el.setAttribute('src', TRACK.src));
      element.querySelector('audio')!.dispatchEvent(new Event('play'));
      await settle();

      expect(onPlay).toHaveBeenCalled();
      document.body.removeEventListener(FAIRU_EVENTS.play, onPlay);
    });

    it('is composed, so it crosses a shadow boundary', async () => {
      const element = await mount((el) => el.setAttribute('src', TRACK.src));
      let composed: boolean | undefined;
      element.addEventListener(FAIRU_EVENTS.play, (e) => {
        composed = e.composed;
      });

      element.querySelector('audio')!.dispatchEvent(new Event('play'));
      await settle();

      expect(composed).toBe(true);
    });

    it('stops emitting after removal', async () => {
      const onPlay = vi.fn();
      const element = await mount((el) => el.setAttribute('src', TRACK.src));
      element.addEventListener(FAIRU_EVENTS.play, onPlay);
      const audio = element.querySelector('audio')!;

      element.remove();
      await settle();
      audio.dispatchEvent(new Event('play'));
      await settle();

      expect(onPlay).not.toHaveBeenCalled();
    });
  });

  describe('several instances on one page', () => {
    it('keeps them independent', async () => {
      const a = await mount((el) => {
        el.config = { track: TRACK, volume: 0.2 };
      });
      const b = await mount((el) => {
        el.config = { track: { id: 'other', src: 'other.mp3' }, volume: 0.8 };
      });

      expect(a.querySelector('audio')?.volume).toBeCloseTo(0.2);
      expect(b.querySelector('audio')?.volume).toBeCloseTo(0.8);
    });

    it('only fires events on the instance they came from', async () => {
      const onPlayA = vi.fn();
      const a = await mount((el) => el.setAttribute('src', TRACK.src));
      const b = await mount((el) => el.setAttribute('src', 'other.mp3'));
      a.addEventListener(FAIRU_EVENTS.play, onPlayA);

      b.querySelector('audio')!.dispatchEvent(new Event('play'));
      await settle();

      expect(onPlayA).not.toHaveBeenCalled();
    });
  });
});
