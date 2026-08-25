/**
 * The banner over a paused player.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PauseAd } from './PauseAd';
import type { PauseAd as PauseAdType } from '@/core/pauseAd';

const AD: PauseAdType = {
  id: 'p1',
  imageUrl: 'https://cdn.example.test/banner.png',
  altText: 'Angebot des Monats',
  clickThroughUrl: 'https://example.test/landing',
};

let onClick: Mock<() => void>;
let onDismiss: Mock<() => void>;

beforeEach(() => {
  onClick = vi.fn();
  onDismiss = vi.fn();
});

const mount = (ad: PauseAdType = AD) =>
  render(<PauseAd ad={ad} onClick={onClick} onDismiss={onDismiss} />);

describe('PauseAd', () => {
  it('shows the creative', () => {
    mount();

    expect(screen.getByAltText('Angebot des Monats')).toHaveAttribute('src', AD.imageUrl);
  });

  it('marks itself as advertising', () => {
    mount();

    expect(screen.getByText('Advertisement')).toBeInTheDocument();
  });

  it('can always be closed', () => {
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'Close ad' }));

    // It covers the frame the viewer paused *to look at*. Not being able to
    // close it is the one thing it must not do.
    expect(onDismiss).toHaveBeenCalled();
  });

  it('reports a click on the creative', () => {
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'Angebot des Monats' }));

    expect(onClick).toHaveBeenCalled();
  });

  it('is not clickable without a destination', () => {
    mount({ ...AD, clickThroughUrl: undefined });

    expect(screen.queryByRole('button', { name: 'Angebot des Monats' })).not.toBeInTheDocument();
    expect(screen.getByAltText('Angebot des Monats')).toBeInTheDocument();
  });

  it('shows the copy the creative carries', () => {
    mount({ ...AD, title: 'Neu im Angebot', description: 'Nur diese Woche' });

    expect(screen.getByText('Neu im Angebot')).toBeInTheDocument();
    expect(screen.getByText('Nur diese Woche')).toBeInTheDocument();
  });

  it('renders nothing for a creative URL that is not http', () => {
    const { container } = mount({ ...AD, imageUrl: 'javascript:alert(1)' });

    // The creative comes from an ad server.
    expect(container).toBeEmptyDOMElement();
  });
});
