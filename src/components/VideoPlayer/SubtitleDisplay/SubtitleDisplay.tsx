import { cn } from '@/utils/cn';
import { hexToRgba, type SubtitleStyle } from '@/core/subtitleStyle';

export type SubtitleDisplayMode = 'overlay' | 'below';

export interface SubtitleDisplayProps {
  /** The cue text. `null` hides the surface. */
  text: string | null;
  /** Who is speaking, when the file says so. */
  speaker?: string;
  /** Over the video, or in its own strip underneath. */
  mode?: SubtitleDisplayMode;
  /** Appearance, from {@link useSubtitleStyling}. */
  style?: SubtitleStyle;
  className?: string;
}

/**
 * Captions drawn by the player rather than the browser.
 *
 * Worth being deliberate about: the version this was ported from rendered the
 * cue with `dangerouslySetInnerHTML`, to turn newlines into `<br>`. A caption
 * file is third-party content, so that hands markup from a stranger to the DOM
 * for the sake of a line break. Splitting on newlines gives the same result
 * with none of that.
 */
export function SubtitleDisplay({
  text,
  speaker,
  mode = 'overlay',
  style,
  className,
}: SubtitleDisplayProps) {
  if (!text) return null;

  const background =
    style && hexToRgba(style.backgroundColor, style.backgroundOpacity);

  const cueStyle: React.CSSProperties = {
    fontSize: style ? `${style.fontSize}px` : undefined,
    fontFamily: style && style.fontFamily !== 'inherit' ? style.fontFamily : undefined,
    color: style?.textColor,
    backgroundColor: background ?? undefined,
    textShadow: style?.textShadow,
  };

  const lines = text.split('\n');

  const cue = (
    <span
      className={cn(
        'max-w-[80%] whitespace-pre-wrap rounded px-2 py-1 text-center leading-relaxed'
      )}
      style={cueStyle}
    >
      {speaker && <span className="mr-1 font-semibold">{speaker}:</span>}
      {lines.map((line, index) => (
        // Cue lines have no identity of their own; the index is the only key
        // available, and the list is replaced wholesale on every cue anyway.
        <span key={index}>
          {index > 0 && <br />}
          {line}
        </span>
      ))}
    </span>
  );

  if (mode === 'below') {
    return (
      <div
        data-testid="subtitle-display"
        className={cn('flex min-h-[2.5rem] items-center justify-center py-2', className)}
      >
        {cue}
      </div>
    );
  }

  return (
    <div
      data-testid="subtitle-display"
      className={cn(
        // Pointer-transparent on purpose: captions sit over the video surface,
        // and a caption that swallowed a click would break play-on-tap.
        'pointer-events-none absolute left-0 right-0 z-30 flex justify-center',
        className
      )}
      style={style?.position === 'top' ? { top: '10%' } : { bottom: '10%' }}
    >
      {cue}
    </div>
  );
}
