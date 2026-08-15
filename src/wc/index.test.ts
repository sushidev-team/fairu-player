/**
 * The entry point's whole job is a side effect: importing it must register the
 * tag. That is what `import '@fairu/player/wc'` promises, and it is the one
 * line of this package that no other test would touch.
 */

import { describe, it, expect } from 'vitest';
import { FairuPlayerElement, FAIRU_PLAYER_TAG, FAIRU_EVENTS } from './index';

describe('@fairu/player/wc entry point', () => {
  it('registers the element on import', () => {
    expect(customElements.get(FAIRU_PLAYER_TAG)).toBeDefined();
  });

  it('registers under the documented tag name', () => {
    expect(FAIRU_PLAYER_TAG).toBe('fairu-player');
  });

  it('produces a FairuPlayerElement for that tag', () => {
    expect(document.createElement(FAIRU_PLAYER_TAG)).toBeInstanceOf(FairuPlayerElement);
  });

  it('re-exports the event names consumers bind to', () => {
    // These strings are the public contract for `@fairu-play` and friends;
    // renaming one silently breaks every template using it. The dash matters —
    // see the comment on FAIRU_EVENTS about Angular and colons.
    expect(FAIRU_EVENTS).toMatchObject({
      ready: 'fairu-ready',
      play: 'fairu-play',
      pause: 'fairu-pause',
      ended: 'fairu-ended',
      timeupdate: 'fairu-timeupdate',
      trackchange: 'fairu-trackchange',
      error: 'fairu-error',
    });
  });
});
