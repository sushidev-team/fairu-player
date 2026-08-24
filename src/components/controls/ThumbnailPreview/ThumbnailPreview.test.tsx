/**
 * One frame of a scrub preview.
 *
 * Two shapes: a crop out of a sprite sheet, and a standalone image. The sprite
 * path is the one worth testing carefully — it is drawn as a background offset,
 * and an offset computed the wrong way shows the wrong frame rather than no
 * frame, which is much harder to notice.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThumbnailPreview } from './ThumbnailPreview';
import type { ThumbnailCue } from '@/core/thumbnails';

const SPRITE: ThumbnailCue = {
  startTime: 5,
  endTime: 10,
  url: 'https://cdn.example.test/sheet.jpg',
  x: 320,
  y: 90,
  width: 160,
  height: 90,
};

const SINGLE: ThumbnailCue = {
  startTime: 0,
  endTime: 5,
  url: 'https://cdn.example.test/shot.jpg',
};

describe('ThumbnailPreview', () => {
  it('renders nothing without a cue', () => {
    const { container } = render(<ThumbnailPreview cue={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  describe('a sprite crop', () => {
    it('offsets into the sheet', () => {
      render(<ThumbnailPreview cue={SPRITE} />);
      const frame = screen.getByTestId('thumbnail-sprite').firstElementChild as HTMLElement;

      expect(frame.style.backgroundImage).toBe('url("https://cdn.example.test/sheet.jpg")');
      expect(frame.style.backgroundPosition).toBe('-320px -90px');
    });

    it('takes its size from the cue', () => {
      render(<ThumbnailPreview cue={SPRITE} />);
      const box = screen.getByTestId('thumbnail-sprite');

      expect(box.style.width).toBe('160px');
      expect(box.style.height).toBe('90px');
    });

    it('scales with a transform, not the background', () => {
      render(<ThumbnailPreview cue={SPRITE} width={320} height={180} />);
      const box = screen.getByTestId('thumbnail-sprite');
      const frame = box.firstElementChild as HTMLElement;

      // Scaling by `background-size` would need the sheet's full dimensions,
      // which nothing reports — a percentage there is a percentage of the
      // element and lands on the wrong frame.
      expect(box.style.width).toBe('320px');
      expect(frame.style.width).toBe('160px');
      expect(frame.style.transform).toBe('scale(2, 2)');
      expect(frame.style.backgroundPosition).toBe('-320px -90px');
    });

    it('clips to the frame', () => {
      render(<ThumbnailPreview cue={SPRITE} />);

      // Without this the whole sheet spills across the tooltip.
      expect(screen.getByTestId('thumbnail-sprite').className).toContain('overflow-hidden');
    });
  });

  describe('a standalone image', () => {
    it('renders an img', () => {
      const { container } = render(<ThumbnailPreview cue={SINGLE} />);
      const image = container.querySelector('img')!;

      expect(image).toHaveAttribute('src', SINGLE.url);
      expect(image).toHaveAttribute('alt', '');
    });

    it('falls back to a 16:9 frame', () => {
      const { container } = render(<ThumbnailPreview cue={SINGLE} />);
      const image = container.querySelector('img')!;

      expect(image.style.width).toBe('160px');
      expect(image.style.height).toBe('90px');
    });

    it('takes the size it is given', () => {
      const { container } = render(<ThumbnailPreview cue={SINGLE} width={240} height={135} />);
      const image = container.querySelector('img')!;

      expect(image.style.width).toBe('240px');
    });

    it('does not block the page for a preview', () => {
      const { container } = render(<ThumbnailPreview cue={SINGLE} />);

      expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy');
    });
  });
});
