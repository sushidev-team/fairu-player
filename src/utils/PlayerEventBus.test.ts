import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createPlayerEventBus,
  getGlobalPlayerEventBus,
  resetGlobalPlayerEventBus,
  type PlayerEventBus,
} from './PlayerEventBus';

describe('PlayerEventBus', () => {
  let bus: PlayerEventBus;

  beforeEach(() => {
    bus = createPlayerEventBus();
  });

  afterEach(() => {
    resetGlobalPlayerEventBus();
    vi.restoreAllMocks();
  });

  describe('emit', () => {
    it('calls a subscribed listener', () => {
      const listener = vi.fn();
      bus.on('enterPictureInPicture', listener);

      bus.emit('enterPictureInPicture');

      expect(listener).toHaveBeenCalledOnce();
    });

    it('passes the payload through', () => {
      const listener = vi.fn();
      bus.on('tabVisible', listener);

      bus.emit('tabVisible', { timestamp: 1000, hiddenDuration: 42 });

      expect(listener).toHaveBeenCalledWith({ timestamp: 1000, hiddenDuration: 42 });
    });

    it('calls every listener for the event', () => {
      const a = vi.fn();
      const b = vi.fn();
      bus.on('castStart', a);
      bus.on('castStart', b);

      bus.emit('castStart');

      expect(a).toHaveBeenCalledOnce();
      expect(b).toHaveBeenCalledOnce();
    });

    it('does not call listeners of other events', () => {
      const pip = vi.fn();
      const cast = vi.fn();
      bus.on('enterPictureInPicture', pip);
      bus.on('castStart', cast);

      bus.emit('castStart');

      expect(pip).not.toHaveBeenCalled();
    });

    it('is a no-op for an event nobody subscribed to', () => {
      expect(() => bus.emit('triggerReturnAd', { hiddenDuration: 5 })).not.toThrow();
    });

    it('deduplicates an identical listener registered twice', () => {
      // Backed by a Set, so the same function reference cannot be double-added.
      const listener = vi.fn();
      bus.on('castStop', listener);
      bus.on('castStop', listener);

      bus.emit('castStop');

      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('listener errors', () => {
    it('still runs the remaining listeners when one throws', () => {
      // A crash in a host page's analytics callback must not stop the player's
      // own listeners from running.
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const survivor = vi.fn();

      bus.on('tabHidden', () => {
        throw new Error('listener blew up');
      });
      bus.on('tabHidden', survivor);

      expect(() => bus.emit('tabHidden', { timestamp: 1 })).not.toThrow();
      expect(survivor).toHaveBeenCalledOnce();
      expect(consoleError).toHaveBeenCalled();
    });

    it('names the event in the logged error', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      bus.on('castStart', () => {
        throw new Error('boom');
      });

      bus.emit('castStart');

      expect(consoleError.mock.calls[0][0]).toContain('castStart');
    });
  });

  describe('on', () => {
    it('returns an unsubscribe function', () => {
      const listener = vi.fn();
      const off = bus.on('castStart', listener);

      off();
      bus.emit('castStart');

      expect(listener).not.toHaveBeenCalled();
    });

    it('unsubscribing twice is harmless', () => {
      const listener = vi.fn();
      const off = bus.on('castStart', listener);

      off();
      expect(() => off()).not.toThrow();
    });

    it('unsubscribing one listener leaves the others', () => {
      const a = vi.fn();
      const b = vi.fn();
      const offA = bus.on('castStart', a);
      bus.on('castStart', b);

      offA();
      bus.emit('castStart');

      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalledOnce();
    });
  });

  describe('once', () => {
    it('fires only on the first emit', () => {
      const listener = vi.fn();
      bus.once('enterPictureInPicture', listener);

      bus.emit('enterPictureInPicture');
      bus.emit('enterPictureInPicture');
      bus.emit('enterPictureInPicture');

      expect(listener).toHaveBeenCalledOnce();
    });

    it('receives the payload', () => {
      const listener = vi.fn();
      bus.once('triggerReturnAd', listener);

      bus.emit('triggerReturnAd', { hiddenDuration: 12 });

      expect(listener).toHaveBeenCalledWith({ hiddenDuration: 12 });
    });

    it('can be cancelled before it ever fires', () => {
      const listener = vi.fn();
      const off = bus.once('castStart', listener);

      off();
      bus.emit('castStart');

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not disturb a permanent listener on the same event', () => {
      const onceListener = vi.fn();
      const permanent = vi.fn();
      bus.once('castStart', onceListener);
      bus.on('castStart', permanent);

      bus.emit('castStart');
      bus.emit('castStart');

      expect(onceListener).toHaveBeenCalledOnce();
      expect(permanent).toHaveBeenCalledTimes(2);
    });
  });

  describe('off', () => {
    it('removes the listener', () => {
      const listener = vi.fn();
      bus.on('tabHidden', listener);

      bus.off('tabHidden', listener);
      bus.emit('tabHidden', { timestamp: 1 });

      expect(listener).not.toHaveBeenCalled();
    });

    it('is a no-op for an event that has no listeners', () => {
      expect(() => bus.off('castStop', vi.fn())).not.toThrow();
    });

    it('is a no-op for a listener that was never registered', () => {
      bus.on('castStop', vi.fn());
      expect(() => bus.off('castStop', vi.fn())).not.toThrow();
    });
  });

  describe('removeAllListeners', () => {
    it('clears listeners across every event', () => {
      const a = vi.fn();
      const b = vi.fn();
      bus.on('castStart', a);
      bus.on('tabHidden', b);

      bus.removeAllListeners();
      bus.emit('castStart');
      bus.emit('tabHidden', { timestamp: 1 });

      expect(a).not.toHaveBeenCalled();
      expect(b).not.toHaveBeenCalled();
    });

    it('leaves the bus usable afterwards', () => {
      bus.on('castStart', vi.fn());
      bus.removeAllListeners();

      const listener = vi.fn();
      bus.on('castStart', listener);
      bus.emit('castStart');

      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('instances are independent', () => {
    it('does not leak listeners between buses', () => {
      const other = createPlayerEventBus();
      const listener = vi.fn();
      bus.on('castStart', listener);

      other.emit('castStart');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('global instance', () => {
    it('returns the same bus on repeated calls', () => {
      expect(getGlobalPlayerEventBus()).toBe(getGlobalPlayerEventBus());
    });

    it('reset clears its listeners and yields a fresh instance', () => {
      const first = getGlobalPlayerEventBus();
      const listener = vi.fn();
      first.on('castStart', listener);

      resetGlobalPlayerEventBus();
      const second = getGlobalPlayerEventBus();

      expect(second).not.toBe(first);
      second.emit('castStart');
      expect(listener).not.toHaveBeenCalled();
    });

    it('reset is safe before the global bus has been created', () => {
      resetGlobalPlayerEventBus();
      expect(() => resetGlobalPlayerEventBus()).not.toThrow();
    });
  });
});
