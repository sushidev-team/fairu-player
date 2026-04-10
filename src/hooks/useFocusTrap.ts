import { useEffect, useRef, useCallback } from 'react';

export interface UseFocusTrapOptions {
  /** Whether the focus trap is active */
  active: boolean;
  /** Callback when Escape is pressed */
  onEscape?: () => void;
  /** Whether to return focus to the trigger element on deactivation. Default: true */
  returnFocus?: boolean;
}

export interface UseFocusTrapReturn {
  /** Ref to attach to the container element that should trap focus */
  trapRef: React.RefObject<HTMLElement | null>;
}

export function useFocusTrap(options: UseFocusTrapOptions): UseFocusTrapReturn {
  const { active, onEscape, returnFocus = true } = options;
  const trapRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!trapRef.current) return [];
    const selectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    return Array.from(trapRef.current.querySelectorAll<HTMLElement>(selectors));
  }, []);

  useEffect(() => {
    if (!active) {
      // Return focus when deactivating
      if (returnFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
      return;
    }

    // Store currently focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first element in trap
    const focusables = getFocusableElements();
    if (focusables.length > 0) {
      focusables[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusables = getFocusableElements();
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, onEscape, returnFocus, getFocusableElements]);

  return { trapRef };
}
