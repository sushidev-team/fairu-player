import { useEffect, useRef, useState } from 'react';

export interface ScreenReaderAnnouncerProps {
  /** Change this to announce something. */
  message: string;
  /**
   * `polite` waits for a pause; `assertive` interrupts.
   *
   * Almost everything a player has to say is polite. Interrupting someone
   * mid-sentence to tell them the volume changed is worse than not telling them.
   */
  politeness?: 'polite' | 'assertive';
}

/**
 * A live region for things the player does that are only visible.
 *
 * Ported from PR #16. Announcing the same text twice needs the region to be
 * emptied first — a screen reader ignores a value that has not changed — which
 * is what the short delay below is for.
 */
export function ScreenReaderAnnouncer({
  message,
  politeness = 'polite',
}: ScreenReaderAnnouncerProps) {
  const [announcement, setAnnouncement] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
    Clearing and re-setting is the only way to repeat an announcement, and both
    halves are state. It cannot cascade: the effect depends on `message`, and
    what it writes is derived from `message` alone.
  */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!message) {
      setAnnouncement('');
      return;
    }

    setAnnouncement('');
    timerRef.current = setTimeout(() => setAnnouncement(message), 50);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div
      // `alert` is the assertive counterpart of `status`; pairing `status` with
      // `aria-live="assertive"` asks for two different things at once.
      role={politeness === 'assertive' ? 'alert' : 'status'}
      aria-live={politeness}
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
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
