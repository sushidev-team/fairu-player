import { useEffect, useCallback } from 'react';
import type { PlayerControls } from '@/types/player';

export interface UseKeyboardControlsOptions {
  controls: PlayerControls;
  enabled?: boolean;
  skipAmount?: number;
  volumeStep?: number;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function useKeyboardControls(options: UseKeyboardControlsOptions): void {
  const {
    controls,
    enabled = true,
    skipAmount = 5,
    volumeStep = 0.1,
    containerRef,
  } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
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

      case 'ArrowUp':
        event.preventDefault();
        controls.setVolume(Math.min(1, (controls as unknown as { volume?: number }).volume ?? 1 + volumeStep));
        break;

      case 'ArrowDown':
        event.preventDefault();
        controls.setVolume(Math.max(0, (controls as unknown as { volume?: number }).volume ?? 1 - volumeStep));
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
  }, [controls, skipAmount, volumeStep, containerRef]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}
