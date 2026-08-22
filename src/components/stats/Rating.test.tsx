/**
 * Thumbs up / down, with the counter arithmetic that goes with it.
 *
 * The rules are small but easy to get subtly wrong: rating again removes the
 * rating, switching sides has to decrement one counter and increment the other,
 * and the component works both controlled and uncontrolled. A counter that
 * drifts is the kind of bug nobody notices until the numbers are public.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Rating } from './Rating';
import type { RatingState } from '@/types/stats';

/** The default labels are "Like" and "Dislike" — see types/labels.ts. */
function up() {
  return screen.getByRole('button', { name: 'Like' });
}

function down() {
  return screen.getByRole('button', { name: 'Dislike' });
}

describe('Rating', () => {
  describe('rendering', () => {
    it('shows both buttons', () => {
      render(<Rating />);
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    it('shows the counts', () => {
      render(<Rating initialState={{ upCount: 12, downCount: 3 }} showCounts />);
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('hides the counts when asked', () => {
      render(<Rating initialState={{ upCount: 12, downCount: 3 }} showCounts={false} />);
      expect(screen.queryByText('12')).not.toBeInTheDocument();
    });

    it('shows a percentage instead when asked', () => {
      // 12 of 15 is 80%.
      render(
        <Rating initialState={{ upCount: 12, downCount: 3 }} showCounts showPercentage />
      );
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('falls back to the raw count when nobody has voted', () => {
      // A percentage of zero votes is not 0%, it is nothing to report.
      render(<Rating initialState={{ upCount: 0, downCount: 0 }} showCounts showPercentage />);
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.queryByText('0%')).not.toBeInTheDocument();
    });

    it.each(['sm', 'md', 'lg'] as const)('renders at size %s', (size) => {
      render(<Rating size={size} />);
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });
  });

  describe('voting', () => {
    it('registers an up vote', async () => {
      const onRateUp = vi.fn();
      const onRatingChange = vi.fn();
      render(<Rating initialState={{ upCount: 5 }} showCounts onRateUp={onRateUp} onRatingChange={onRatingChange} />);

      await userEvent.click(up());

      expect(onRateUp).toHaveBeenCalledOnce();
      expect(onRatingChange).toHaveBeenCalledWith('up');
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('registers a down vote', async () => {
      const onRateDown = vi.fn();
      render(<Rating initialState={{ downCount: 2 }} showCounts onRateDown={onRateDown} />);

      await userEvent.click(down());

      expect(onRateDown).toHaveBeenCalledOnce();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('takes the vote back when the same side is clicked again', async () => {
      const onRateRemove = vi.fn();
      const onRatingChange = vi.fn();
      render(
        <Rating
          initialState={{ upCount: 5 }}
          showCounts
          onRateRemove={onRateRemove}
          onRatingChange={onRatingChange}
        />
      );

      await userEvent.click(up());
      await userEvent.click(up());

      expect(onRateRemove).toHaveBeenCalledOnce();
      expect(onRatingChange).toHaveBeenLastCalledWith(null);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('moves the vote across, adjusting both counters', async () => {
      // The case that drifts if only one side is adjusted.
      render(<Rating initialState={{ upCount: 5, downCount: 2 }} showCounts />);

      await userEvent.click(up());
      await userEvent.click(down());

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('honours an existing vote from the initial state', async () => {
      render(<Rating initialState={{ userRating: 'up', upCount: 5 }} showCounts />);

      await userEvent.click(up());

      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  describe('when rating is not allowed', () => {
    it('does nothing while disabled', async () => {
      const onRateUp = vi.fn();
      render(<Rating disabled onRateUp={onRateUp} />);

      await userEvent.click(up());

      expect(onRateUp).not.toHaveBeenCalled();
    });

    it('does nothing when the feature is switched off', async () => {
      const onRateUp = vi.fn();
      render(<Rating initialState={{ enabled: false }} onRateUp={onRateUp} />);

      await userEvent.click(up());

      expect(onRateUp).not.toHaveBeenCalled();
    });

    it('does nothing when the viewer may not rate', async () => {
      // Not signed in, or already rated on the server.
      const onRateUp = vi.fn();
      render(<Rating initialState={{ canRate: false }} onRateUp={onRateUp} />);

      await userEvent.click(up());

      expect(onRateUp).not.toHaveBeenCalled();
    });

    it('marks the buttons disabled so they are skipped by keyboard', async () => {
      render(<Rating disabled />);
      expect(up()).toBeDisabled();
      expect(down()).toBeDisabled();
    });
  });

  describe('controlled mode', () => {
    it('renders what the owner passes, not its own state', async () => {
      const state: RatingState = {
        userRating: 'up',
        upCount: 99,
        downCount: 1,
        enabled: true,
        canRate: true,
      };
      render(<Rating state={state} showCounts />);

      expect(screen.getByText('99')).toBeInTheDocument();

      // The owner decides what happens next; the component must not overwrite
      // the value it was handed.
      await userEvent.click(up());
      expect(screen.getByText('99')).toBeInTheDocument();
    });

    it('still reports the intent', async () => {
      const onRatingChange = vi.fn();
      const state: RatingState = {
        userRating: null,
        upCount: 0,
        downCount: 0,
        enabled: true,
        canRate: true,
      };
      render(<Rating state={state} onRatingChange={onRatingChange} />);

      await userEvent.click(up());

      expect(onRatingChange).toHaveBeenCalledWith('up');
    });
  });

  describe('labels', () => {
    it('gives both buttons an accessible name', () => {
      render(<Rating />);
      expect(up()).toHaveAccessibleName();
      expect(down()).toHaveAccessibleName();
    });

    it('accepts custom labels', () => {
      render(<Rating labels={{ rateUp: 'Gefällt mir', rateDown: 'Gefällt mir nicht' }} />);
      expect(screen.getByRole('button', { name: 'Gefällt mir' })).toBeInTheDocument();
    });
  });
});
