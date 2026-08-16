import { test, expect, type Page } from '@playwright/test';
import { PORTS } from '../shared/vite.base';

/**
 * The same assertions against every framework.
 *
 * The apps differ only in how they bind, so running one shared suite is what
 * makes the result meaningful: a failure points at a framework's binding rather
 * than at the app that was written for it. `plain` is the control — if it fails
 * too, the element is broken and the framework is innocent.
 */

const APPS = [
  { name: 'plain', port: PORTS.plain },
  { name: 'vue', port: PORTS.vue },
  { name: 'svelte', port: PORTS.svelte },
  { name: 'angular', port: PORTS.angular },
] as const;

interface ProbeEvent {
  name: string;
  detail: unknown;
}

/** Read the events the page's own framework listeners collected. */
async function events(page: Page): Promise<ProbeEvent[]> {
  return page.evaluate(() => (window as unknown as { __probe: { events: ProbeEvent[] } }).__probe.events);
}

async function eventNames(page: Page): Promise<string[]> {
  return (await events(page)).map((e) => e.name);
}

/** Drive the inner media element directly, as playback would. */
async function fireOnMedia(page: Page, type: string) {
  await page.evaluate((eventType) => {
    const audio = document.querySelector('fairu-player audio, fairu-player video');
    audio?.dispatchEvent(new Event(eventType));
  }, type);
}

for (const app of APPS) {
  test.describe(app.name, () => {
    test.beforeEach(async ({ page }) => {
      const failures: string[] = [];
      page.on('pageerror', (error) => failures.push(String(error)));
      page.on('console', (message) => {
        if (message.type() === 'error') failures.push(message.text());
      });

      await page.goto(`http://localhost:${app.port}/`);
      await page.waitForFunction(() => (window as unknown as { __probe?: unknown }).__probe !== undefined);

      // Stash for the console assertion below.
      (page as unknown as { __failures: string[] }).__failures = failures;
    });

    test('renders the player through the framework', async ({ page }) => {
      // The element upgraded, React mounted inside it, and a real media element
      // exists in the DOM. Nothing below is meaningful without this.
      await expect(page.locator('fairu-player audio')).toHaveCount(1);
    });

    test('the bound config reaches the element as a property', async ({ page }) => {
      // The track only arrives via `config`, so a src on the media element
      // proves the framework wrote the property rather than an attribute.
      const src = await page.locator('fairu-player audio').getAttribute('src');
      expect(src).toContain('data:audio/wav');
    });

    test('emits ready to the framework listener', async ({ page }) => {
      // Ready is deferred by a microtask precisely so this holds everywhere:
      // Angular attaches its output listeners after the node is inserted, and
      // connectedCallback runs during insertion.
      await expect.poll(() => eventNames(page)).toContain('fairu-ready');
    });

    test('play reaches the framework listener', async ({ page }) => {
      await fireOnMedia(page, 'play');

      // The full chain in a real browser: media event -> React state -> the
      // element's CustomEvent -> the framework's own template binding.
      await expect.poll(() => eventNames(page)).toContain('fairu-play');
    });

    test('pause reaches the framework listener', async ({ page }) => {
      await fireOnMedia(page, 'play');
      await fireOnMedia(page, 'pause');

      await expect.poll(() => eventNames(page)).toContain('fairu-pause');
    });

    test('timeupdate carries its payload through', async ({ page }) => {
      await fireOnMedia(page, 'timeupdate');

      await expect.poll(() => eventNames(page)).toContain('fairu-timeupdate');

      const timeupdate = (await events(page)).find((e) => e.name === 'fairu-timeupdate');
      expect(timeupdate?.detail).toHaveProperty('time');
    });

    test('never binds our events to a native one', async ({ page }) => {
      // The regression that motivated this workspace. Angular strips a colon as
      // a namespace, so `(fairu:play)` used to land on `play` — where the inner
      // media element's native event arrives. If that happened, firing `play`
      // once would show up twice.
      await fireOnMedia(page, 'play');
      await expect.poll(() => eventNames(page)).toContain('fairu-play');

      const plays = (await eventNames(page)).filter((name) => name === 'fairu-play');
      expect(plays).toHaveLength(1);
    });

    test('rebinding the config swaps the track', async ({ page }) => {
      const before = await page.locator('fairu-player audio').getAttribute('src');

      await page.locator('#swap').click();

      // Asserted on the media source, not on a `trackchange` event: adopting a
      // replacement list moves the cursor without going through next/previous,
      // so no track-change callback fires. What the user cares about is that
      // different audio is loaded — and the two fixtures differ in length so
      // this cannot pass by accident.
      //
      // Vue, Angular and Svelte each write the property again in their own way;
      // this is the assertion that their reactivity actually reaches it.
      await expect
        .poll(() => page.locator('fairu-player audio').getAttribute('src'))
        .not.toBe(before);
    });

    test('logs no errors while doing any of it', async ({ page }) => {
      await fireOnMedia(page, 'play');
      await page.locator('#swap').click();
      await page.waitForTimeout(250);

      const failures = (page as unknown as { __failures: string[] }).__failures;
      expect(failures).toEqual([]);
    });
  });
}
