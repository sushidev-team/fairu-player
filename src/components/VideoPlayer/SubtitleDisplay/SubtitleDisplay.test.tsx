import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubtitleDisplay } from './SubtitleDisplay';

describe('SubtitleDisplay', () => {
  it('should render nothing when text is null', () => {
    const { container } = render(<SubtitleDisplay text={null} mode="overlay" />);
    // Should have opacity-0 (hidden)
    const el = container.firstChild as HTMLElement;
    expect(el?.className).toContain('opacity-0');
  });

  it('should render subtitle text in overlay mode', () => {
    render(<SubtitleDisplay text="Hello world" mode="overlay" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('should render subtitle text in below mode', () => {
    render(<SubtitleDisplay text="Below text" mode="below" />);
    expect(screen.getByText('Below text')).toBeInTheDocument();
  });

  it('should apply custom CSS properties', () => {
    const { container } = render(
      <SubtitleDisplay
        text="Styled text"
        mode="overlay"
        style={{ fontSize: '24px', color: '#ffff00' }}
      />
    );
    const span = container.querySelector('span');
    expect(span?.style.fontSize).toBe('24px');
    expect(span?.style.color).toBe('rgb(255, 255, 0)');
  });

  it('should have pointer-events-none in overlay mode', () => {
    const { container } = render(<SubtitleDisplay text="Test" mode="overlay" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain('pointer-events-none');
  });

  it('should not have pointer-events-none in below mode', () => {
    const { container } = render(<SubtitleDisplay text="Test" mode="below" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).not.toContain('pointer-events-none');
  });

  it('should handle multi-line text', () => {
    const multiLineText = 'Line 1\nLine 2';
    const { container } = render(<SubtitleDisplay text={multiLineText} mode="overlay" />);
    const span = container.querySelector('span');
    expect(span?.innerHTML).toContain('Line 1<br>Line 2');
  });

  it('should apply additional className', () => {
    const { container } = render(
      <SubtitleDisplay text="Test" mode="overlay" className="custom-class" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain('custom-class');
  });

  it('should have min-height in below mode', () => {
    const { container } = render(<SubtitleDisplay text={null} mode="below" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain('min-h-');
  });
});
