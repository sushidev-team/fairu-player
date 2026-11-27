import { expect, test } from '@playwright/test';
import { PORTS } from '../shared/vite.base';

test.beforeEach(async ({ page }) => {
  await page.goto(`http://localhost:${PORTS.plain}/video.html`);
  await expect(page.locator('.fp-video-compact-row')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
});

for (const width of [320, 375, 430]) {
  test(`all primary controls can be tapped at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const player = await page.locator('.fairu-video-player').boundingBox();
    expect(player).not.toBeNull();
    for (const button of await page.locator('.fp-video-compact-row button').all()) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(player!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(player!.x + player!.width);
      expect(await button.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      })).toBe(true);
    }
    await page.getByRole('button', { name: 'Play', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mute', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Unmute', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pause', exact: true }).tap();
    await expect.poll(() => page.locator('video').evaluate(video => video.paused)).toBe(true);
  });
}

test('touching the video reveals hidden controls without toggling playback', async ({ page }) => {
  await page.getByRole('button', { name: 'Play', exact: true }).tap();
  await page.locator('video').tap({ position: { x: 100, y: 20 } });
  await expect(page.locator('[data-player-controls]')).toHaveCSS('opacity', '0');
  await page.locator('video').tap({ position: { x: 100, y: 20 } });
  await expect(page.locator('[data-player-controls]')).not.toHaveClass(/pointer-events-none/);
  await expect.poll(() => page.locator('video').evaluate(video => video.paused)).toBe(false);
});

test('settings stay inside the video and remain operable after auto-hide', async ({ page }) => {
  await page.getByRole('button', { name: 'Play', exact: true }).tap();
  await page.getByRole('button', { name: 'Player settings' }).tap();
  const panel = page.getByRole('group', { name: 'Player settings' });
  const box = await panel.boundingBox();
  const player = await page.locator('.fairu-video-player').boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(player!.y);
  expect(box!.y + box!.height).toBeLessThanOrEqual(player!.y + player!.height);
  await page.waitForTimeout(900);
  await expect(panel).toBeVisible();
  await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('1.5');
  await expect.poll(() => page.locator('video').evaluate(video => video.playbackRate)).toBe(1.5);
  await page.getByRole('combobox', { name: 'Subtitles', exact: true }).selectOption('en');
  await expect(page.getByRole('combobox', { name: 'Subtitles', exact: true })).toHaveValue('en');
  await page.getByRole('combobox', { name: 'Select video quality' }).selectOption('High');
  await expect.poll(() => page.locator('video').evaluate(video => video.currentSrc)).toContain('?high');
  const volume = panel.getByRole('slider', { name: 'Volume' });
  await volume.scrollIntoViewIfNeeded();
  const slider = await volume.boundingBox();
  await page.touchscreen.tap(slider!.x + slider!.width / 4, slider!.y + slider!.height / 2);
  await expect(volume).toHaveAttribute('aria-valuenow', '25');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Player settings' })).toBeFocused();
});

test('a narrow embed uses compact controls on a desktop-sized page too', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#host').evaluate(host => { host.style.width = '320px'; });
  await expect(page.locator('.fp-video-compact-row')).toBeVisible();
  await page.getByRole('button', { name: 'Player settings' }).tap();
  await expect(page.getByRole('group', { name: 'Player settings' })).toBeVisible();
});

test('the desktop quality control actually selects a rendition', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('.fp-video-compact-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Select video quality' }).tap();
  await page.getByRole('option', { name: 'High', exact: true }).tap();
  await expect.poll(() => page.locator('video').evaluate(video => video.currentSrc)).toContain('?high');
});
