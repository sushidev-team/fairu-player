/**
 * The baseline: no framework at all.
 *
 * If this page fails, the element itself is broken. If this page passes and a
 * framework page does not, the fault is in that framework's binding — which is
 * the distinction the whole workspace exists to make.
 */

import '@fairu/player/wc';
import '@fairu/player/styles.css';
import { EVENT_NAMES, TRACK_ONE, TRACK_TWO, type Probe } from '@shared/fixtures';

declare global {
  interface Window {
    __probe: Probe;
  }
}

const probe: Probe = { framework: 'plain', events: [], mounted: false };
window.__probe = probe;

const player = document.createElement('fairu-player') as HTMLElement & {
  config?: unknown;
};

player.setAttribute('muted', '');
player.setAttribute('theme', 'dark');
player.config = { track: TRACK_ONE };

for (const name of EVENT_NAMES) {
  player.addEventListener(name, (event) => {
    probe.events.push({ name, detail: (event as CustomEvent).detail });
  });
}

document.querySelector('#host')!.appendChild(player);

document.querySelector('#swap')!.addEventListener('click', () => {
  player.config = { track: TRACK_TWO };
});

probe.mounted = true;
