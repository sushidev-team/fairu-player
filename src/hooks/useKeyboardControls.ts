import { useEffect, useCallback } from 'react';
import type { PlayerControls, Chapter } from '@/types/player';

export interface UseKeyboardControlsOptions {
  controls?: PlayerControls;
  enabled?: boolean;
  skipAmount?: number;
  volumeStep?: number;
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Chapters for [ / ] key navigation */
  chapters?: Chapter[];
  /** Current playback time, needed for chapter navigation */
  currentTime?: number;
  /** A-B loop controls for keyboard shortcuts */
  abLoopControls?: { setA: (time?: number) => void; setB: (time?: number) => void; clearLoop: () => void };
}

export function useKeyboardControls(options: UseKeyboardControlsOptions): void {
  const {
    controls,
    enabled = true,
    skipAmount = 5,
    volumeStep = 0.1,
    containerRef,
    chapters,
    currentTime = 0,
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

      case '[':
        // Jump to previous chapter start
        if (chapters && chapters.length > 0) {
          event.preventDefault();
          // Find the chapter that starts before the current time (with a small tolerance)
          const tolerance = 1;
          let prevChapter: typeof chapters[0] | null = null;
          for (let i = chapters.length - 1; i >= 0; i--) {
            if (chapters[i].startTime < currentTime - tolerance) {
              prevChapter = chapters[i];
              break;
            }
          }
          if (prevChapter) {
            controls.seek(prevChapter.startTime);
          } else {
            // Already at or before first chapter, seek to beginning
            controls.seek(0);
          }
        }
        break;

      case ']':
        // Jump to next chapter start
        if (chapters && chapters.length > 0) {
          event.preventDefault();
          const nextChapter = chapters.find(
            (ch) => ch.startTime > currentTime + 0.5
          );
          if (nextChapter) {
            controls.seek(nextChapter.startTime);
          }
        }
        break;

      case 'A': // Shift+A: Set loop point A
        if (options.abLoopControls) {
          event.preventDefault();
          options.abLoopControls.setA();
        }
        break;

      case 'B': // Shift+B: Set loop point B
        if (options.abLoopControls) {
          event.preventDefault();
          options.abLoopControls.setB();
        }
        break;

      case 'Backspace': // Clear A-B loop
        if (options.abLoopControls) {
          event.preventDefault();
          options.abLoopControls.clearLoop();
        }
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
  }, [controls, skipAmount, volumeStep, containerRef, chapters, currentTime, options.abLoopControls]);

  useEffect(() => {
    if (!enabled || !hasControls) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, hasControls, handleKeyDown]);
}
