import { useState, useEffect, useRef } from 'react';

export interface ScreenReaderAnnouncerProps {
  /** The message to announce. Change this value to trigger an announcement. */
  message: string;
  /** Politeness level. Default: 'polite' */
  politeness?: 'polite' | 'assertive';
}

/**
 * Visually hidden component that announces messages to screen readers.
 * Change the `message` prop to trigger a new announcement.
 */
export function ScreenReaderAnnouncer({
  message,
  politeness = 'polite',
}: ScreenReaderAnnouncerProps) {
  const [announcement, setAnnouncement] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!message) return;

    // Clear previous announcement first to ensure re-announcement of same text
    setAnnouncement('');

    timeoutRef.current = setTimeout(() => {
      setAnnouncement(message);
    }, 50);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [message]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        borderWidth: 0,
      }}
    >
      {announcement}
    </div>
  );
}
