/**
 * Does the element's contract actually bind in the frameworks we document?
 *
 * The rest of the suite drives the element the way a framework would, which
 * proves the element behaves — but not that a real template compiles to those
 * calls. That gap is not theoretical: `(fairu:play)` compiles in Angular
 * *without an error* and binds to `play`, because a colon in a binding name is
 * a namespace separator there. The README shipped that exact snippet, and it
 * would silently never fire.
 *
 * So the Angular case is checked against Angular's own template compiler rather
 * than against a belief about it. Vue and Svelte are checked by the rules their
 * compilers apply to a name, which is a weaker guarantee — see the note at the
 * bottom.
 */

import { describe, it, expect } from 'vitest';
import { parseTemplate } from '@angular/compiler';
import { FAIRU_EVENTS, FAIRU_PLAYER_TAG } from './FairuPlayerElement';

const EVENT_NAMES = Object.values(FAIRU_EVENTS);

/** Compile one Angular template and report what it bound. */
function compile(template: string) {
  const parsed = parseTemplate(template, 'test.html');
  const element = parsed.nodes[0] as {
    outputs?: Array<{ name: string }>;
    inputs?: Array<{ name: string }>;
  };

  return {
    errors: (parsed.errors ?? []).map((e) => String(e.msg ?? e)),
    outputs: (element?.outputs ?? []).map((o) => o.name),
    inputs: (element?.inputs ?? []).map((i) => i.name),
  };
}

describe('framework bindings', () => {
  describe('Angular templates', () => {
    it.each(EVENT_NAMES)('binds (%s) to that exact event', (event) => {
      const { errors, outputs } = compile(
        `<${FAIRU_PLAYER_TAG} (${event})="handle()"></${FAIRU_PLAYER_TAG}>`
      );

      expect(errors).toEqual([]);
      expect(outputs).toEqual([event]);
    });

    it('would have bound a colon-separated name to the wrong event', () => {
      // The regression this file exists for. Angular reports no error, which is
      // what made it dangerous: `fairu:` is dropped as a namespace and the
      // handler ends up on `play` — where the inner media element's native
      // event arrives instead.
      const { errors, outputs } = compile(
        `<${FAIRU_PLAYER_TAG} (fairu:play)="handle()"></${FAIRU_PLAYER_TAG}>`
      );

      expect(errors).toEqual([]);
      expect(outputs).toEqual(['play']);
      expect(outputs).not.toContain('fairu:play');
    });

    it('binds [config] as a property', () => {
      // The structured-data path. Angular sets DOM properties for [foo], which
      // is what the element's `config` setter needs.
      const { errors, inputs } = compile(
        `<${FAIRU_PLAYER_TAG} [config]="cfg"></${FAIRU_PLAYER_TAG}>`
      );

      expect(errors).toEqual([]);
      expect(inputs).toEqual(['config']);
    });

    it('binds [playlist] as a property', () => {
      const { errors, inputs } = compile(
        `<${FAIRU_PLAYER_TAG} [playlist]="episodes"></${FAIRU_PLAYER_TAG}>`
      );

      expect(errors).toEqual([]);
      expect(inputs).toEqual(['playlist']);
    });

    it('accepts plain attributes alongside bindings', () => {
      const { errors } = compile(
        `<${FAIRU_PLAYER_TAG} theme="dark" [config]="cfg" (${FAIRU_EVENTS.play})="p()"></${FAIRU_PLAYER_TAG}>`
      );

      expect(errors).toEqual([]);
    });

    it('compiles the README example verbatim', () => {
      // Kept in step with the snippet in the README, so a copy-paste from the
      // docs is covered rather than an idealised version of it.
      const { errors, inputs, outputs } = compile(`
        <${FAIRU_PLAYER_TAG}
          [config]="config"
          theme="dark"
          (${FAIRU_EVENTS.play})="onPlay()"
          (${FAIRU_EVENTS.timeupdate})="onTime($any($event).detail.time)"
        ></${FAIRU_PLAYER_TAG}>
      `);

      expect(errors).toEqual([]);
      expect(inputs).toContain('config');
      expect(outputs).toEqual([FAIRU_EVENTS.play, FAIRU_EVENTS.timeupdate]);
    });
  });

  describe('name shape', () => {
    /**
     * Vue compiles `@name` and Svelte `on:name` by passing the name through to
     * `addEventListener`, so the risk there is not the compiler but the
     * characters themselves — a colon is meaningful in Vue's own directive
     * syntax (`v-on:`) and in Svelte's modifier syntax (`on:click|once`).
     *
     * Lower-case letters and dashes are inert in all three, which is why the
     * shape is asserted rather than the compilers.
     */
    it.each(EVENT_NAMES)('%s is lower-case, dashed and prefixed', (event) => {
      expect(event).toMatch(/^fairu-[a-z]+$/);
    });

    it('has no colons anywhere in the event contract', () => {
      expect(EVENT_NAMES.filter((name) => name.includes(':'))).toEqual([]);
    });

    it('keeps every event name distinct', () => {
      expect(new Set(EVENT_NAMES).size).toBe(EVENT_NAMES.length);
    });

    it('uses a tag name custom elements accept', () => {
      // The spec requires a dash and a lower-case first letter.
      expect(FAIRU_PLAYER_TAG).toMatch(/^[a-z][a-z0-9]*-[a-z0-9-]*$/);
    });
  });
});
