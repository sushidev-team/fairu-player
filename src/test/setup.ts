import '@testing-library/jest-dom';

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

// Mock IntersectionObserver
(globalThis as typeof globalThis & { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = class IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
} as unknown as typeof IntersectionObserver;

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

// Mock Fullscreen API
Object.defineProperty(document, 'fullscreenElement', {
  writable: true,
  value: null,
});

Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
  configurable: true,
  writable: true,
  value: () => Promise.resolve(),
});

Object.defineProperty(document, 'exitFullscreen', {
  configurable: true,
  writable: true,
  value: () => Promise.resolve(),
});

// Mock Picture-in-Picture API
Object.defineProperty(document, 'pictureInPictureElement', {
  writable: true,
  value: null,
});

Object.defineProperty(HTMLVideoElement.prototype, 'requestPictureInPicture', {
  configurable: true,
  writable: true,
  value: () => Promise.resolve(document.createElement('div')),
});

Object.defineProperty(document, 'exitPictureInPicture', {
  configurable: true,
  writable: true,
  value: () => Promise.resolve(),
});

Object.defineProperty(document, 'pictureInPictureEnabled', {
  writable: true,
  value: true,
});

// Mock navigator.mediaSession
Object.defineProperty(navigator, 'mediaSession', {
  writable: true,
  value: {
    metadata: null,
    playbackState: 'none',
    setActionHandler: vi.fn(),
    setPositionState: vi.fn(),
  },
});
