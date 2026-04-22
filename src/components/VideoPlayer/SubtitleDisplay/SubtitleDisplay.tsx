import { cn } from '@/utils/cn';

export type SubtitleDisplayMode = 'overlay' | 'below';

export interface SubtitleDisplayProps {
  /** The subtitle text to display (null = hidden) */
  text: string | null;
  /** Display mode: overlay on video or below the video */
  mode: SubtitleDisplayMode;
  /** CSS properties from useSubtitleStyling */
  style?: React.CSSProperties;
  /** Additional class name */
  className?: string;
}

export function SubtitleDisplay({ text, mode, style: subtitleStyle, className }: SubtitleDisplayProps) {
  if (mode === 'overlay') {
    return (
      <div
        className={cn(
          'absolute left-0 right-0 flex justify-center pointer-events-none z-30',
          'transition-opacity duration-200',
          !text && 'opacity-0',
          text && 'opacity-100',
          className
        )}
        style={{
          bottom: subtitleStyle?.bottom ?? '10%',
          top: subtitleStyle?.top ?? 'auto',
        }}
      >
        {text && (
          <span
            className="text-center max-w-[80%] leading-relaxed"
            style={{
              fontSize: subtitleStyle?.fontSize,
              fontFamily: subtitleStyle?.fontFamily,
              color: subtitleStyle?.color,
              backgroundColor: subtitleStyle?.backgroundColor,
              textShadow: subtitleStyle?.textShadow,
              padding: subtitleStyle?.padding ?? '4px 8px',
              borderRadius: subtitleStyle?.borderRadius ?? '4px',
            }}
            dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, '<br />') }}
          />
        )}
      </div>
    );
  }

  // Below mode
  return (
    <div
      className={cn(
        'flex justify-center items-center min-h-[2.5rem] px-4 py-2',
        'transition-opacity duration-200',
        !text && 'opacity-0',
        text && 'opacity-100',
        className
      )}
      style={{
        fontSize: subtitleStyle?.fontSize,
        fontFamily: subtitleStyle?.fontFamily,
        color: subtitleStyle?.color,
        backgroundColor: subtitleStyle?.backgroundColor,
        textShadow: subtitleStyle?.textShadow,
      }}
    >
      {text && (
        <span
          className="text-center leading-relaxed"
          dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, '<br />') }}
        />
      )}
    </div>
  );
}
