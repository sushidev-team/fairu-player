import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/utils/cn';
import { parseVTT, findCueAtTime, generateSpriteCues, type ThumbnailConfig, type ThumbnailCue } from '@/utils/thumbnails';

export interface ThumbnailPreviewProps {
  /** Time in seconds to show thumbnail for */
  time: number;
  /** Thumbnail configuration */
  config: ThumbnailConfig;
  /** Whether the preview is visible */
  visible: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ThumbnailPreview({
  time,
  config,
  visible,
  className,
}: ThumbnailPreviewProps) {
  const [cues, setCues] = useState<ThumbnailCue[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load and parse VTT file
  useEffect(() => {
    if (!config.vttUrl) return;

    let cancelled = false;
    fetch(config.vttUrl)
      .then((res) => res.text())
      .then((text) => {
        if (!cancelled) {
          setCues(parseVTT(text));
          setLoaded(true);
        }
      })
      .catch(() => {
        // Silently fail - thumbnails are optional
      });

    return () => { cancelled = true; };
  }, [config.vttUrl]);

  // Generate sprite cues if no VTT
  useEffect(() => {
    if (config.vttUrl) return; // VTT takes priority
    if (!config.spriteUrl || !config.spriteColumns || !config.spriteRows || !config.thumbWidth || !config.thumbHeight || !config.duration) return;

    const generated = generateSpriteCues({
      spriteUrl: config.spriteUrl,
      columns: config.spriteColumns,
      rows: config.spriteRows,
      thumbWidth: config.thumbWidth,
      thumbHeight: config.thumbHeight,
      interval: config.interval || (config.duration / (config.spriteColumns * config.spriteRows)),
      duration: config.duration,
    });
    setCues(generated);
    setLoaded(true);
  }, [config]);

  // Find the current cue
  const currentCue = useMemo(() => findCueAtTime(cues, time), [cues, time]);

  if (!visible || !loaded || !currentCue) return null;

  const thumbWidth = currentCue.width || config.thumbWidth || 160;
  const thumbHeight = currentCue.height || config.thumbHeight || 90;

  // If it's a sprite sheet (has x/y coordinates)
  if (currentCue.x !== undefined && currentCue.y !== undefined) {
    return (
      <div
        className={cn(
          'rounded overflow-hidden shadow-lg border border-[var(--fp-glass-border)]',
          className
        )}
        style={{
          width: thumbWidth,
          height: thumbHeight,
          backgroundImage: `url(${currentCue.url})`,
          backgroundPosition: `-${currentCue.x}px -${currentCue.y}px`,
          backgroundSize: 'auto',
          backgroundRepeat: 'no-repeat',
        }}
      />
    );
  }

  // Individual thumbnail image
  return (
    <img
      src={currentCue.url}
      alt=""
      className={cn(
        'rounded overflow-hidden shadow-lg border border-[var(--fp-glass-border)]',
        className
      )}
      style={{ width: thumbWidth, height: thumbHeight, objectFit: 'cover' }}
    />
  );
}
