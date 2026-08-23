import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { useMedia } from './useMedia';

const SRC = 'https://cdn.example.com/clip.mp4';
const OTHER = 'https://cdn.example.com/other.mp4';

/**
 * Keeps one `useMedia` instance alive while swapping the element its ref points
 * at. `key` forces React to create a new DOM node rather than reuse the old one.
 */
function Harness({ swap, src = SRC }: { swap: boolean; src?: string }) {
  const { mediaRef } = useMedia<HTMLVideoElement>({ src });
  return (
    <video
      key={swap ? 'b' : 'a'}
      ref={mediaRef as React.RefObject<HTMLVideoElement>}
      data-testid="media"
    />
  );
}

describe('useMedia source handling', () => {
  it('applies the source on mount', () => {
    const { getByTestId } = render(<Harness swap={false} />);
    expect((getByTestId('media') as HTMLVideoElement).src).toBe(SRC);
  });

  it('re-applies the source when the element is replaced under a living hook', () => {
    // The regression this guards: a ref change is invisible to React's
    // dependency tracking, so a `[src]`-gated effect never notices that the
    // media element was swapped. The new element then sits with an empty `src`
    // — a poster and a permanent spinner, and no error anywhere.
    const { getByTestId, rerender } = render(<Harness swap={false} />);
    const first = getByTestId('media') as HTMLVideoElement;
    expect(first.src).toBe(SRC);

    rerender(<Harness swap />);
    const second = getByTestId('media') as HTMLVideoElement;

    expect(second).not.toBe(first);
    expect(second.src).toBe(SRC);
  });

  it('still follows an ordinary source change', () => {
    const { getByTestId, rerender } = render(<Harness swap={false} />);
    expect((getByTestId('media') as HTMLVideoElement).src).toBe(SRC);

    rerender(<Harness swap={false} src={OTHER} />);
    expect((getByTestId('media') as HTMLVideoElement).src).toBe(OTHER);
  });

  it('does not reload when nothing changed', () => {
    const { getByTestId, rerender } = render(<Harness swap={false} />);
    const media = getByTestId('media') as HTMLVideoElement;

    let loads = 0;
    Object.defineProperty(media, 'load', {
      configurable: true,
      value: () => {
        loads += 1;
      },
    });

    rerender(<Harness swap={false} />);
    rerender(<Harness swap={false} />);
    rerender(<Harness swap={false} />);

    // The effect runs every render by design; the guard must make it a no-op.
    expect(loads).toBe(0);
  });
});

describe('before an element is attached', () => {
  it('reports the same state object across renders', () => {
    const seen: unknown[] = [];
    let rerender: (n: number) => void = () => {};

    function Probe() {
      const [, setTick] = useState(0);
      rerender = setTick;
      // Options built inline, which is what every caller does — `useVideo`
      // spreads a fresh object on every render.
      const { state } = useMedia({ volume: 0.5, muted: true });
      seen.push(state);
      return null;
    }

    render(<Probe />);
    act(() => rerender(1));
    act(() => rerender(2));

    // `useSyncExternalStore` compares snapshots by identity, so a fresh object
    // per render would make a hook with no element look like it changed on
    // every render of its parent.
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });

  it('seeds the snapshot from the options', () => {
    let captured: { volume: number; isMuted: boolean; playbackRate: number } | null = null;

    function Probe() {
      const { state } = useMedia({ volume: 0.25, muted: true, playbackRate: 1.5 });
      captured = state;
      return null;
    }

    render(<Probe />);

    // A volume slider has to render at the configured level on the first frame
    // rather than jump once the element attaches.
    expect(captured).toMatchObject({ volume: 0.25, isMuted: true, playbackRate: 1.5 });
  });
});
