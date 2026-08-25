/**
 * Captions drawn by the player.
 *
 * The point of interest is that nothing here renders markup: a caption file is
 * third-party content, and the version this was ported from handed it to
 * `dangerouslySetInnerHTML` for the sake of a line break.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubtitleDisplay } from './SubtitleDisplay';
import { DEFAULT_SUBTITLE_STYLE } from '@/core/subtitleStyle';

const surface = () => screen.queryByTestId('subtitle-display');

describe('SubtitleDisplay', () => {
  it('renders nothing without a cue', () => {
    const { container } = render(<SubtitleDisplay text={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the cue', () => {
    render(<SubtitleDisplay text="Hallo" />);

    expect(screen.getByText('Hallo')).toBeInTheDocument();
  });

  it('keeps a line break without rendering markup', () => {
    const { container } = render(<SubtitleDisplay text={'Erste\nZweite'} />);

    expect(container.querySelectorAll('br')).toHaveLength(1);
    expect(surface()).toHaveTextContent('Erste');
    expect(surface()).toHaveTextContent('Zweite');
  });

  it('shows markup in a cue as text', () => {
    render(<SubtitleDisplay text={'<img src=x onerror=alert(1)>'} />);

    // A caption file is written by whoever supplied the video. The parser drops
    // tags, and this renders text either way — belt and braces on purpose.
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('names the speaker when the file does', () => {
    render(<SubtitleDisplay text="Hallo" speaker="Anna" />);

    expect(screen.getByText('Anna:')).toBeInTheDocument();
  });

  describe('placement', () => {
    it('overlays the video by default', () => {
      render(<SubtitleDisplay text="Hallo" />);

      expect(surface()).toHaveClass('absolute');
      // A caption that swallowed a click would break play-on-tap.
      expect(surface()).toHaveClass('pointer-events-none');
    });

    it('follows the style to the top', () => {
      render(
        <SubtitleDisplay text="Hallo" style={{ ...DEFAULT_SUBTITLE_STYLE, position: 'top' }} />
      );

      expect(surface()).toHaveStyle({ top: '10%' });
    });

    it('sits in its own strip when asked', () => {
      render(<SubtitleDisplay text="Hallo" mode="below" />);

      expect(surface()).not.toHaveClass('absolute');
    });
  });

  describe('appearance', () => {
    it('applies the style it is given', () => {
      render(
        <SubtitleDisplay
          text="Hallo"
          style={{ ...DEFAULT_SUBTITLE_STYLE, fontSize: 24, textColor: '#ff0000' }}
        />
      );

      const cue = screen.getByText('Hallo').parentElement as HTMLElement;
      expect(cue).toHaveStyle({ fontSize: '24px', color: '#ff0000' });
    });

    it('turns the backing colour and opacity into one value', () => {
      render(
        <SubtitleDisplay
          text="Hallo"
          style={{ ...DEFAULT_SUBTITLE_STYLE, backgroundColor: '#000000', backgroundOpacity: 0.5 }}
        />
      );

      const cue = screen.getByText('Hallo').parentElement as HTMLElement;
      expect(cue).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 0.5)' });
    });
  });
});
