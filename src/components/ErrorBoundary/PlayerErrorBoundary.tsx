import { Component, type ReactNode, type ErrorInfo } from 'react';
import { cn } from '@/utils/cn';

export interface PlayerErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI. If not provided, uses default fallback */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Additional CSS classes for the fallback container */
  className?: string;
  /** If true, shows a minimal inline fallback instead of a full block */
  inline?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for catching render errors in the player.
 * Provides a graceful fallback UI when an error occurs.
 */
export class PlayerErrorBoundary extends Component<PlayerErrorBoundaryProps, State> {
  constructor(props: PlayerErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    const { fallback, className, inline } = this.props;
    const error = this.state.error;

    // Custom fallback (ReactNode or render function)
    if (fallback !== undefined) {
      if (typeof fallback === 'function') {
        return fallback(error, this.reset);
      }
      return fallback;
    }

    // Inline variant: compact single-line fallback
    if (inline) {
      return (
        <div
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg',
            'bg-[var(--fp-glass-bg)] border border-[var(--fp-glass-border)]',
            'text-[var(--fp-color-text)] text-sm',
            className
          )}
        >
          <svg
            className="w-4 h-4 text-red-400 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Error</span>
          <button
            onClick={this.reset}
            className={cn(
              'ml-1 p-1 rounded-md transition-colors',
              'hover:bg-white/10 text-[var(--fp-color-text-secondary)]',
              'hover:text-[var(--fp-color-text)]'
            )}
            aria-label="Retry"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      );
    }

    // Default block fallback
    const truncatedMessage =
      error.message.length > 100
        ? `${error.message.slice(0, 100)}...`
        : error.message;

    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 p-6 rounded-xl',
          'bg-[var(--fp-glass-bg)] backdrop-blur-[20px]',
          'border border-[var(--fp-glass-border)]',
          'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
          className
        )}
      >
        {/* Warning triangle icon */}
        <svg
          className="w-10 h-10 text-red-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>

        <p className="text-[var(--fp-color-text)] text-sm font-medium">
          Something went wrong
        </p>

        {truncatedMessage && (
          <p className="text-[var(--fp-color-text-secondary)] text-xs text-center max-w-xs">
            {truncatedMessage}
          </p>
        )}

        <button
          onClick={this.reset}
          className={cn(
            'mt-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            'bg-[var(--fp-glass-bg)] border border-[var(--fp-glass-border)]',
            'text-[var(--fp-color-text)]',
            'hover:bg-white/10'
          )}
        >
          Try Again
        </button>
      </div>
    );
  }
}
