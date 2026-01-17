/**
 * Logo/Watermark types for video player
 */

/**
 * Logo position in the video player
 */
export type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Animation type for logo appearance
 */
export type LogoAnimationType = 'none' | 'fade' | 'slide' | 'scale';

/**
 * Logo animation configuration
 */
export interface LogoAnimation {
  /** Animation type on appear (default: 'fade') */
  type?: LogoAnimationType;
  /** Animation duration in ms (default: 300) */
  duration?: number;
  /** Delay before animation starts in ms (default: 0) */
  delay?: number;
}

/**
 * Props passed to custom logo components
 */
export interface LogoComponentProps {
  /** Whether the logo is currently visible */
  visible: boolean;
  /** Whether the video is playing */
  isPlaying: boolean;
  /** Whether fullscreen mode is active */
  isFullscreen: boolean;
}

/**
 * Logo configuration for video player
 */
export interface LogoConfig {
  /** Image source URL (PNG, SVG, GIF, WebP, etc.) */
  src?: string;
  /** Custom React component to render (for Lottie, animated logos, etc.) */
  component?: React.ComponentType<LogoComponentProps>;
  /** Alt text for accessibility (required when using src) */
  alt?: string;
  /** Position in video player (default: 'bottom-right') */
  position?: LogoPosition;
  /** Logo width in pixels (default: auto, max 120px) */
  width?: number;
  /** Logo height in pixels (default: auto, max 60px) */
  height?: number;
  /** Opacity 0-1 (default: 0.8) */
  opacity?: number;
  /** Margin from edge in pixels (default: 16) */
  margin?: number;
  /** Horizontal offset from position in pixels (positive = right, negative = left) */
  offsetX?: number;
  /** Vertical offset from position in pixels (positive = down, negative = up) */
  offsetY?: number;
  /** Animation configuration */
  animation?: LogoAnimation;
  /** Hide logo when controls are hidden (default: false) */
  hideWithControls?: boolean;
  /** Click handler (e.g., open website) */
  onClick?: () => void;
  /** URL to navigate to on click (alternative to onClick) */
  href?: string;
  /** Open link in new tab (default: true) */
  target?: '_blank' | '_self';
  /** Additional CSS class */
  className?: string;
}
