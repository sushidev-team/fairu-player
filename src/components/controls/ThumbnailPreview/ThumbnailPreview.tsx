import { cn } from '@/utils/cn';
import type { ThumbnailCue } from '@/core/thumbnails';

export interface ThumbnailPreviewProps {
  /** The frame to show. Nothing renders without one. */
  cue: ThumbnailCue | null;
  /** Falls back to the cue's own size, then to 16:9 at 160px. */
  width?: number;
  height?: number;
  className?: string;
}

/**
 * One frame from a scrub preview.
 *
 * Two shapes, because both are in the wild. A cue carrying a crop points into a
 * sprite sheet — one request for the whole film — and is drawn as a background
 * offset. A cue without one is a single image.
 */
export function ThumbnailPreview({ cue, width, height, className }: ThumbnailPreviewProps) {
  if (!cue) return null;

  const frameWidth = width ?? cue.width ?? 160;
  const frameHeight = height ?? cue.height ?? 90;

  const isSprite = cue.x !== undefined && cue.y !== undefined;

  if (isSprite) {
    /*
      Scaled with a transform rather than `background-size`.

      Scaling a sprite crop by background-size needs the sheet's full pixel
      dimensions, which nothing tells us — a percentage there is a percentage of
      the *element*, which is a different number entirely and puts the window on
      the wrong frame. Cropping at the sheet's own scale and then transforming
      the result needs no such knowledge.
    */
    const cropWidth = cue.width ?? frameWidth;
    const cropHeight = cue.height ?? frameHeight;

    return (
      <div
        data-testid="thumbnail-sprite"
        className={cn('block overflow-hidden bg-black', className)}
        style={{ width: frameWidth, height: frameHeight }}
      >
        <div
          style={{
            width: cropWidth,
            height: cropHeight,
            backgroundImage: `url("${cue.url}")`,
            backgroundPosition: `-${cue.x ?? 0}px -${cue.y ?? 0}px`,
            backgroundRepeat: 'no-repeat',
            transform: `scale(${frameWidth / cropWidth}, ${frameHeight / cropHeight})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    );
  }

  return (
    <img
      src={cue.url}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn('block bg-black object-cover', className)}
      style={{ width: frameWidth, height: frameHeight }}
    />
  );
}
