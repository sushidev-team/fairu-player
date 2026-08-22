import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardControls } from './useKeyboardControls';
import type { PlayerControls } from '@/types/player';

function makeControls(): PlayerControls {
  return {
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    toggle: vi.fn(async () => {}),
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

/** Dispatch a keydown as the browser would, from a given target. */
function press(
  key: string,
  options: { shiftKey?: boolean; target?: HTMLElement } = {}
) {
  const event = new KeyboardEvent('keydown', {
    key,
    shiftKey: options.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  (options.target ?? document.body).dispatchEvent(event);
  return event;
}

describe('useKeyboardControls', () => {
  let controls: PlayerControls;

  beforeEach(() => {
    document.body.innerHTML = '';
    controls = makeControls();
  });

  describe('play/pause', () => {
    it.each([' ', 'k'])('toggles on "%s"', (key) => {
      renderHook(() => useKeyboardControls({ controls }));
      press(key);
      expect(controls.toggle).toHaveBeenCalledOnce();
    });

    it('prevents the default so space does not scroll the page', () => {
      renderHook(() => useKeyboardControls({ controls }));
      const event = press(' ');
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('seeking', () => {
    it('skips back by skipAmount on ArrowLeft', () => {
      renderHook(() => useKeyboardControls({ controls, skipAmount: 5 }));
      press('ArrowLeft');
      expect(controls.skipBackward).toHaveBeenCalledWith(5);
    });

    it('skips forward by skipAmount on ArrowRight', () => {
      renderHook(() => useKeyboardControls({ controls, skipAmount: 5 }));
      press('ArrowRight');
      expect(controls.skipForward).toHaveBeenCalledWith(5);
    });

    it('doubles the step with shift', () => {
      renderHook(() => useKeyboardControls({ controls, skipAmount: 5 }));

      press('ArrowLeft', { shiftKey: true });
      expect(controls.skipBackward).toHaveBeenCalledWith(10);

      press('ArrowRight', { shiftKey: true });
      expect(controls.skipForward).toHaveBeenCalledWith(10);
    });

    it('honours a custom skipAmount', () => {
      renderHook(() => useKeyboardControls({ controls, skipAmount: 30 }));
      press('ArrowRight');
      expect(controls.skipForward).toHaveBeenCalledWith(30);
    });

    it('uses a fixed 10s for j and l regardless of skipAmount', () => {
      // The YouTube bindings, which are 10s by convention rather than by config.
      renderHook(() => useKeyboardControls({ controls, skipAmount: 5 }));

      press('j');
      expect(controls.skipBackward).toHaveBeenCalledWith(10);

      press('l');
      expect(controls.skipForward).toHaveBeenCalledWith(10);
    });

    it.each(['0', 'Home'])('seeks to the start on "%s"', (key) => {
      renderHook(() => useKeyboardControls({ controls }));
      press(key);
      expect(controls.seek).toHaveBeenCalledWith(0);
    });

    it('seeks to the end on End', () => {
      renderHook(() => useKeyboardControls({ controls }));
      press('End');
      expect(controls.seekTo).toHaveBeenCalledWith(100);
    });

    it.each([
      ['1', 10],
      ['5', 50],
      ['9', 90],
    ])('seeks to %s0%% on "%s"', (key, percentage) => {
      renderHook(() => useKeyboardControls({ controls }));
      press(key);
      expect(controls.seekTo).toHaveBeenCalledWith(percentage);
    });
  });

  describe('volume', () => {
    // Regression cover for the precedence bug: `controls.volume ?? 1 + step`
    // parsed as `controls.volume ?? (1 + step)`, and `controls` never had a
    // `volume`, so up jumped to 100 % and down always landed on 90 %.
    it('steps up from the current volume', () => {
      renderHook(() => useKeyboardControls({ controls, volume: 0.5, volumeStep: 0.1 }));
      press('ArrowUp');
      expect(controls.setVolume).toHaveBeenCalledWith(0.6);
    });

    it('steps down from the current volume', () => {
      renderHook(() => useKeyboardControls({ controls, volume: 0.5, volumeStep: 0.1 }));
      press('ArrowDown');
      expect(controls.setVolume).toHaveBeenCalledWith(0.4);
    });

    it('does not step past 1', () => {
      renderHook(() => useKeyboardControls({ controls, volume: 0.95, volumeStep: 0.1 }));
      press('ArrowUp');
      expect(controls.setVolume).toHaveBeenCalledWith(1);
    });

    it('does not step below 0', () => {
      renderHook(() => useKeyboardControls({ controls, volume: 0.05, volumeStep: 0.1 }));
      press('ArrowDown');
      expect(controls.setVolume).toHaveBeenCalledWith(0);
    });

    it('honours a custom volumeStep', () => {
      renderHook(() => useKeyboardControls({ controls, volume: 0.5, volumeStep: 0.25 }));
      press('ArrowUp');
      expect(controls.setVolume).toHaveBeenCalledWith(0.75);
    });

    it('does nothing when the current volume was not supplied', () => {
      // Better than guessing: the old code silently jumped to full volume.
      renderHook(() => useKeyboardControls({ controls }));
      press('ArrowUp');
      press('ArrowDown');
      expect(controls.setVolume).not.toHaveBeenCalled();
    });

    it('still swallows the arrow keys so the page does not scroll', () => {
      renderHook(() => useKeyboardControls({ controls }));
      expect(press('ArrowUp').defaultPrevented).toBe(true);
      expect(press('ArrowDown').defaultPrevented).toBe(true);
    });

    it('toggles mute on m', () => {
      renderHook(() => useKeyboardControls({ controls }));
      press('m');
      expect(controls.toggleMute).toHaveBeenCalledOnce();
    });
  });

  describe('typing must not control the player', () => {
    it.each(['INPUT', 'TEXTAREA'])('ignores keys from a %s', (tag) => {
      const field = document.createElement(tag);
      document.body.appendChild(field);

      renderHook(() => useKeyboardControls({ controls }));
      press(' ', { target: field as HTMLElement });

      expect(controls.toggle).not.toHaveBeenCalled();
    });

    it('ignores keys from a contenteditable element', () => {
      const editor = document.createElement('div');
      editor.setAttribute('contenteditable', 'true');
      // jsdom does not derive isContentEditable from the attribute.
      Object.defineProperty(editor, 'isContentEditable', { value: true });
      document.body.appendChild(editor);

      renderHook(() => useKeyboardControls({ controls }));
      press(' ', { target: editor });

      expect(controls.toggle).not.toHaveBeenCalled();
    });
  });

  describe('containerRef scoping', () => {
    it('handles keys from inside the container', () => {
      const container = document.createElement('div');
      const child = document.createElement('button');
      container.appendChild(child);
      document.body.appendChild(container);

      const ref = { current: container } as React.RefObject<HTMLElement | null>;

      renderHook(() => useKeyboardControls({ controls, containerRef: ref }));
      press('k', { target: child });

      expect(controls.toggle).toHaveBeenCalledOnce();
    });

    it('ignores keys from outside the container', () => {
      // Two players on one page must not both react to the same keystroke.
      const container = document.createElement('div');
      const outside = document.createElement('button');
      document.body.append(container, outside);

      const ref = { current: container } as React.RefObject<HTMLElement | null>;

      renderHook(() => useKeyboardControls({ controls, containerRef: ref }));
      press('k', { target: outside });

      expect(controls.toggle).not.toHaveBeenCalled();
    });

    it('handles keys globally when the ref is empty', () => {
      const ref = { current: null } as React.RefObject<HTMLElement | null>;

      renderHook(() => useKeyboardControls({ controls, containerRef: ref }));
      press('k');

      expect(controls.toggle).toHaveBeenCalledOnce();
    });
  });

  describe('enabling and teardown', () => {
    it('does nothing when disabled', () => {
      renderHook(() => useKeyboardControls({ controls, enabled: false }));
      press('k');
      expect(controls.toggle).not.toHaveBeenCalled();
    });

    it('does nothing without controls', () => {
      expect(() => {
        renderHook(() => useKeyboardControls({}));
        press('k');
      }).not.toThrow();
    });

    it('detaches its listener on unmount', () => {
      const { unmount } = renderHook(() => useKeyboardControls({ controls }));

      unmount();
      press('k');

      expect(controls.toggle).not.toHaveBeenCalled();
    });

    it('stops reacting when it is switched off after mount', () => {
      const { rerender } = renderHook(
        ({ enabled }) => useKeyboardControls({ controls, enabled }),
        { initialProps: { enabled: true } }
      );

      rerender({ enabled: false });
      press('k');

      expect(controls.toggle).not.toHaveBeenCalled();
    });
  });

  describe('unbound keys', () => {
    it.each(['a', 'Escape', 'Tab', 'F1'])('ignores "%s"', (key) => {
      renderHook(() => useKeyboardControls({ controls, volume: 0.5 }));
      const event = press(key);

      expect(event.defaultPrevented).toBe(false);
      expect(controls.toggle).not.toHaveBeenCalled();
      expect(controls.seekTo).not.toHaveBeenCalled();
    });
  });
});
