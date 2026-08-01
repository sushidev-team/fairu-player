import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `--fp-font-family` is only useful if it actually reaches the players.
 *
 * It used to be applied by `.fairu-player` alone — which is the audio player —
 * so a theme that set a typeface changed nothing in the video player or the
 * reels feed, and both silently inherited the host page's font. jsdom does not
 * apply stylesheets, so the guard has to read the source.
 */
describe('font-family reaches every player root', () => {
  const css = readFileSync(resolve(__dirname, './base.css'), 'utf8');

  /** The selectors of every rule that sets `font-family: var(--fp-font-family)`. */
  const selectorsWithFont = [...css.matchAll(/([^{}]+)\{[^}]*font-family:\s*var\(--fp-font-family\)[^}]*\}/g)]
    .flatMap((match) => match[1].split(',').map((s) => s.trim().split('\n').pop()!.trim()));

  it.each([
    '.fairu-player',
    '.fairu-video-player',
    '.fairu-audio-player',
    '.fairu-reels',
    // ThemeProvider's scope: it renders `display: contents` inside the players,
    // which still passes inherited properties through to children.
    '.fp-theme',
  ])('%s sets the font variable', (selector) => {
    expect(selectorsWithFont).toContain(selector);
  });
});
