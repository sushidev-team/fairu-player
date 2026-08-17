import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { PlayerEventBus } from '@/utils/PlayerEventBus';

export interface PlayerErrorBoundaryProps {
  children: ReactNode;
  /**
   * What crashed, in words. Goes into the emitted event and the log line, so
   * make it something a host page can act on: `"ad-overlay"`, `"end-screen"`.
   */
  subsystem: string;
  /**
   * What to show instead. Defaults to nothing at all — for an overlay or a
   * companion slot, silently disappearing is the correct outcome, and an error
   * card over the video would be worse than the thing that broke.
   */
  fallback?: ReactNode | ((error: Error, retry: () => void) => ReactNode);
  /** Reported alongside the bus event. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Emits `subsystemError` so a host page can log it. */
  playerEventBus?: PlayerEventBus;
  /**
   * Remount the subtree when any of these change.
   *
   * A boundary latches: once it has caught, it keeps showing the fallback until
   * something tells it the situation changed. Passing the current track id here
   * means an overlay that failed on one ad gets a fresh start on the next one,
   * rather than staying dead for the session.
   */
  resetKeys?: unknown[];
}

interface State {
  error: Error | null;
}

/**
 * Keeps one broken subsystem from taking the player down.
 *
 * React unmounts the *entire* tree when a render throws and nothing catches it.
 * Without a boundary, a malformed VAST creative or a null dereference in an
 * end-screen blanks the video that was playing perfectly well — the viewer
 * loses the content because an advert failed.
 *
 * So the boundaries go around the parts that are allowed to fail: ads,
 * overlays, end screens. Not around the media element, which is the thing worth
 * protecting.
 */
export class PlayerErrorBoundary extends Component<PlayerErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const { subsystem, onError, playerEventBus } = this.props;

    // Logged as well as emitted: a host page that wires up the bus gets a
    // structured event, and one that does not still sees it in the console
    // rather than silently losing a feature.
    console.error(`[fairu-player] ${subsystem} crashed and was disabled:`, error);

    onError?.(error, info);
    playerEventBus?.emit('subsystemError', {
      subsystem,
      error,
      componentStack: info.componentStack ?? undefined,
    });
  }

  componentDidUpdate(prev: PlayerErrorBoundaryProps): void {
    if (!this.state.error) return;

    const { resetKeys } = this.props;
    if (!resetKeys || !prev.resetKeys) return;

    const changed =
      resetKeys.length !== prev.resetKeys.length ||
      resetKeys.some((key, i) => !Object.is(key, prev.resetKeys![i]));

    if (changed) this.reset();
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;
    if (typeof fallback === 'function') return fallback(error, this.reset);
    return fallback ?? null;
  }
}

export default PlayerErrorBoundary;
