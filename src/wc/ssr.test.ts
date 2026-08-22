/**
 * Importing the entry point must survive a server render.
 *
 * Angular Universal, Nuxt and Next all evaluate imports on the server, and this
 * package is imported for its side effect — so `import '@fairu/player/wc'` is
 * the very first thing they run. It used to throw
 * `ReferenceError: HTMLElement is not defined`, because `class X extends
 * HTMLElement` is evaluated at module load rather than on first use, and take
 * the whole render down with it.
 *
 * This file runs in Node with no DOM, unlike every other test in the repo.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';

/**
 * Importing the entry point pulls in the whole player graph, and vitest
 * transforms it unbundled and uncached in this fresh node environment. That is
 * comfortably over the 5s default when the rest of the suite is competing for
 * the machine — it passed alone and timed out in a full run. The generous
 * timeout is about transform cost, not about the code being slow.
 */
const IMPORT_TIMEOUT = 30_000;

describe('server-side rendering', () => {
  it('has no DOM in this environment', () => {
    // Guards the guard: if a jsdom environment leaked in, everything below
    // would pass without proving anything.
    expect(typeof window).toBe('undefined');
    expect(typeof HTMLElement).toBe('undefined');
  });

  it('imports without throwing', async () => {
    await expect(import('./index')).resolves.toBeDefined();
  }, IMPORT_TIMEOUT);

  it('still exports its public surface', async () => {
    const api = await import('./index');

    expect(api.FairuPlayerElement).toBeDefined();
    expect(api.defineFairuPlayer).toBeInstanceOf(Function);
    expect(api.FAIRU_PLAYER_TAG).toBe('fairu-player');
    expect(api.FAIRU_EVENTS.play).toBe('fairu-play');
  }, IMPORT_TIMEOUT);

  it('registers nothing, quietly', async () => {
    const { defineFairuPlayer } = await import('./index');

    // No customElements registry to register with. It has to be a no-op rather
    // than a throw, so a shared component file can import it unconditionally.
    expect(() => defineFairuPlayer()).not.toThrow();
    expect(() => defineFairuPlayer('other-tag')).not.toThrow();
  }, IMPORT_TIMEOUT);
});
