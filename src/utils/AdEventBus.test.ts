import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAdEventBus,
  getGlobalAdEventBus,
  resetGlobalAdEventBus,
  type AdEventBus,
} from './AdEventBus';
import type { OverlayAd, InfoCard } from '@/types/video';

// Sample test data
const sampleOverlayAd: OverlayAd = {
  id: 'test-overlay',
  imageUrl: 'https://example.com/ad.png',
  displayAt: 5,
};

const sampleInfoCard: InfoCard = {
  id: 'test-card',
  type: 'product',
  title: 'Test Product',
  displayAt: 10,
};

describe('AdEventBus', () => {
  let eventBus: AdEventBus;

  beforeEach(() => {
    eventBus = createAdEventBus();
  });

  describe('createAdEventBus', () => {
    it('creates a new event bus instance', () => {
      expect(eventBus).toBeDefined();
      expect(eventBus.emit).toBeDefined();
      expect(eventBus.on).toBeDefined();
      expect(eventBus.once).toBeDefined();
      expect(eventBus.off).toBeDefined();
      expect(eventBus.removeAllListeners).toBeDefined();
    });

    it('creates independent instances', () => {
      const eventBus2 = createAdEventBus();
      const listener = vi.fn();

      eventBus.on('showOverlayAd', listener);
      eventBus2.emit('showOverlayAd', sampleOverlayAd);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('emit and on', () => {
    it('emits showOverlayAd event', () => {
      const listener = vi.fn();
      eventBus.on('showOverlayAd', listener);

      eventBus.emit('showOverlayAd', sampleOverlayAd);

      expect(listener).toHaveBeenCalledWith(sampleOverlayAd);
    });

    it('emits hideOverlayAd event', () => {
      const listener = vi.fn();
      eventBus.on('hideOverlayAd', listener);

      eventBus.emit('hideOverlayAd', { id: 'test-overlay' });

      expect(listener).toHaveBeenCalledWith({ id: 'test-overlay' });
    });

    it('emits hideAllOverlayAds event', () => {
      const listener = vi.fn();
      eventBus.on('hideAllOverlayAds', listener);

      eventBus.emit('hideAllOverlayAds');

      expect(listener).toHaveBeenCalled();
    });

    it('emits showInfoCard event', () => {
      const listener = vi.fn();
      eventBus.on('showInfoCard', listener);

      eventBus.emit('showInfoCard', sampleInfoCard);

      expect(listener).toHaveBeenCalledWith(sampleInfoCard);
    });

    it('emits hideInfoCard event', () => {
      const listener = vi.fn();
      eventBus.on('hideInfoCard', listener);

      eventBus.emit('hideInfoCard', { id: 'test-card' });

      expect(listener).toHaveBeenCalledWith({ id: 'test-card' });
    });

    it('emits hideAllInfoCards event', () => {
      const listener = vi.fn();
      eventBus.on('hideAllInfoCards', listener);

      eventBus.emit('hideAllInfoCards');

      expect(listener).toHaveBeenCalled();
    });

    it('emits resetDismissed event', () => {
      const listener = vi.fn();
      eventBus.on('resetDismissed', listener);

      eventBus.emit('resetDismissed');

      expect(listener).toHaveBeenCalled();
    });

    it('supports multiple listeners for same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('showOverlayAd', listener1);
      eventBus.on('showOverlayAd', listener2);

      eventBus.emit('showOverlayAd', sampleOverlayAd);

      expect(listener1).toHaveBeenCalledWith(sampleOverlayAd);
      expect(listener2).toHaveBeenCalledWith(sampleOverlayAd);
    });

    it('does not call listeners for different events', () => {
      const listener = vi.fn();
      eventBus.on('showOverlayAd', listener);

      eventBus.emit('showInfoCard', sampleInfoCard);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('on return value (unsubscribe)', () => {
    it('returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = eventBus.on('showOverlayAd', listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('unsubscribes when unsubscribe function is called', () => {
      const listener = vi.fn();
      const unsubscribe = eventBus.on('showOverlayAd', listener);

      unsubscribe();
      eventBus.emit('showOverlayAd', sampleOverlayAd);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('once', () => {
    it('calls listener only once', () => {
      const listener = vi.fn();
      eventBus.once('showOverlayAd', listener);

      eventBus.emit('showOverlayAd', sampleOverlayAd);
      eventBus.emit('showOverlayAd', sampleOverlayAd);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = eventBus.once('showOverlayAd', listener);

      unsubscribe();
      eventBus.emit('showOverlayAd', sampleOverlayAd);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('off', () => {
    it('removes a specific listener', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('showOverlayAd', listener1);
      eventBus.on('showOverlayAd', listener2);

      eventBus.off('showOverlayAd', listener1);
      eventBus.emit('showOverlayAd', sampleOverlayAd);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith(sampleOverlayAd);
    });

    it('handles removing non-existent listener gracefully', () => {
      const listener = vi.fn();

      expect(() => {
        eventBus.off('showOverlayAd', listener);
      }).not.toThrow();
    });
  });

  describe('removeAllListeners', () => {
    it('removes all listeners for all events', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('showOverlayAd', listener1);
      eventBus.on('showInfoCard', listener2);

      eventBus.removeAllListeners();

      eventBus.emit('showOverlayAd', sampleOverlayAd);
      eventBus.emit('showInfoCard', sampleInfoCard);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('catches errors in listeners and continues execution', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Test error');
      });
      const goodListener = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      eventBus.on('showOverlayAd', errorListener);
      eventBus.on('showOverlayAd', goodListener);

      eventBus.emit('showOverlayAd', sampleOverlayAd);

      expect(errorListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('global event bus', () => {
    beforeEach(() => {
      resetGlobalAdEventBus();
    });

    it('getGlobalAdEventBus returns same instance', () => {
      const global1 = getGlobalAdEventBus();
      const global2 = getGlobalAdEventBus();

      expect(global1).toBe(global2);
    });

    it('resetGlobalAdEventBus clears listeners and creates new instance', () => {
      const global1 = getGlobalAdEventBus();
      const listener = vi.fn();
      global1.on('showOverlayAd', listener);

      resetGlobalAdEventBus();

      const global2 = getGlobalAdEventBus();
      global2.emit('showOverlayAd', sampleOverlayAd);

      expect(listener).not.toHaveBeenCalled();
      expect(global1).not.toBe(global2);
    });
  });

  describe('type safety', () => {
    it('accepts correct payload types', () => {
      // These should all compile without errors
      eventBus.emit('showOverlayAd', sampleOverlayAd);
      eventBus.emit('hideOverlayAd', { id: 'test' });
      eventBus.emit('hideAllOverlayAds');
      eventBus.emit('showInfoCard', sampleInfoCard);
      eventBus.emit('hideInfoCard', { id: 'test' });
      eventBus.emit('hideAllInfoCards');
      eventBus.emit('resetDismissed');

      // Verify no runtime errors
      expect(true).toBe(true);
    });
  });
});
