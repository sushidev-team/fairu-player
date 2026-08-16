/**
 * Angular is the case this workspace was built for.
 *
 * The custom element shipped with colon-separated event names until a parse
 * test caught that `(fairu:play)` compiles without error and binds to `play` —
 * Angular reads the colon as a namespace separator. That was found against the
 * compiler in isolation; this page is the end-to-end counterpart, where the
 * template is compiled, rendered and clicked in a real browser.
 *
 * JIT compilation (`@angular/compiler` imported for its side effect) keeps this
 * to a plain Vite build instead of the full Angular toolchain. What is under
 * test is Angular's template semantics, and those are identical either way.
 */

import 'zone.js';
import '@angular/compiler';
import '@fairu/player/wc';
import '@fairu/player/styles.css';

import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { TRACK_ONE, TRACK_TWO, type Probe } from '@shared/fixtures';

declare global {
  interface Window {
    __probe: Probe;
  }
}

window.__probe = { framework: 'angular', events: [], mounted: false };

@Component({
  selector: 'app-root',
  standalone: true,
  // Required for any custom element in an Angular template. Without it the
  // compiler rejects the unknown tag outright.
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <h1>Angular</h1>
    <div id="host">
      <fairu-player
        [config]="config"
        muted
        theme="dark"
        (fairu-ready)="record('fairu-ready', $event)"
        (fairu-play)="record('fairu-play', $event)"
        (fairu-pause)="record('fairu-pause', $event)"
        (fairu-ended)="record('fairu-ended', $event)"
        (fairu-timeupdate)="record('fairu-timeupdate', $event)"
        (fairu-trackchange)="record('fairu-trackchange', $event)"
        (fairu-error)="record('fairu-error', $event)"
      ></fairu-player>
    </div>
    <button id="swap" type="button" (click)="swap()">Swap track</button>
  `,
})
export class AppComponent {
  config: Record<string, unknown> = { track: TRACK_ONE };

  record(name: string, event: Event): void {
    window.__probe.events.push({ name, detail: (event as CustomEvent).detail });
  }

  swap(): void {
    // A new object reference, which is what Angular's default change detection
    // needs in order to write the property again.
    this.config = { track: TRACK_TWO };
  }
}

bootstrapApplication(AppComponent).then(() => {
  window.__probe.mounted = true;
});
