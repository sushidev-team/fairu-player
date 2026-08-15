import { createRoot, type Root } from 'react-dom/client';
import { PlayerProvider } from '@/context/PlayerContext';
import { Player } from '@/components/Player';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { PlayerConfig, Track } from '@/types/player';
import type { VideoConfig, VideoTrack } from '@/types/video';

/**
 * `<fairu-player>` — the player as a custom element.
 *
 * This exists so Vue, Angular, Svelte and plain HTML get the same player as
 * React without each needing its own binding layer. React runs inside the
 * element; nothing outside has to know that.
 *
 * Two ways in, because neither covers everything on its own:
 *
 * - **Attributes** for the simple case (`src`, `title`, `theme`). HTML
 *   attributes are strings, so this is what a hand-written page or a CMS can
 *   express.
 * - **Properties** (`.config`, `.playlist`) for structured data. A playlist or
 *   an ad schedule cannot go through an attribute without JSON-stringifying it,
 *   and every framework's binding syntax (`:config`, `[config]`) sets DOM
 *   properties, which is exactly what this needs.
 *
 * Properties win over attributes when both are set: a framework binding is a
 * deliberate act, an attribute is often template boilerplate.
 */

/**
 * Events the element emits, all prefixed to avoid colliding with native ones.
 *
 * Dash-separated, not `fairu:play`. Angular's template parser reads a colon in
 * a binding name as a namespace separator: `(fairu:play)` compiles without any
 * error and binds to `play` — so the handler never fires for this event, and
 * does fire for the native `play` bubbling up from the inner media element.
 * Silent and very hard to debug.
 *
 * A dash has no meaning in any of the three template syntaxes, so
 * `(fairu-play)`, `@fairu-play` and `on:fairu-play` all bind to exactly this
 * name.
 */
export const FAIRU_EVENTS = {
  play: 'fairu-play',
  pause: 'fairu-pause',
  ended: 'fairu-ended',
  timeupdate: 'fairu-timeupdate',
  trackchange: 'fairu-trackchange',
  error: 'fairu-error',
  ready: 'fairu-ready',
} as const;

export type FairuEventName = (typeof FAIRU_EVENTS)[keyof typeof FAIRU_EVENTS];

/** Attributes the element observes. */
const OBSERVED = [
  'src',
  'title',
  'artist',
  'album',
  'artwork',
  'poster',
  'type',
  'theme',
  'autoplay',
  'muted',
  'volume',
  'loop',
  'persistence',
  'auto-resume',
  'media-session',
] as const;

function parseBool(value: string | null, fallback = false): boolean {
  if (value === null) return fallback;
  // Bare attributes (`<fairu-player autoplay>`) arrive as an empty string,
  // which HTML defines as true.
  if (value === '' || value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function parseNum(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * `HTMLElement`, or a stand-in when there is no DOM.
 *
 * `class X extends HTMLElement` is evaluated when the module loads, not when
 * the element is first used — so importing this file in Node threw
 * `ReferenceError: HTMLElement is not defined` and took down every server
 * render. Angular Universal, Nuxt and Next all import for the side effect, so
 * this was the first thing they hit.
 *
 * The stub is never instantiated: `defineFairuPlayer` returns early without a
 * DOM, so nothing can construct one on the server.
 */
const ElementBase: typeof HTMLElement =
  typeof HTMLElement === 'undefined'
    ? (class {} as unknown as typeof HTMLElement)
    : HTMLElement;

export class FairuPlayerElement extends ElementBase {
  static get observedAttributes(): readonly string[] {
    return OBSERVED;
  }

  #root: Root | null = null;
  #mountPoint: HTMLDivElement | null = null;
  #config: PlayerConfig | VideoConfig = {};
  #playlist: Track[] | VideoTrack[] | null = null;
  #connected = false;
  /** Coalesces bursts of attribute changes into one re-render. */
  #renderQueued = false;

  /** Structured configuration. Set through a framework binding, not markup. */
  get config(): PlayerConfig | VideoConfig {
    return this.#config;
  }

  set config(value: PlayerConfig | VideoConfig) {
    this.#config = value ?? {};
    this.#scheduleRender();
  }

  get playlist(): Track[] | VideoTrack[] | null {
    return this.#playlist;
  }

  set playlist(value: Track[] | VideoTrack[] | null) {
    this.#playlist = value;
    this.#scheduleRender();
  }

  /** Whether this instance renders video rather than audio. */
  get isVideo(): boolean {
    const declared = this.getAttribute('type');
    if (declared === 'video') return true;
    if (declared === 'audio') return false;
    // Fall back to what the config implies, so `type` is optional.
    return Boolean((this.#config as VideoConfig).poster || this.getAttribute('poster'));
  }

  connectedCallback(): void {
    if (this.#connected) return;
    this.#connected = true;

    // React renders into a child rather than into the host: React owns the
    // children of whatever it renders into, and the host may carry
    // framework-managed light DOM (Angular comment anchors, Vue fragments)
    // that must not be cleared.
    this.#mountPoint = document.createElement('div');
    this.#mountPoint.style.display = 'contents';
    this.appendChild(this.#mountPoint);

    this.#root = createRoot(this.#mountPoint);
    this.#render();
    this.#emit(FAIRU_EVENTS.ready, null);
  }

  disconnectedCallback(): void {
    this.#connected = false;

    // Unmount asynchronously. React throws when a root is unmounted while it is
    // rendering, and a synchronous unmount here lands inside the caller's
    // removal — which for a framework is often mid-render.
    const root = this.#root;
    const mountPoint = this.#mountPoint;
    this.#root = null;
    this.#mountPoint = null;

    queueMicrotask(() => {
      root?.unmount();
      mountPoint?.remove();
    });
  }

  attributeChangedCallback(): void {
    if (!this.#connected) return;
    this.#scheduleRender();
  }

  #scheduleRender(): void {
    if (!this.#connected || this.#renderQueued) return;
    this.#renderQueued = true;
    queueMicrotask(() => {
      this.#renderQueued = false;
      this.#render();
    });
  }

  /** Merge attributes and properties into one config. */
  #buildConfig(): PlayerConfig & VideoConfig {
    const attrs = this.attributes;
    const src = this.getAttribute('src');

    // Attributes describe at most a single track. Anything richer comes in
    // through `.config` or `.playlist`.
    const attrTrack: (Track & VideoTrack) | undefined = src
      ? {
          id: this.getAttribute('id') || src,
          src,
          title: this.getAttribute('title') ?? undefined,
          artist: this.getAttribute('artist') ?? undefined,
          album: this.getAttribute('album') ?? undefined,
          artwork: this.getAttribute('artwork') ?? undefined,
          poster: this.getAttribute('poster') ?? undefined,
        }
      : undefined;

    const fromAttributes: PlayerConfig & VideoConfig = {
      autoPlay: parseBool(this.getAttribute('autoplay')),
      muted: parseBool(this.getAttribute('muted')),
    };

    const volume = parseNum(this.getAttribute('volume'));
    if (volume !== undefined) fromAttributes.volume = volume;

    if (attrs.getNamedItem('persistence')) {
      fromAttributes.persistence = {
        enabled: parseBool(this.getAttribute('persistence'), true),
      };
    }

    if (attrs.getNamedItem('auto-resume')) {
      fromAttributes.resume = {
        autoResume: parseBool(this.getAttribute('auto-resume'), true),
      };
    }

    if (attrs.getNamedItem('media-session')) {
      fromAttributes.mediaSession = {
        enabled: parseBool(this.getAttribute('media-session'), true),
      };
    }

    const config = { ...fromAttributes, ...this.#config } as PlayerConfig & VideoConfig;

    if (this.#playlist && this.#playlist.length > 0) {
      config.playlist = this.#playlist as Track[] & VideoTrack[];
    } else if (!config.playlist && !config.track && attrTrack) {
      config.track = attrTrack;
    }

    return config;
  }

  #emit<T>(name: FairuEventName, detail: T): void {
    this.dispatchEvent(
      new CustomEvent(name, {
        detail,
        // Composed so the event still crosses a shadow boundary if a host page
        // ever wraps this element in one.
        bubbles: true,
        composed: true,
      })
    );
  }

  #render(): void {
    if (!this.#root) return;

    const config = this.#buildConfig();
    const theme = this.getAttribute('theme') ?? undefined;

    const handlers = {
      onPlay: () => this.#emit(FAIRU_EVENTS.play, null),
      onPause: () => this.#emit(FAIRU_EVENTS.pause, null),
      onEnded: () => this.#emit(FAIRU_EVENTS.ended, null),
      onTimeUpdate: (time: number) => this.#emit(FAIRU_EVENTS.timeupdate, { time }),
      onError: (error: Error) =>
        this.#emit(FAIRU_EVENTS.error, { message: error.message, error }),
    };

    // `VideoPlayer` brings its own `VideoProvider`. Wrapping it in another one
    // silently detaches everything: the inner provider wins, so an outer
    // provider's config and callbacks are simply never consulted. The video
    // path therefore configures the component directly.
    const tree = this.isVideo ? (
      <VideoPlayer
        config={config as VideoConfig}
        {...handlers}
        onTrackChange={(track: VideoTrack, index: number) =>
          this.#emit(FAIRU_EVENTS.trackchange, { track, index })
        }
      />
    ) : (
      <PlayerProvider
        config={config as PlayerConfig}
        {...handlers}
        onTrackChange={(track: Track, index: number) =>
          this.#emit(FAIRU_EVENTS.trackchange, { track, index })
        }
      >
        <Player />
      </PlayerProvider>
    );

    this.#root.render(
      <div data-theme={theme} className="fairu-player-wc">
        {tree}
      </div>
    );
  }
}

/** Tag name the element registers under. */
export const FAIRU_PLAYER_TAG = 'fairu-player';

/** Whether the base constructor has been handed to `customElements` already. */
let baseRegistered = false;

/**
 * Register the element.
 *
 * Safe to call more than once. Two guards, for two different failures:
 *
 * - Re-registering the same *tag* throws, and module duplication across bundles
 *   makes that a real possibility rather than a theoretical one.
 * - Re-registering the same *constructor* under a second tag also throws — the
 *   spec allows a class to back exactly one tag. Additional tag names therefore
 *   get a fresh subclass, which behaves identically and satisfies
 *   `instanceof FairuPlayerElement`.
 */
export function defineFairuPlayer(tagName: string = FAIRU_PLAYER_TAG): void {
  if (typeof window === 'undefined' || !window.customElements) return;
  if (window.customElements.get(tagName)) return;

  const ctor = baseRegistered ? class extends FairuPlayerElement {} : FairuPlayerElement;
  window.customElements.define(tagName, ctor);
  baseRegistered = true;
}
