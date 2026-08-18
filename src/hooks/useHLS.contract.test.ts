/**
 * The parts of hls.js this player actually calls, checked against the real
 * library rather than a stand-in.
 *
 * `useHLS.test.ts` replaces hls.js wholesale, which is right for testing our
 * wiring but leaves one blind spot: if a version bump renamed or removed
 * something we call, every one of those tests would still pass. The mock would
 * happily answer for an API that no longer exists.
 *
 * hls.js is also the one dependency that parses untrusted network input, so it
 * is the one most worth keeping current — which means bumps will happen, and
 * this is what makes them safe to take.
 *
 * Keep this list in step with what the hook and VideoAdContext use. A failure
 * here is a real incompatibility, not a flaky test.
 */

import { describe, it, expect } from 'vitest';
import Hls from 'hls.js';

describe('hls.js contract', () => {
  describe('statics', () => {
    it('exposes isSupported', () => {
      expect(typeof Hls.isSupported).toBe('function');
    });

    it('answers isSupported without throwing', () => {
      // Called during render on every page with an HLS source, so it has to be
      // safe to invoke in any environment — including one with no MediaSource.
      expect(() => Hls.isSupported()).not.toThrow();
    });
  });

  describe('events we subscribe to', () => {
    it.each(['MANIFEST_PARSED', 'LEVEL_SWITCHED', 'LEVEL_LOADED', 'ERROR'])(
      'Hls.Events.%s exists',
      (event) => {
        expect(Hls.Events[event as keyof typeof Hls.Events]).toBeDefined();
      }
    );
  });

  describe('error types we branch on', () => {
    it.each(['NETWORK_ERROR', 'MEDIA_ERROR'])(
      'Hls.ErrorTypes.%s exists',
      (type) => {
        expect(Hls.ErrorTypes[type as keyof typeof Hls.ErrorTypes]).toBeDefined();
      }
    );
  });

  describe('instance methods we call', () => {
    it.each([
      'on',
      'loadSource',
      'attachMedia',
      'destroy',
      // The two recovery paths. Losing either would turn a recoverable stream
      // error into a dead player, silently.
      'startLoad',
      'recoverMediaError',
    ])('hls.%s() exists', (method) => {
      expect(typeof (Hls.prototype as unknown as Record<string, unknown>)[method]).toBe(
        'function'
      );
    });

    it('currentLevel is a writable property', () => {
      // Quality switching assigns to it rather than calling a setter method;
      // a change to that shape would break every level change.
      const descriptor = Object.getOwnPropertyDescriptor(Hls.prototype, 'currentLevel');
      expect(descriptor).toBeDefined();
      expect(descriptor?.set).toBeInstanceOf(Function);
    });
  });

  describe('constructor options we pass', () => {
    it('accepts the config shape the hook builds', () => {
      if (!Hls.isSupported()) return;

      expect(
        () =>
          new Hls({
            startLevel: -1,
            enableWorker: true,
            lowLatencyMode: false,
            maxBufferLength: 30,
          }).destroy()
      ).not.toThrow();
    });
  });
});
