import { useMemo } from 'react';
import { cn } from '@/utils/cn';
import type { LogoConfig, LogoComponentProps } from '@/types/logo';

export interface LogoOverlayProps {
  config: LogoConfig;
  visible?: boolean;
  isPlaying?: boolean;
  isFullscreen?: boolean;
  className?: string;
}

// Default controls height for bottom position offset
const CONTROLS_HEIGHT = 56;

/**
 * Logo overlay component for video player
 * Supports static images, animated logos, and custom React components
 */
export function LogoOverlay({
  config,
  visible = true,
  isPlaying = false,
  isFullscreen = false,
  className,
}: LogoOverlayProps) {
  const {
    src,
    component: CustomComponent,
    alt = '',
    position = 'bottom-right',
    width,
    height,
    opacity = 0.8,
    margin = 16,
    offsetX = 0,
    offsetY = 0,
    animation,
    hideWithControls = false,
    onClick,
    href,
    target = '_blank',
    className: configClassName,
  } = config;

  // Determine actual visibility based on hideWithControls
  const isVisible = hideWithControls ? visible : true;

  // Animation settings
  const animationType = animation?.type ?? 'fade';
  const animationDuration = animation?.duration ?? 300;
  const animationDelay = animation?.delay ?? 0;

  // Calculate position styles
  const positionStyle = useMemo((): React.CSSProperties => {
    const style: React.CSSProperties = {};
    const isBottom = position.includes('bottom');
    const isRight = position.includes('right');
    const isTop = position.includes('top');
    const isLeft = position.includes('left');

    // Base positioning
    if (isTop) style.top = margin + offsetY;
    if (isBottom) style.bottom = margin + CONTROLS_HEIGHT + offsetY;
    if (isLeft) style.left = margin + offsetX;
    if (isRight) style.right = margin - offsetX;

    return style;
  }, [position, margin, offsetX, offsetY]);

  // Animation styles
  const animationStyle = useMemo((): React.CSSProperties => {
    const style: React.CSSProperties = {
      transitionProperty: 'opacity, transform',
      transitionDuration: `${animationDuration}ms`,
      transitionTimingFunction: 'ease-in-out',
      transitionDelay: animationDelay > 0 ? `${animationDelay}ms` : undefined,
    };

    // Base opacity when visible
    const baseOpacity = isVisible ? opacity : 0;

    switch (animationType) {
      case 'none':
        style.opacity = baseOpacity;
        style.transitionDuration = '0ms';
        break;

      case 'fade':
        style.opacity = baseOpacity;
        break;

      case 'slide': {
        style.opacity = baseOpacity;
        const isLeft = position.includes('left');
        if (!isVisible) {
          style.transform = isLeft ? 'translateX(-100%)' : 'translateX(100%)';
        } else {
          style.transform = 'translateX(0)';
        }
        break;
      }

      case 'scale':
        style.opacity = baseOpacity;
        style.transform = isVisible ? 'scale(1)' : 'scale(0.75)';
        break;

      default:
        style.opacity = baseOpacity;
    }

    return style;
  }, [animationType, animationDuration, animationDelay, isVisible, opacity, position]);

  // Image/content style
  const contentStyle = useMemo((): React.CSSProperties => ({
    width: width ?? 'auto',
    height: height ?? 'auto',
    maxWidth: width ?? 120,
    maxHeight: height ?? 60,
  }), [width, height]);

  // Props for custom component
  const componentProps: LogoComponentProps = useMemo(
    () => ({
      visible: isVisible,
      isPlaying,
      isFullscreen,
    }),
    [isVisible, isPlaying, isFullscreen]
  );

  // Don't render if no source and no component
  if (!src && !CustomComponent) {
    return null;
  }

  // Render content (image or custom component)
  const renderContent = () => {
    if (CustomComponent) {
      return <CustomComponent {...componentProps} />;
    }

    if (src) {
      return (
        <img
          src={src}
          alt={alt}
          style={contentStyle}
          className="pointer-events-none select-none"
          draggable={false}
        />
      );
    }

    return null;
  };

  // Wrapper component (link or div)
  const isClickable = onClick || href;

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        onClick={onClick ? handleClick : undefined}
        className={cn(
          'absolute z-[15] block',
          isClickable && 'cursor-pointer hover:brightness-110 transition-[filter]',
          !isVisible && 'pointer-events-none',
          configClassName,
          className
        )}
        style={{ ...positionStyle, ...animationStyle }}
      >
        {renderContent()}
      </a>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'absolute z-[15]',
        isClickable && 'cursor-pointer hover:brightness-110 transition-[filter]',
        !isVisible && 'pointer-events-none',
        configClassName,
        className
      )}
      style={{ ...positionStyle, ...animationStyle }}
    >
      {renderContent()}
    </div>
  );
}

export default LogoOverlay;
