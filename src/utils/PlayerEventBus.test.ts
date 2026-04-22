import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPlayerEventBus,
  getGlobalPlayerEventBus,
  resetGlobalPlayerEventBus,
  type PlayerEventBus,
} from './PlayerEventBus';

describe('PlayerEventBus', () => {
  let eventBus: PlayerEventBus;

  beforeEach(() => {
    eventBus = createPlayerEventBus();
  });

  describe('createPlayerEventBus', () => {
    it('creates a new event bus instance', () => {
      expect(eventBus).toBeDefined();
      expect(eventBus.emit).toBeDefined();
      expect(eventBus.on).toBeDefined();
      expect(eventBus.once).toBeDefined();
      expect(eventBus.off).toBeDefined();
      expect(eventBus.removeAllListeners).toBeDefined();
    });

    it('creates independent instances', () => {
      const eventBus2 = createPlayerEventBus();
      const listener = vi.fn();

      eventBus.on('enterPictureInPicture', listener);
      eventBus2.emit('enterPictureInPicture');

      expect(listener).not.toHaveBeenCalled();
    });

    it('creates instances that do not share listeners', () => {
      const bus1 = createPlayerEventBus();
      const bus2 = createPlayerEventBus();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      bus1.on('castStart', listener1);
      bus2.on('castStart', listener2);

      bus1.emit('castStart');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe('emit and on - void events', () => {
    it('emits enterPictureInPicture event', () => {
      const listener = vi.fn();
      eventBus.on('enterPictureInPicture', listener);

      eventBus.emit('enterPictureInPicture');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('emits exitPictureInPicture event', () => {
      const listener = vi.fn();
      eventBus.on('exitPictureInPicture', listener);

      eventBus.emit('exitPictureInPicture');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('emits castStart event', () => {
      const listener = vi.fn();
      eventBus.on('castStart', listener);

      eventBus.emit('castStart');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('emits castStop event', () => {
      const listener = vi.fn();
      eventBus.on('castStop', listener);

      eventBus.emit('castStop');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('passes undefined payload for void events', () => {
      const listener = vi.fn();
      eventBus.on('enterPictureInPicture', listener);

      eventBus.emit('enterPictureInPicture');

      expect(listener).toHaveBeenCalledWith(undefined);
    });
  });

  describe('emit and on - payload events', () => {
    it('emits tabHidden event with timestamp payload', () => {
      const listener = vi.fn();
      eventBus.on('tabHidden', listener);

      eventBus.emit('tabHidden', { timestamp: 1000 });

      expect(listener).toHaveBeenCalledWith({ timestamp: 1000 });
    });

    it('emits tabVisible event with timestamp and hiddenDuration payload', () => {
      const listener = vi.fn();
      eventBus.on('tabVisible', listener);

      eventBus.emit('tabVisible', { timestamp: 2000, hiddenDuration: 1000 });

      expect(listener).toHaveBeenCalledWith({ timestamp: 2000, hiddenDuration: 1000 });
    });

    it('emits triggerReturnAd event with hiddenDuration payload', () => {
      const listener = vi.fn();
      eventBus.on('triggerReturnAd', listener);

      eventBus.emit('triggerReturnAd', { hiddenDuration: 5000 });

      expect(listener).toHaveBeenCalledWith({ hiddenDuration: 5000 });
    });
  });

  describe('multiple listeners', () => {
    it('supports multiple listeners for the same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      eventBus.on('enterPictureInPicture', listener1);
      eventBus.on('enterPictureInPicture', listener2);
      eventBus.on('enterPictureInPicture', listener3);

      eventBus.emit('enterPictureInPicture');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('does not call listeners for different events', () => {
      const pipListener = vi.fn();
      const castListener = vi.fn();

      eventBus.on('enterPictureInPicture', pipListener);
      eventBus.on('castStart', castListener);

      eventBus.emit('enterPictureInPicture');

      expect(pipListener).toHaveBeenCalledTimes(1);
      expect(castListener).not.toHaveBeenCalled();
    });

    it('calls each listener with the correct payload', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('tabHidden', listener1);
      eventBus.on('tabHidden', listener2);

      eventBus.emit('tabHidden', { timestamp: 42 });

      expect(listener1).toHaveBeenCalledWith({ timestamp: 42 });
      expect(listener2).toHaveBeenCalledWith({ timestamp: 42 });
    });
  });

  describe('emit with no listeners', () => {
    it('does not throw when emitting with no listeners registered', () => {
      expect(() => {
        eventBus.emit('enterPictureInPicture');
      }).not.toThrow();
    });

    it('does not throw when emitting payload event with no listeners', () => {
      expect(() => {
        eventBus.emit('tabHidden', { timestamp: 100 });
      }).not.toThrow();
    });
  });

  describe('on return value (unsubscribe)', () => {
    it('returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = eventBus.on('enterPictureInPicture', listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('unsubscribes when unsubscribe function is called', () => {
      const listener = vi.fn();
      const unsubscribe = eventBus.on('enterPictureInPicture', listener);

      unsubscribe();
      eventBus.emit('enterPictureInPicture');

      expect(listener).not.toHaveBeenCalled();
    });

    it('only unsubscribes the specific listener', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsubscribe1 = eventBus.on('castStart', listener1);
      eventBus.on('castStart', listener2);

      unsubscribe1();
      eventBus.emit('castStart');

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('handles double unsubscribe gracefully', () => {
      const listener = vi.fn();
      const unsubscribe = eventBus.on('castStop', listener);

      unsubscribe();
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('once', () => {
    it('calls listener only once for void events', () => {
      const listener = vi.fn();
      eventBus.once('enterPictureInPicture', listener);

      eventBus.emit('enterPictureInPicture');
      eventBus.emit('enterPictureInPicture');
      eventBus.emit('enterPictureInPicture');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('calls listener only once for payload events', () => {
      const listener = vi.fn();
      eventBus.once('tabHidden', listener);

      eventBus.emit('tabHidden', { timestamp: 1 });
      eventBus.emit('tabHidden', { timestamp: 2 });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ timestamp: 1 });
    });

    it('returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = eventBus.once('exitPictureInPicture', listener);

      unsubscribe();
      eventBus.emit('exitPictureInPicture');

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not affect other listeners on the same event', () => {
      const onceListener = vi.fn();
      const regularListener = vi.fn();

      eventBus.once('castStart', onceListener);
      eventBus.on('castStart', regularListener);

      eventBus.emit('castStart');
      eventBus.emit('castStart');

      expect(onceListener).toHaveBeenCalledTimes(1);
      expect(regularListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('off', () => {
    it('removes a specific listener', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('tabHidden', listener1);
      eventBus.on('tabHidden', listener2);

      eventBus.off('tabHidden', listener1);
      eventBus.emit('tabHidden', { timestamp: 99 });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith({ timestamp: 99 });
    });

    it('handles removing non-existent listener gracefully', () => {
      const listener = vi.fn();

      expect(() => {
        eventBus.off('enterPictureInPicture', listener);
      }).not.toThrow();
    });

    it('handles off on event type with no listeners registered', () => {
      const listener = vi.fn();

      expect(() => {
        eventBus.off('castStop', listener);
      }).not.toThrow();
    });

    it('does not affect other events when removing a listener', () => {
      const listener = vi.fn();

      eventBus.on('enterPictureInPicture', listener);
      eventBus.on('exitPictureInPicture', listener);

      eventBus.off('enterPictureInPicture', listener);

      eventBus.emit('enterPictureInPicture');
      eventBus.emit('exitPictureInPicture');

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeAllListeners', () => {
    it('removes all listeners for all events', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      eventBus.on('enterPictureInPicture', listener1);
      eventBus.on('tabHidden', listener2);
      eventBus.on('triggerReturnAd', listener3);

      eventBus.removeAllListeners();

      eventBus.emit('enterPictureInPicture');
      eventBus.emit('tabHidden', { timestamp: 1 });
      eventBus.emit('triggerReturnAd', { hiddenDuration: 5 });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).not.toHaveBeenCalled();
    });

    it('allows adding new listeners after removeAllListeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('castStart', listener1);
      eventBus.removeAllListeners();

      eventBus.on('castStart', listener2);
      eventBus.emit('castStart');

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('does not throw when called on empty bus', () => {
      expect(() => {
        eventBus.removeAllListeners();
      }).not.toThrow();
    });
  });

  describe('error handling in listeners', () => {
    it('catches errors in listeners and continues execution', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      eventBus.on('enterPictureInPicture', errorListener);
      eventBus.on('enterPictureInPicture', goodListener);

      eventBus.emit('enterPictureInPicture');

      expect(errorListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('logs error with event name in the message', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Test error');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      eventBus.on('tabHidden', errorListener);
      eventBus.emit('tabHidden', { timestamp: 1 });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('tabHidden'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('continues calling remaining listeners after an error', () => {
      const listeners = [vi.fn(), vi.fn(() => { throw new Error('fail'); }), vi.fn()];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      listeners.forEach((l) => eventBus.on('castStart', l));
      eventBus.emit('castStart');

      expect(listeners[0]).toHaveBeenCalledTimes(1);
      expect(listeners[1]).toHaveBeenCalledTimes(1);
      expect(listeners[2]).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });
  });

  describe('global event bus', () => {
    beforeEach(() => {
      resetGlobalPlayerEventBus();
    });

    it('getGlobalPlayerEventBus returns a PlayerEventBus instance', () => {
      const global = getGlobalPlayerEventBus();

      expect(global).toBeDefined();
      expect(global.emit).toBeDefined();
      expect(global.on).toBeDefined();
      expect(global.off).toBeDefined();
      expect(global.once).toBeDefined();
      expect(global.removeAllListeners).toBeDefined();
    });

    it('getGlobalPlayerEventBus returns the same instance on multiple calls', () => {
      const global1 = getGlobalPlayerEventBus();
      const global2 = getGlobalPlayerEventBus();

      expect(global1).toBe(global2);
    });

    it('global event bus is functional', () => {
      const global = getGlobalPlayerEventBus();
      const listener = vi.fn();

      global.on('castStart', listener);
      global.emit('castStart');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('resetGlobalPlayerEventBus clears listeners and creates new instance', () => {
      const global1 = getGlobalPlayerEventBus();
      const listener = vi.fn();
      global1.on('enterPictureInPicture', listener);

      resetGlobalPlayerEventBus();

      const global2 = getGlobalPlayerEventBus();
      global2.emit('enterPictureInPicture');

      expect(listener).not.toHaveBeenCalled();
      expect(global1).not.toBe(global2);
    });

    it('resetGlobalPlayerEventBus does not throw when called without prior get', () => {
      expect(() => {
        resetGlobalPlayerEventBus();
      }).not.toThrow();
    });

    it('resetGlobalPlayerEventBus can be called multiple times safely', () => {
      getGlobalPlayerEventBus();

      expect(() => {
        resetGlobalPlayerEventBus();
        resetGlobalPlayerEventBus();
      }).not.toThrow();
    });
  });

  describe('type safety (runtime verification)', () => {
    it('accepts correct payload types for all events', () => {
      eventBus.emit('enterPictureInPicture');
      eventBus.emit('exitPictureInPicture');
      eventBus.emit('castStart');
      eventBus.emit('castStop');
      eventBus.emit('tabHidden', { timestamp: 123 });
      eventBus.emit('tabVisible', { timestamp: 456, hiddenDuration: 333 });
      eventBus.emit('triggerReturnAd', { hiddenDuration: 999 });

      expect(true).toBe(true);
    });
  });
});
