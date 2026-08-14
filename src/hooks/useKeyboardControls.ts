import { useEffect, useCallback } from 'react';
import type { PlayerControls } from '@/types/player';

export interface UseKeyboardControlsOptions {
  controls?: PlayerControls;
  enabled?: boolean;
  skipAmount?: number;
  volumeStep?: number;
  /**
   * Current volume, 0–1.
   *
   * The arrow-key volume steps are relative, so they need to know where they
   * are starting from. `PlayerControls` is write-only — it has `setVolume` but
   * no way to read the current value — so the caller has to supply it from
   * player state.
   *
   * Without it the up/down arrows do nothing rather than guessing.
   */
  volume?: number;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function useKeyboardControls(options: UseKeyboardControlsOptions): void {
  const {
    controls,
    enabled = true,
    skipAmount = 5,
    volumeStep = 0.1,
    volume,
    containerRef,
  } = options;

  // Early return if no controls provided
  const hasControls = !!controls;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!controls) return;

    // Check if the event target is an input element
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    // If containerRef is provided, only handle events within that container
    if (containerRef?.current && !containerRef.current.contains(target)) {
      return;
    }

    switch (event.key) {
      case ' ':
      case 'k':
        event.preventDefault();
        controls.toggle();
        break;

      case 'ArrowLeft':
        event.preventDefault();
        if (event.shiftKey) {
          controls.skipBackward(skipAmount * 2);
        } else {
          controls.skipBackward(skipAmount);
        }
        break;

      case 'ArrowRight':
        event.preventDefault();
        if (event.shiftKey) {
          controls.skipForward(skipAmount * 2);
        } else {
          controls.skipForward(skipAmount);
        }
        break;

      // Both arms used to read `controls.volume`, which does not exist —
      // `PlayerControls` carries no state. It was always `undefined`, and `??`
      // binds looser than `+`, so the expressions collapsed to
      // `Math.min(1, 1 + step)` and `Math.max(0, 1 - step)`: volume-up jumped
      // straight to 100 % and volume-down always landed on 90 %, whatever the
      // level was. The current volume now comes in as an option.
      case 'ArrowUp':
        event.preventDefault();
        if (volume !== undefined) {
          controls.setVolume(Math.min(1, volume + volumeStep));
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (volume !== undefined) {
          controls.setVolume(Math.max(0, volume - volumeStep));
        }
        break;

      case 'm':
        event.preventDefault();
        controls.toggleMute();
        break;

      case 'j':
        event.preventDefault();
        controls.skipBackward(10);
        break;

      case 'l':
        event.preventDefault();
        controls.skipForward(10);
        break;

      case '0':
      case 'Home':
        event.preventDefault();
        controls.seek(0);
        break;

      case 'End':
        event.preventDefault();
        controls.seekTo(100);
        break;

      default:
        // Handle number keys 1-9 for seeking to percentage
        if (event.key >= '1' && event.key <= '9') {
          event.preventDefault();
          const percentage = parseInt(event.key) * 10;
          controls.seekTo(percentage);
        }
        break;
    }
  }, [controls, skipAmount, volumeStep, volume, containerRef]);

  useEffect(() => {
    if (!enabled || !hasControls) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, hasControls, handleKeyDown]);
}
