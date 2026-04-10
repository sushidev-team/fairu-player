import { renderHook, act } from '@testing-library/react';
import { useTabVisibility } from './useTabVisibility';

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    writable: true,
    configurable: true,
    value: hidden,
  });
  Object.defineProperty(document, 'visibilityState', {
    writable: true,
    configurable: true,
    value: hidden ? 'hidden' : 'visible',
  });
}

function fireVisibilityChange() {
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useTabVisibility', () => {
  beforeEach(() => {
    // Reset to visible for each test
    setDocumentHidden(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Initial state ──────────────────────────────────────────────────

  it('should return isTabVisible true when document is visible', () => {
    setDocumentHidden(false);
    const { result } = renderHook(() => useTabVisibility());
    expect(result.current.isTabVisible).toBe(true);
  });

  it('should return isTabVisible false when document starts hidden', () => {
    setDocumentHidden(true);
    const { result } = renderHook(() => useTabVisibility());
    expect(result.current.isTabVisible).toBe(false);
  });

  it('should have null hiddenSince initially when tab is visible', () => {
    setDocumentHidden(false);
    const { result } = renderHook(() => useTabVisibility());
    expect(result.current.hiddenSince).toBeNull();
  });

  // ── Visibility changes ─────────────────────────────────────────────

  it('should update isTabVisible to false when tab becomes hidden', () => {
    const { result } = renderHook(() => useTabVisibility());

    act(() => {
      setDocumentHidden(true);
      fireVisibilityChange();
    });

    expect(result.current.isTabVisible).toBe(false);
  });

  it('should update isTabVisible to true when tab becomes visible again', () => {
    const { result } = renderHook(() => useTabVisibility());

    act(() => {
      setDocumentHidden(true);
      fireVisibilityChange();
    });

    act(() => {
      setDocumentHidden(false);
      fireVisibilityChange();
    });

    expect(result.current.isTabVisible).toBe(true);
  });

  // ── onHidden callback ─────────────────────────────────────────────

  it('should call onHidden when tab becomes hidden', () => {
    const onHidden = vi.fn();
    renderHook(() => useTabVisibility({ onHidden }));

    act(() => {
      setDocumentHidden(true);
      fireVisibilityChange();
    });

    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it('should not call onHidden when tab becomes visible', () => {
    const onHidden = vi.fn();
    renderHook(() => useTabVisibility({ onHidden }));

    act(() => {
      setDocumentHidden(true);
      fireVisibilityChange();
    });
    onHidden.mockClear();

    act(() => {
      setDocumentHidden(false);
      fireVisibilityChange();
    });

    expect(onHidden).not.toHaveBeenCalled();
  });

  // ── onVisible callback ────────────────────────────────────────────

  it('should call onVisible when tab becomes visible', () => {
    const onVisible = vi.fn();
    renderHook(() => useTabVisibility({ onVisible }));

    act(() => {
      setDocumentHidden(true);
      fireVisibilityChange();
    });

    act(() => {
      setDocumentHidden(false);
      fireVisibilityChange();
    });

    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it('should not call onVisible when tab becomes hidden', () => {
    const onVisible = vi.fn();
    renderHook(() => useTabVisibility({ onVisible }));

    act(() => {
      setDocumentHidden(true);
      fireVisibilityChange();
    });

    expect(onVisible).not.toHaveBeenCalled();
  });

  // ── hiddenDuration ─────────────────────────────────────────────────

  it('should pass hiddenDuration in seconds to onVisible', () => {
    const onVisible = vi.fn();
    renderHook(() => useTabVisibility({ onVisible }));

    act(() => {
      setDocumentHidden(true);
      fireVisibilityChange();
    });

    // Advance time by 5 seconds
    vi.advanceTimersByTime(5000);

    act(() => {
      setDocumentHidden(false);
      fireVisibilityChange();
    });

    expect(onVisible).toHaveBeenCalledTimes(1);
    const hiddenDuration = onVisible.mock.calls[0][0];
    expect(hiddenDuration).toBeCloseTo(5, 0);
  });

  it('should pass 0 as hiddenDuration when onVisible called without prior hidden', () => {
    const onVisible = vi.fn();
    renderHook(() => useTabVisibility({ onVisible }));

    // Directly fire visible without going hidden first
    act(() => {
      setDocumentHidden(false);
      fireVisibilityChange();
    });

    expect(onVisible).toHaveBeenCalledTimes(1);
    expect(onVisible).toHaveBeenCalledWith(0);
  });

  it('should track different hidden durations across multiple hide/show cycles', () => {
    const onVisible = vi.fn();
    renderHook(() => useTabVisibility({ onVisible }));

    // First cycle: 2 seconds hidden
    act(() => {
      setDocumentHidden(true);
      fireVisibilityChange();
    });
    vi.advanceTimersByTime(2000);
    act(() => {
      setDocumentHidden(false);
      fireVisibilityChange();
    });

    // Second cycle: 10 seconds hidden
    act(() => {
      setDocumentHidden(true);
      fireVisibilityChange();
    });
    vi.advanceTimersByTime(10000);
    act(() => {
      setDocumentHidden(false);
      fireVisibilityChange();
    });

    expect(onVisible).toHaveBeenCalledTimes(2);
    expect(onVisible.mock.calls[0][0]).toBeCloseTo(2, 0);
    expect(onVisible.mock.calls[1][0]).toBeCloseTo(10, 0);
  });

  // ── Ref-based callbacks (no stale closures) ───────────────────────

  it('should use the latest onHidden callback without re-registering listener', () => {
    const onHidden1 = vi.fn();
    const onHidden2 = vi.fn();

    const { rerender } = renderHook(
      ({ onHidden }) => useTabVisibility({ onHidden }),
      { initialProps: { onHidden: onHidden1 } },
    );

    rerender({ onHidden: onHidden2 });

    act(() => {
      setDocumentHidden(true);
      fireVisibilityChange();
    });

    expect(onHidden1).not.toHaveBeenCalled();
    expect(onHidden2).toHaveBeenCalledTimes(1);
  });

  it('should use the latest onVisible callback without re-registering listener', () => {
    const onVisible1 = vi.fn();
    const onVisible2 = vi.fn();

    const { rerender } = renderHook(
      ({ onVisible }) => useTabVisibility({ onVisible }),
      { initialProps: { onVisible: onVisible1 } },
    );

    rerender({ onVisible: onVisible2 });

    act(() => {
      setDocumentHidden(true);
      fireVisibilityChange();
    });
    act(() => {
      setDocumentHidden(false);
      fireVisibilityChange();
    });

    expect(onVisible1).not.toHaveBeenCalled();
    expect(onVisible2).toHaveBeenCalledTimes(1);
  });

  // ── No callbacks provided ─────────────────────────────────────────

  it('should work correctly without any callbacks', () => {
    const { result } = renderHook(() => useTabVisibility());

    act(() => {
      setDocumentHidden(true);
      fireVisibilityChange();
    });

    expect(result.current.isTabVisible).toBe(false);

    act(() => {
      setDocumentHidden(false);
      fireVisibilityChange();
    });

    expect(result.current.isTabVisible).toBe(true);
  });

  // ── Cleanup ────────────────────────────────────────────────────────

  it('should remove visibilitychange listener on unmount', () => {
    const onHidden = vi.fn();
    const { unmount } = renderHook(() => useTabVisibility({ onHidden }));
    unmount();

    act(() => {
      setDocumentHidden(true);
      fireVisibilityChange();
    });

    expect(onHidden).not.toHaveBeenCalled();
  });

  // ── Default options ───────────────────────────────────────────────

  it('should accept empty options object', () => {
    expect(() => {
      renderHook(() => useTabVisibility({}));
    }).not.toThrow();
  });

  it('should accept no arguments', () => {
    expect(() => {
      renderHook(() => useTabVisibility());
    }).not.toThrow();
  });
});
