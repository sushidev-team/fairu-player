/**
 * The sleep-timer button and its menu.
 *
 * Presentational, so this is about what a viewer can reach and what the button
 * announces — the countdown and the pausing belong to the hook.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SleepTimer } from './SleepTimer';
import type { SleepTimerMode } from '@/core/sleepTimer';

let onStart: Mock<(mode: SleepTimerMode) => void>;
let onCancel: Mock<() => void>;

beforeEach(() => {
  onStart = vi.fn();
  onCancel = vi.fn();
});

function mount(props: Partial<React.ComponentProps<typeof SleepTimer>> = {}) {
  return render(
    <SleepTimer
      isActive={false}
      remainingTime={0}
      onStart={onStart}
      onCancel={onCancel}
      {...props}
    />
  );
}

const trigger = () => screen.getByRole('button', { name: /sleep timer/i });
const menu = () => screen.queryByRole('listbox');

describe('SleepTimer', () => {
  describe('the button', () => {
    it('shows no countdown while idle', () => {
      mount();

      expect(trigger()).toHaveAccessibleName('Sleep timer');
      expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    });

    it('shows the countdown while running', () => {
      mount({ isActive: true, remainingTime: 305 });

      // Doubles as the "it is running" signal, so nobody has to open the menu
      // to find out.
      expect(screen.getByText('5:05')).toBeInTheDocument();
      expect(trigger()).toHaveAccessibleName('Sleep timer: 5:05 remaining');
    });

    it('shows hours for a long timer', () => {
      mount({ isActive: true, remainingTime: 3600 });

      expect(screen.getByText('1:00:00')).toBeInTheDocument();
    });
  });

  describe('the menu', () => {
    it('starts closed and opens on the button', () => {
      mount();
      expect(menu()).not.toBeInTheDocument();

      fireEvent.click(trigger());

      expect(menu()).toBeInTheDocument();
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes on a click outside', () => {
      mount();
      fireEvent.click(trigger());

      fireEvent.mouseDown(document.body);

      expect(menu()).not.toBeInTheDocument();
    });

    it('closes on Escape and gives focus back', () => {
      mount();
      fireEvent.click(trigger());

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(menu()).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
    });

    it('stays shut while disabled', () => {
      mount({ disabled: true });

      fireEvent.click(trigger());

      expect(menu()).not.toBeInTheDocument();
    });

    it('offers the presets', () => {
      mount();
      fireEvent.click(trigger());

      expect(screen.getByRole('option', { name: '15 min' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'End of track' })).toBeInTheDocument();
    });

    it('reports the chosen preset and closes', () => {
      mount();
      fireEvent.click(trigger());

      fireEvent.click(screen.getByRole('option', { name: '30 min' }));

      expect(onStart).toHaveBeenCalledWith(30);
      expect(menu()).not.toBeInTheDocument();
    });

    it('reports end of track', () => {
      mount();
      fireEvent.click(trigger());

      fireEvent.click(screen.getByRole('option', { name: 'End of track' }));

      expect(onStart).toHaveBeenCalledWith('endOfTrack');
    });

    it('marks the preset that is running', () => {
      mount({ isActive: true, remainingTime: 600, selectedDuration: 30 });
      fireEvent.click(trigger());

      expect(screen.getByRole('option', { name: '30 min' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('option', { name: '15 min' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
    });
  });

  describe('cancelling', () => {
    it('is offered only while the timer runs', () => {
      mount();
      fireEvent.click(trigger());
      expect(screen.queryByText('Cancel timer')).not.toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      mount({ isActive: true, remainingTime: 60 });
      fireEvent.click(screen.getAllByRole('button', { name: /sleep timer/i })[1]);

      expect(screen.getByText('Cancel timer')).toBeInTheDocument();
    });

    it('is not one of the options', () => {
      mount({ isActive: true, remainingTime: 60 });
      fireEvent.click(trigger());

      // Cancelling is an action; announcing it as an option misreports the list.
      const options = screen.getAllByRole('option').map((o) => o.textContent);
      expect(options).not.toContain('Cancel timer');
    });

    it('reports the cancellation and closes', () => {
      mount({ isActive: true, remainingTime: 60 });
      fireEvent.click(trigger());

      fireEvent.click(screen.getByText('Cancel timer'));

      expect(onCancel).toHaveBeenCalled();
      expect(menu()).not.toBeInTheDocument();
    });
  });
});
