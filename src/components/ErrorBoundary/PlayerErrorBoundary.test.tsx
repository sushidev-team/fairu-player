import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PlayerErrorBoundary } from './PlayerErrorBoundary';
import { createPlayerEventBus } from '@/utils/PlayerEventBus';

/** Throws on render when told to. */
function Boom({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new Error('overlay exploded');
  return <span data-testid="alive">alive</span>;
}

describe('PlayerErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs every caught error itself; the noise would drown the run.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when nothing goes wrong', () => {
    it('renders its children untouched', () => {
      render(
        <PlayerErrorBoundary subsystem="ad-overlay">
          <Boom shouldThrow={false} />
        </PlayerErrorBoundary>
      );

      expect(screen.getByTestId('alive')).toBeInTheDocument();
    });
  });

  describe('when a subsystem throws', () => {
    it('does not take the surrounding player with it', () => {
      // The whole point: React unmounts the entire tree for an uncaught render
      // error, so without this the video disappears because an advert failed.
      render(
        <div>
          <span data-testid="player">the video</span>
          <PlayerErrorBoundary subsystem="ad-overlay">
            <Boom />
          </PlayerErrorBoundary>
        </div>
      );

      expect(screen.getByTestId('player')).toBeInTheDocument();
    });

    it('renders nothing by default', () => {
      // For an overlay, disappearing is the right outcome — an error card over
      // the video would be worse than the thing that broke.
      const { container } = render(
        <PlayerErrorBoundary subsystem="ad-overlay">
          <Boom />
        </PlayerErrorBoundary>
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders a static fallback when given one', () => {
      render(
        <PlayerErrorBoundary subsystem="end-screen" fallback={<span>unavailable</span>}>
          <Boom />
        </PlayerErrorBoundary>
      );

      expect(screen.getByText('unavailable')).toBeInTheDocument();
    });

    it('passes the error to a render-prop fallback', () => {
      render(
        <PlayerErrorBoundary
          subsystem="end-screen"
          fallback={(error) => <span>caught: {error.message}</span>}
        >
          <Boom />
        </PlayerErrorBoundary>
      );

      expect(screen.getByText('caught: overlay exploded')).toBeInTheDocument();
    });

    it('reports through onError', () => {
      const onError = vi.fn();

      render(
        <PlayerErrorBoundary subsystem="ad-overlay" onError={onError}>
          <Boom />
        </PlayerErrorBoundary>
      );

      expect(onError).toHaveBeenCalledOnce();
      expect(onError.mock.calls[0][0].message).toBe('overlay exploded');
    });

    it('emits subsystemError on the bus', () => {
      const bus = createPlayerEventBus();
      const listener = vi.fn();
      bus.on('subsystemError', listener);

      render(
        <PlayerErrorBoundary subsystem="ad-overlay" playerEventBus={bus}>
          <Boom />
        </PlayerErrorBoundary>
      );

      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][0]).toMatchObject({ subsystem: 'ad-overlay' });
      expect(listener.mock.calls[0][0].error).toBeInstanceOf(Error);
    });

    it('names the subsystem in the console', () => {
      // A host page that wires up nothing still has to be able to find out
      // which feature it silently lost.
      render(
        <PlayerErrorBoundary subsystem="companion-slot">
          <Boom />
        </PlayerErrorBoundary>
      );

      const logged = consoleError.mock.calls.map((call: unknown[]) => String(call[0])).join(' ');
      expect(logged).toContain('companion-slot');
    });

    it('works without a bus or a callback', () => {
      expect(() =>
        render(
          <PlayerErrorBoundary subsystem="ad-overlay">
            <Boom />
          </PlayerErrorBoundary>
        )
      ).not.toThrow();
    });
  });

  describe('recovering', () => {
    it('stays in the fallback until something changes', () => {
      // A boundary latches on purpose: re-rendering the same broken subtree
      // would just throw again, in a loop.
      const { rerender } = render(
        <PlayerErrorBoundary subsystem="ad-overlay" fallback={<span>gone</span>}>
          <Boom />
        </PlayerErrorBoundary>
      );

      rerender(
        <PlayerErrorBoundary subsystem="ad-overlay" fallback={<span>gone</span>}>
          <Boom shouldThrow={false} />
        </PlayerErrorBoundary>
      );

      expect(screen.getByText('gone')).toBeInTheDocument();
    });

    it('remounts when a reset key changes', () => {
      // The next ad deserves a fresh start; failing on one creative should not
      // disable the overlay for the session.
      const { rerender } = render(
        <PlayerErrorBoundary subsystem="ad-overlay" resetKeys={['ad-1']}>
          <Boom />
        </PlayerErrorBoundary>
      );

      rerender(
        <PlayerErrorBoundary subsystem="ad-overlay" resetKeys={['ad-2']}>
          <Boom shouldThrow={false} />
        </PlayerErrorBoundary>
      );

      expect(screen.getByTestId('alive')).toBeInTheDocument();
    });

    it('ignores a reset key that did not change', () => {
      const { rerender } = render(
        <PlayerErrorBoundary subsystem="ad-overlay" resetKeys={['ad-1']} fallback={<span>gone</span>}>
          <Boom />
        </PlayerErrorBoundary>
      );

      rerender(
        <PlayerErrorBoundary subsystem="ad-overlay" resetKeys={['ad-1']} fallback={<span>gone</span>}>
          <Boom shouldThrow={false} />
        </PlayerErrorBoundary>
      );

      expect(screen.getByText('gone')).toBeInTheDocument();
    });

    it('remounts when the number of reset keys changes', () => {
      const { rerender } = render(
        <PlayerErrorBoundary subsystem="ad-overlay" resetKeys={['a']}>
          <Boom />
        </PlayerErrorBoundary>
      );

      rerender(
        <PlayerErrorBoundary subsystem="ad-overlay" resetKeys={['a', 'b']}>
          <Boom shouldThrow={false} />
        </PlayerErrorBoundary>
      );

      expect(screen.getByTestId('alive')).toBeInTheDocument();
    });

    it('offers a retry to a render-prop fallback', () => {
      let retryFn: (() => void) | null = null;

      const { rerender } = render(
        <PlayerErrorBoundary
          subsystem="ad-overlay"
          fallback={(_, retry) => {
            retryFn = retry;
            return <span>gone</span>;
          }}
        >
          <Boom />
        </PlayerErrorBoundary>
      );

      expect(retryFn).toBeInstanceOf(Function);

      rerender(
        <PlayerErrorBoundary
          subsystem="ad-overlay"
          fallback={(_, retry) => {
            retryFn = retry;
            return <span>gone</span>;
          }}
        >
          <Boom shouldThrow={false} />
        </PlayerErrorBoundary>
      );
      act(() => retryFn!());

      expect(screen.getByTestId('alive')).toBeInTheDocument();
    });
  });
});
