import '@testing-library/jest-dom';

/**
 * Everything below patches gaps in jsdom, so it only applies where there is a
 * DOM. The SSR spec deliberately runs in the `node` environment to prove the
 * package can be imported on a server, and this file runs before it — without
 * this guard it would be the thing that crashes, not the code under test.
 */
const hasDom = typeof window !== 'undefined';

if (hasDom) {

  // Mock window.open
  Object.defineProperty(window, 'open', {
    writable: true,
    value: () => null,
  });

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // Mock ResizeObserver
  (globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserver }).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock HTMLMediaElement methods
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    writable: true,
    value: () => Promise.resolve(),
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    writable: true,
    value: () => {},
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    configurable: true,
    writable: true,
    value: () => {},
  });

  // jsdom has no PointerEvent constructor, so fireEvent silently drops
  // `pointerId` and `isPrimary` from its init dict. Any component that guards on
  // those (multi-touch handling, pointer capture) then looks broken in tests while
  // being correct in a browser. This minimal implementation carries the fields
  // through.
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      readonly isPrimary: boolean;
      readonly width: number;
      readonly height: number;
      readonly pressure: number;

      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
        this.pointerType = params.pointerType ?? 'mouse';
        this.isPrimary = params.isPrimary ?? true;
        this.width = params.width ?? 1;
        this.height = params.height ?? 1;
        this.pressure = params.pressure ?? 0;
      }
    }

    Object.defineProperty(window, 'PointerEvent', {
      configurable: true,
      writable: true,
      value: PointerEventPolyfill,
    });
  }

  // Pointer capture is not implemented in jsdom and throws when called.
  for (const method of ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const) {
    if (typeof Element.prototype[method] !== 'function') {
      Object.defineProperty(Element.prototype, method, {
        configurable: true,
        writable: true,
        value: () => (method === 'hasPointerCapture' ? false : undefined),
      });
    }
  }
}
