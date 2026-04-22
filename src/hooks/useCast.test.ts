import { renderHook, act } from '@testing-library/react';
import { useCast } from './useCast';

/** Create a full Remote Playback API mock suitable for both prototype and instance. */
function createRemoteMock() {
  return {
    prompt: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

/** Create a plain video element with Remote Playback API mock on the instance. */
function createVideoWithRemote() {
  const video = document.createElement('video') as HTMLVideoElement;
  const remote = createRemoteMock();

  Object.defineProperty(video, 'remote', {
    configurable: true,
    value: remote,
  });

  return { video, remote };
}

/** Create a video element with WebKit AirPlay APIs. */
function createVideoWithAirPlay() {
  const video = document.createElement('video') as HTMLVideoElement & {
    webkitShowPlaybackTargetPicker: () => void;
    webkitCurrentPlaybackTargetIsWireless: boolean;
  };

  video.webkitShowPlaybackTargetPicker = vi.fn();
  Object.defineProperty(video, 'webkitCurrentPlaybackTargetIsWireless', {
    writable: true,
    configurable: true,
    value: false,
  });

  return video;
}

describe('useCast', () => {
  // ── Initial state ─────────────────────────────────────────────────

  it('should return isCasting false initially', () => {
    const { video } = createVideoWithRemote();
    const ref = { current: video };
    const { result } = renderHook(() => useCast(ref));
    expect(result.current.isCasting).toBe(false);
  });

  it('should return toggleCast as a function', () => {
    const ref = { current: document.createElement('video') };
    const { result } = renderHook(() => useCast(ref));
    expect(typeof result.current.toggleCast).toBe('function');
  });

  // ── isSupported detection ─────────────────────────────────────────

  it('should detect support when Remote Playback API is available on prototype', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      'remote',
    );

    // Set a full remote mock on the prototype so the effect doesn't crash
    const remoteMock = createRemoteMock();
    Object.defineProperty(HTMLVideoElement.prototype, 'remote', {
      configurable: true,
      value: remoteMock,
    });

    const ref = { current: document.createElement('video') };
    const { result, unmount } = renderHook(() => useCast(ref));
    expect(result.current.isSupported).toBe(true);

    // Unmount before restoring, so the cleanup can still access video.remote
    unmount();

    // Restore to avoid polluting other tests
    if (originalDescriptor) {
      Object.defineProperty(HTMLVideoElement.prototype, 'remote', originalDescriptor);
    } else {
      delete (HTMLVideoElement.prototype as unknown as Record<string, unknown>).remote;
    }
  });

  it('should detect support when webkitShowPlaybackTargetPicker is on the element', () => {
    const video = createVideoWithAirPlay();
    const ref = { current: video };
    const { result } = renderHook(() => useCast(ref));
    expect(result.current.isSupported).toBe(true);
  });

  it('should return isSupported false when no cast APIs are available', () => {
    // Ensure the prototype doesn't have remote
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      'remote',
    );
    if (originalDescriptor) {
      delete (HTMLVideoElement.prototype as unknown as Record<string, unknown>).remote;
    }

    try {
      const video = document.createElement('video');
      const ref = { current: video };
      const { result } = renderHook(() => useCast(ref));
      expect(result.current.isSupported).toBe(false);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(HTMLVideoElement.prototype, 'remote', originalDescriptor);
      }
    }
  });

  it('should evaluate support on mount using the video element', () => {
    // Ensure the prototype doesn't have remote so support comes from the instance
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      'remote',
    );
    if (originalDescriptor) {
      delete (HTMLVideoElement.prototype as unknown as Record<string, unknown>).remote;
    }

    try {
      // Mount with an AirPlay-capable video element already set
      const video = createVideoWithAirPlay();
      const ref = { current: video };
      const { result } = renderHook(() => useCast(ref));
      expect(result.current.isSupported).toBe(true);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(HTMLVideoElement.prototype, 'remote', originalDescriptor);
      }
    }
  });

  it('should evaluate as unsupported when videoRef is null on mount', () => {
    // Ensure the prototype doesn't have remote
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      'remote',
    );
    if (originalDescriptor) {
      delete (HTMLVideoElement.prototype as unknown as Record<string, unknown>).remote;
    }

    try {
      const ref = { current: null as HTMLVideoElement | null };
      const { result } = renderHook(() => useCast(ref));
      expect(result.current.isSupported).toBe(false);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(HTMLVideoElement.prototype, 'remote', originalDescriptor);
      }
    }
  });

  // ── toggleCast (Remote Playback / Chromecast) ─────────────────────

  it('should call video.remote.prompt() when Remote Playback is available', async () => {
    const { video, remote } = createVideoWithRemote();
    const ref = { current: video };
    const { result } = renderHook(() => useCast(ref));

    await act(async () => {
      await result.current.toggleCast();
    });

    expect(remote.prompt).toHaveBeenCalledTimes(1);
  });

  it('should handle NotAllowedError silently (user cancelled picker)', async () => {
    const { video, remote } = createVideoWithRemote();
    const error = new DOMException('User cancelled', 'NotAllowedError');
    remote.prompt.mockRejectedValueOnce(error);

    const ref = { current: video };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useCast(ref));

    await act(async () => {
      await result.current.toggleCast();
    });

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should log other errors from remote.prompt()', async () => {
    const { video, remote } = createVideoWithRemote();
    const error = new Error('Some network error');
    remote.prompt.mockRejectedValueOnce(error);

    const ref = { current: video };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useCast(ref));

    await act(async () => {
      await result.current.toggleCast();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to open cast picker:', error);
    consoleSpy.mockRestore();
  });

  // ── toggleCast (AirPlay) ──────────────────────────────────────────

  it('should call webkitShowPlaybackTargetPicker when AirPlay is available', async () => {
    const video = createVideoWithAirPlay();
    const ref = { current: video };
    const { result } = renderHook(() => useCast(ref));

    await act(async () => {
      await result.current.toggleCast();
    });

    expect(video.webkitShowPlaybackTargetPicker).toHaveBeenCalledTimes(1);
  });

  it('should prefer AirPlay over Remote Playback when both are available', async () => {
    const video = createVideoWithAirPlay();
    // Also add remote
    const remote = createRemoteMock();
    Object.defineProperty(video, 'remote', {
      configurable: true,
      value: remote,
    });

    const ref = { current: video };
    const { result } = renderHook(() => useCast(ref));

    await act(async () => {
      await result.current.toggleCast();
    });

    expect(video.webkitShowPlaybackTargetPicker).toHaveBeenCalledTimes(1);
    expect(remote.prompt).not.toHaveBeenCalled();
  });

  // ── toggleCast with null videoRef ─────────────────────────────────

  it('should do nothing when videoRef.current is null', async () => {
    const ref = { current: null as HTMLVideoElement | null };
    const { result } = renderHook(() => useCast(ref));

    await act(async () => {
      await result.current.toggleCast();
    });
    // No errors thrown
  });

  // ── Remote Playback event listeners ───────────────────────────────

  it('should register connect/disconnect listeners on video.remote', () => {
    const { video, remote } = createVideoWithRemote();
    const ref = { current: video };
    renderHook(() => useCast(ref));

    expect(remote.addEventListener).toHaveBeenCalledWith(
      'connect',
      expect.any(Function),
    );
    expect(remote.addEventListener).toHaveBeenCalledWith(
      'disconnect',
      expect.any(Function),
    );
  });

  it('should set isCasting to true on remote connect event', () => {
    const { video, remote } = createVideoWithRemote();
    const ref = { current: video };
    const { result } = renderHook(() => useCast(ref));

    const connectCall = (remote.addEventListener.mock.calls as [string, Function][]).find(
      (c) => c[0] === 'connect',
    )!;
    const connectHandler = connectCall[1];

    act(() => {
      connectHandler();
    });

    expect(result.current.isCasting).toBe(true);
  });

  it('should set isCasting to false on remote disconnect event', () => {
    const { video, remote } = createVideoWithRemote();
    const ref = { current: video };
    const { result } = renderHook(() => useCast(ref));

    // First connect
    const connectCall = (remote.addEventListener.mock.calls as [string, Function][]).find(
      (c) => c[0] === 'connect',
    )!;
    act(() => {
      connectCall[1]();
    });
    expect(result.current.isCasting).toBe(true);

    // Then disconnect
    const disconnectCall = (remote.addEventListener.mock.calls as [string, Function][]).find(
      (c) => c[0] === 'disconnect',
    )!;
    act(() => {
      disconnectCall[1]();
    });
    expect(result.current.isCasting).toBe(false);
  });

  it('should remove remote event listeners on unmount', () => {
    const { video, remote } = createVideoWithRemote();
    const ref = { current: video };
    const { unmount } = renderHook(() => useCast(ref));

    unmount();

    expect(remote.removeEventListener).toHaveBeenCalledWith(
      'connect',
      expect.any(Function),
    );
    expect(remote.removeEventListener).toHaveBeenCalledWith(
      'disconnect',
      expect.any(Function),
    );
  });

  // ── AirPlay event listeners ───────────────────────────────────────

  it('should register wireless change listener for AirPlay', () => {
    const video = createVideoWithAirPlay();
    const addSpy = vi.spyOn(video, 'addEventListener');
    const ref = { current: video };
    renderHook(() => useCast(ref));

    expect(addSpy).toHaveBeenCalledWith(
      'webkitcurrentplaybacktargetiswirelesschanged',
      expect.any(Function),
    );
  });

  it('should update isCasting when AirPlay wireless state changes', () => {
    const video = createVideoWithAirPlay();
    const ref = { current: video };
    const { result } = renderHook(() => useCast(ref));

    (video as unknown as { webkitCurrentPlaybackTargetIsWireless: boolean })
      .webkitCurrentPlaybackTargetIsWireless = true;

    act(() => {
      video.dispatchEvent(
        new Event('webkitcurrentplaybacktargetiswirelesschanged'),
      );
    });

    expect(result.current.isCasting).toBe(true);
  });

  it('should update isCasting to false when AirPlay disconnects', () => {
    const video = createVideoWithAirPlay();
    const ref = { current: video };
    const { result } = renderHook(() => useCast(ref));

    // First connect
    (video as unknown as { webkitCurrentPlaybackTargetIsWireless: boolean })
      .webkitCurrentPlaybackTargetIsWireless = true;
    act(() => {
      video.dispatchEvent(
        new Event('webkitcurrentplaybacktargetiswirelesschanged'),
      );
    });
    expect(result.current.isCasting).toBe(true);

    // Then disconnect
    (video as unknown as { webkitCurrentPlaybackTargetIsWireless: boolean })
      .webkitCurrentPlaybackTargetIsWireless = false;
    act(() => {
      video.dispatchEvent(
        new Event('webkitcurrentplaybacktargetiswirelesschanged'),
      );
    });
    expect(result.current.isCasting).toBe(false);
  });

  it('should remove AirPlay listener on unmount', () => {
    const video = createVideoWithAirPlay();
    const removeSpy = vi.spyOn(video, 'removeEventListener');
    const ref = { current: video };
    const { unmount } = renderHook(() => useCast(ref));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      'webkitcurrentplaybacktargetiswirelesschanged',
      expect.any(Function),
    );
  });

  // ── onChange callback ─────────────────────────────────────────────

  it('should call onChange with true when casting starts (Remote Playback)', () => {
    const onChange = vi.fn();
    const { video, remote } = createVideoWithRemote();
    const ref = { current: video };
    renderHook(() => useCast(ref, { onChange }));

    const connectCall = (remote.addEventListener.mock.calls as [string, Function][]).find(
      (c) => c[0] === 'connect',
    )!;

    act(() => {
      connectCall[1]();
    });

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('should call onChange with false when casting stops (Remote Playback)', () => {
    const onChange = vi.fn();
    const { video, remote } = createVideoWithRemote();
    const ref = { current: video };
    renderHook(() => useCast(ref, { onChange }));

    const disconnectCall = (remote.addEventListener.mock.calls as [string, Function][]).find(
      (c) => c[0] === 'disconnect',
    )!;

    act(() => {
      disconnectCall[1]();
    });

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('should call onChange when AirPlay state changes', () => {
    const onChange = vi.fn();
    const video = createVideoWithAirPlay();
    const ref = { current: video };
    renderHook(() => useCast(ref, { onChange }));

    (video as unknown as { webkitCurrentPlaybackTargetIsWireless: boolean })
      .webkitCurrentPlaybackTargetIsWireless = true;
    act(() => {
      video.dispatchEvent(
        new Event('webkitcurrentplaybacktargetiswirelesschanged'),
      );
    });

    expect(onChange).toHaveBeenCalledWith(true);
  });

  // ── No video element ──────────────────────────────────────────────

  it('should handle null videoRef gracefully in effect', () => {
    const ref = { current: null as HTMLVideoElement | null };
    expect(() => {
      renderHook(() => useCast(ref));
    }).not.toThrow();
  });
});
