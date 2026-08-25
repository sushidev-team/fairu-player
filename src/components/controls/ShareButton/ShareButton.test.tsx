/**
 * Copying a link to this moment.
 *
 * The case worth being careful about is the failure: the clipboard is
 * unavailable outside a secure context, and a button that silently does nothing
 * is indistinguishable from a broken one.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ShareButton } from './ShareButton';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function mount(copied: boolean) {
  const copyShareUrl = vi.fn(() => Promise.resolve(copied));
  render(<ShareButton currentTime={90} copyShareUrl={copyShareUrl} />);
  return copyShareUrl;
}

const button = () => screen.getByRole('button');

describe('ShareButton', () => {
  it('copies a link to the current moment', async () => {
    const copyShareUrl = mount(true);

    fireEvent.click(button());

    await waitFor(() => expect(copyShareUrl).toHaveBeenCalledWith(90));
  });

  it('confirms a copy', async () => {
    mount(true);

    fireEvent.click(button());

    await waitFor(() => expect(button()).toHaveAccessibleName('Link copied'));
  });

  it('reports a copy that did not happen', async () => {
    mount(false);

    fireEvent.click(button());

    // Outside a secure context there is no clipboard, and staging setups are
    // full of those.
    await waitFor(() => expect(button()).toHaveAccessibleName('Could not copy the link'));
  });

  it('announces the outcome for a reader too', async () => {
    mount(true);

    fireEvent.click(button());

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Link copied')
    );
  });

  it('goes back to offering a share', async () => {
    mount(true);
    fireEvent.click(button());
    await waitFor(() => expect(button()).toHaveAccessibleName('Link copied'));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(button()).toHaveAccessibleName('Share this moment');
  });

  it('copies nothing while disabled', () => {
    const copyShareUrl = vi.fn(() => Promise.resolve(true));
    render(<ShareButton currentTime={0} copyShareUrl={copyShareUrl} disabled />);

    fireEvent.click(screen.getByRole('button'));

    expect(copyShareUrl).not.toHaveBeenCalled();
  });
});
