import { renderHook } from '@testing-library/react';
import { useKeyboardControls } from './useKeyboardControls';
import type { PlayerControls } from '@/types/player';

function createMockControls(): PlayerControls {
  return {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    toggle: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    seek: vi.fn(),
    seekTo: vi.fn(),
    skipForward: vi.fn(),
    skipBackward: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    setPlaybackRate: vi.fn(),
  };
}

function dispatchKey(
  key: string,
  options: Partial<KeyboardEventInit> = {},
  target: EventTarget = document,
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}

describe('useKeyboardControls', () => {
  let controls: PlayerControls;

  beforeEach(() => {
    controls = createMockControls();
  });

  // ── Basic toggle (Space / k) ────────────────────────────────────────

  it('should toggle play/pause on Space key', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey(' ');
    expect(controls.toggle).toHaveBeenCalledTimes(1);
  });

  it('should toggle play/pause on "k" key', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('k');
    expect(controls.toggle).toHaveBeenCalledTimes(1);
  });

  // ── Arrow seeking ───────────────────────────────────────────────────

  it('should skip backward on ArrowLeft', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('ArrowLeft');
    expect(controls.skipBackward).toHaveBeenCalledWith(5);
  });

  it('should skip backward by double amount on Shift+ArrowLeft', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('ArrowLeft', { shiftKey: true });
    expect(controls.skipBackward).toHaveBeenCalledWith(10);
  });

  it('should skip forward on ArrowRight', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('ArrowRight');
    expect(controls.skipForward).toHaveBeenCalledWith(5);
  });

  it('should skip forward by double amount on Shift+ArrowRight', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('ArrowRight', { shiftKey: true });
    expect(controls.skipForward).toHaveBeenCalledWith(10);
  });

  it('should use custom skipAmount', () => {
    renderHook(() => useKeyboardControls({ controls, skipAmount: 15 }));
    dispatchKey('ArrowRight');
    expect(controls.skipForward).toHaveBeenCalledWith(15);
  });

  it('should use custom skipAmount * 2 with Shift', () => {
    renderHook(() => useKeyboardControls({ controls, skipAmount: 15 }));
    dispatchKey('ArrowLeft', { shiftKey: true });
    expect(controls.skipBackward).toHaveBeenCalledWith(30);
  });

  // ── Volume ──────────────────────────────────────────────────────────

  it('should call setVolume on ArrowUp', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('ArrowUp');
    expect(controls.setVolume).toHaveBeenCalledTimes(1);
  });

  it('should call setVolume on ArrowDown', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('ArrowDown');
    expect(controls.setVolume).toHaveBeenCalledTimes(1);
  });

  // ── Mute ────────────────────────────────────────────────────────────

  it('should toggle mute on "m" key', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('m');
    expect(controls.toggleMute).toHaveBeenCalledTimes(1);
  });

  // ── Skip forward/backward (j/l) ────────────────────────────────────

  it('should skip forward 10s on "l" key', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('l');
    expect(controls.skipForward).toHaveBeenCalledWith(10);
  });

  it('should skip backward 10s on "j" key', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('j');
    expect(controls.skipBackward).toHaveBeenCalledWith(10);
  });

  // ── Seek to start/end ──────────────────────────────────────────────

  it('should seek to start on "0" key', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('0');
    expect(controls.seek).toHaveBeenCalledWith(0);
  });

  it('should seek to start on Home key', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('Home');
    expect(controls.seek).toHaveBeenCalledWith(0);
  });

  it('should seek to end on End key', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('End');
    expect(controls.seekTo).toHaveBeenCalledWith(100);
  });

  // ── Number keys 1-9 (percentage seek) ──────────────────────────────

  it('should seekTo 10% on "1" key', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('1');
    expect(controls.seekTo).toHaveBeenCalledWith(10);
  });

  it('should seekTo 50% on "5" key', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('5');
    expect(controls.seekTo).toHaveBeenCalledWith(50);
  });

  it('should seekTo 90% on "9" key', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('9');
    expect(controls.seekTo).toHaveBeenCalledWith(90);
  });

  // ── preventDefault ─────────────────────────────────────────────────

  it('should call preventDefault on Space key', () => {
    renderHook(() => useKeyboardControls({ controls }));
    const event = dispatchKey(' ');
    expect(event.defaultPrevented).toBe(true);
  });

  it('should call preventDefault on ArrowLeft key', () => {
    renderHook(() => useKeyboardControls({ controls }));
    const event = dispatchKey('ArrowLeft');
    expect(event.defaultPrevented).toBe(true);
  });

  it('should call preventDefault on number keys', () => {
    renderHook(() => useKeyboardControls({ controls }));
    const event = dispatchKey('3');
    expect(event.defaultPrevented).toBe(true);
  });

  // ── Input/textarea/contenteditable filtering ───────────────────────

  it('should not handle keys when target is an INPUT element', () => {
    renderHook(() => useKeyboardControls({ controls }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    dispatchKey(' ', {}, input);
    expect(controls.toggle).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('should not handle keys when target is a TEXTAREA element', () => {
    renderHook(() => useKeyboardControls({ controls }));
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    dispatchKey('k', {}, textarea);
    expect(controls.toggle).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('should not handle keys when target is contentEditable', () => {
    renderHook(() => useKeyboardControls({ controls }));
    const div = document.createElement('div');
    div.contentEditable = 'true';
    // jsdom does not implement isContentEditable, so we mock it
    Object.defineProperty(div, 'isContentEditable', { value: true });
    document.body.appendChild(div);
    dispatchKey(' ', {}, div);
    expect(controls.toggle).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });

  // ── enabled option ─────────────────────────────────────────────────

  it('should be enabled by default', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey(' ');
    expect(controls.toggle).toHaveBeenCalledTimes(1);
  });

  it('should not handle keys when enabled is false', () => {
    renderHook(() => useKeyboardControls({ controls, enabled: false }));
    dispatchKey(' ');
    expect(controls.toggle).not.toHaveBeenCalled();
  });

  it('should start handling keys when enabled changes from false to true', () => {
    const { rerender } = renderHook(
      ({ enabled }) => useKeyboardControls({ controls, enabled }),
      { initialProps: { enabled: false } },
    );

    dispatchKey(' ');
    expect(controls.toggle).not.toHaveBeenCalled();

    rerender({ enabled: true });
    dispatchKey(' ');
    expect(controls.toggle).toHaveBeenCalledTimes(1);
  });

  it('should stop handling keys when enabled changes from true to false', () => {
    const { rerender } = renderHook(
      ({ enabled }) => useKeyboardControls({ controls, enabled }),
      { initialProps: { enabled: true } },
    );

    dispatchKey(' ');
    expect(controls.toggle).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    dispatchKey(' ');
    expect(controls.toggle).toHaveBeenCalledTimes(1); // still 1
  });

  // ── No controls provided ──────────────────────────────────────────

  it('should not throw when controls is undefined', () => {
    expect(() => {
      renderHook(() => useKeyboardControls({}));
      dispatchKey(' ');
    }).not.toThrow();
  });

  // ── containerRef scoping ───────────────────────────────────────────

  it('should only handle keys within the containerRef element', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const containerRef = { current: container };

    renderHook(() => useKeyboardControls({ controls, containerRef }));

    // Event on an element inside the container
    const child = document.createElement('div');
    container.appendChild(child);
    dispatchKey(' ', {}, child);
    expect(controls.toggle).toHaveBeenCalledTimes(1);

    // Event on an element outside the container
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    dispatchKey(' ', {}, outside);
    expect(controls.toggle).toHaveBeenCalledTimes(1); // still 1

    document.body.removeChild(container);
    document.body.removeChild(outside);
  });

  // ── Cleanup ────────────────────────────────────────────────────────

  it('should remove event listener on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardControls({ controls }));
    unmount();
    dispatchKey(' ');
    expect(controls.toggle).not.toHaveBeenCalled();
  });

  // ── Unrecognised keys are ignored ─────────────────────────────────

  it('should not call any control for unrecognised keys', () => {
    renderHook(() => useKeyboardControls({ controls }));
    dispatchKey('x');
    expect(controls.toggle).not.toHaveBeenCalled();
    expect(controls.seek).not.toHaveBeenCalled();
    expect(controls.seekTo).not.toHaveBeenCalled();
    expect(controls.skipForward).not.toHaveBeenCalled();
    expect(controls.skipBackward).not.toHaveBeenCalled();
    expect(controls.setVolume).not.toHaveBeenCalled();
    expect(controls.toggleMute).not.toHaveBeenCalled();
  });
});
