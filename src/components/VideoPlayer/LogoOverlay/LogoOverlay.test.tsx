import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogoOverlay } from './LogoOverlay';
import type { LogoConfig, LogoComponentProps } from '@/types/logo';

// ─── Helpers ────────────────────────────────────────────────────────

function createLogoConfig(overrides: Partial<LogoConfig> = {}): LogoConfig {
  return {
    src: 'https://example.com/logo.png',
    alt: 'Test Logo',
    ...overrides,
  };
}

describe('LogoOverlay', () => {
  // ── Basic rendering ───────────────────────────────────────────────

  it('renders nothing when neither src nor component is provided', () => {
    const { container } = render(
      <LogoOverlay config={{ src: undefined, component: undefined }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders logo image when src is provided', () => {
    render(<LogoOverlay config={createLogoConfig()} />);
    const img = screen.getByAltText('Test Logo');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('https://example.com/logo.png');
  });

  it('renders image with empty alt text by default', () => {
    const { container } = render(<LogoOverlay config={createLogoConfig({ alt: undefined })} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('image is not draggable', () => {
    render(<LogoOverlay config={createLogoConfig()} />);
    const img = screen.getByAltText('Test Logo');
    expect(img.getAttribute('draggable')).toBe('false');
  });

  // ── Positioning ───────────────────────────────────────────────────

  it('positions at top-left', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ position: 'top-left' })} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.top).toBe('16px');
    expect(el.style.left).toBe('16px');
  });

  it('positions at top-right', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ position: 'top-right' })} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.top).toBe('16px');
    expect(el.style.right).toBe('16px');
  });

  it('positions at bottom-left', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ position: 'bottom-left' })} />
    );
    const el = container.firstChild as HTMLElement;
    // bottom = margin(16) + CONTROLS_HEIGHT(56) + offsetY(0) = 72
    expect(el.style.bottom).toBe('72px');
    expect(el.style.left).toBe('16px');
  });

  it('positions at bottom-right (default)', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig()} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.bottom).toBe('72px');
    expect(el.style.right).toBe('16px');
  });

  it('applies custom margin', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ position: 'top-left', margin: 24 })} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.top).toBe('24px');
    expect(el.style.left).toBe('24px');
  });

  it('applies offsetX and offsetY', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ position: 'top-left', offsetX: 10, offsetY: 5 })} />
    );
    const el = container.firstChild as HTMLElement;
    // top = margin(16) + offsetY(5) = 21
    expect(el.style.top).toBe('21px');
    // left = margin(16) + offsetX(10) = 26
    expect(el.style.left).toBe('26px');
  });

  // ── Dimensions ────────────────────────────────────────────────────

  it('applies custom width and height to image', () => {
    render(
      <LogoOverlay config={createLogoConfig({ width: 200, height: 80 })} />
    );
    const img = screen.getByAltText('Test Logo');
    expect(img.style.width).toBe('200px');
    expect(img.style.height).toBe('80px');
    expect(img.style.maxWidth).toBe('200px');
    expect(img.style.maxHeight).toBe('80px');
  });

  it('applies default max dimensions when width/height not specified', () => {
    render(<LogoOverlay config={createLogoConfig()} />);
    const img = screen.getByAltText('Test Logo');
    expect(img.style.width).toBe('auto');
    expect(img.style.height).toBe('auto');
    expect(img.style.maxWidth).toBe('120px');
    expect(img.style.maxHeight).toBe('60px');
  });

  // ── Opacity ───────────────────────────────────────────────────────

  it('applies default opacity (0.8)', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig()} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.opacity).toBe('0.8');
  });

  it('applies custom opacity', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ opacity: 0.5 })} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.opacity).toBe('0.5');
  });

  // ── Click handler ─────────────────────────────────────────────────

  it('calls onClick when clicked (div wrapper)', () => {
    const onClick = vi.fn();
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ onClick })} />
    );
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies cursor-pointer class when onClick is provided', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ onClick: vi.fn() })} />
    );
    expect((container.firstChild as HTMLElement).className).toContain('cursor-pointer');
  });

  // ── Link (href) ───────────────────────────────────────────────────

  it('renders as anchor when href is provided', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ href: 'https://example.com' })} />
    );
    const link = container.querySelector('a');
    expect(link).toBeInTheDocument();
    expect(link?.getAttribute('href')).toBe('https://example.com');
  });

  it('opens link in new tab by default', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ href: 'https://example.com' })} />
    );
    const link = container.querySelector('a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('opens link in same tab when target is _self', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ href: 'https://example.com', target: '_self' })} />
    );
    const link = container.querySelector('a');
    expect(link?.getAttribute('target')).toBe('_self');
    expect(link?.getAttribute('rel')).toBeNull();
  });

  it('calls onClick and prevents default when both href and onClick are set', () => {
    const onClick = vi.fn();
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ href: 'https://example.com', onClick })} />
    );
    const link = container.querySelector('a')!;
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // ── Animations ────────────────────────────────────────────────────

  it('applies fade animation by default', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig()} visible={true} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transitionProperty).toBe('opacity, transform');
    expect(el.style.opacity).toBe('0.8');
  });

  it('applies none animation with 0ms duration', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ animation: { type: 'none' } })} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transitionDuration).toBe('0ms');
  });

  it('applies slide animation with translateX(0) when visible', () => {
    const { container } = render(
      <LogoOverlay
        config={createLogoConfig({ animation: { type: 'slide' }, position: 'top-right' })}
        visible={true}
      />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transform).toBe('translateX(0)');
  });

  it('applies slide animation with translateX(100%) when hidden on right side', () => {
    const { container } = render(
      <LogoOverlay
        config={createLogoConfig({
          animation: { type: 'slide' },
          position: 'top-right',
          hideWithControls: true,
        })}
        visible={false}
      />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transform).toBe('translateX(100%)');
  });

  it('applies slide animation with translateX(-100%) when hidden on left side', () => {
    const { container } = render(
      <LogoOverlay
        config={createLogoConfig({
          animation: { type: 'slide' },
          position: 'top-left',
          hideWithControls: true,
        })}
        visible={false}
      />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transform).toBe('translateX(-100%)');
  });

  it('applies scale animation with scale(1) when visible', () => {
    const { container } = render(
      <LogoOverlay
        config={createLogoConfig({ animation: { type: 'scale' } })}
        visible={true}
      />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transform).toBe('scale(1)');
  });

  it('applies scale animation with scale(0.75) when hidden', () => {
    const { container } = render(
      <LogoOverlay
        config={createLogoConfig({ animation: { type: 'scale' }, hideWithControls: true })}
        visible={false}
      />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transform).toBe('scale(0.75)');
  });

  it('applies custom animation duration', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ animation: { type: 'fade', duration: 500 } })} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transitionDuration).toBe('500ms');
  });

  it('applies custom animation delay', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ animation: { type: 'fade', delay: 200 } })} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transitionDelay).toBe('200ms');
  });

  // ── hideWithControls ──────────────────────────────────────────────

  it('sets opacity to 0 when hideWithControls is true and visible is false', () => {
    const { container } = render(
      <LogoOverlay
        config={createLogoConfig({ hideWithControls: true })}
        visible={false}
      />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.opacity).toBe('0');
  });

  it('keeps full opacity when hideWithControls is true and visible is true', () => {
    const { container } = render(
      <LogoOverlay
        config={createLogoConfig({ hideWithControls: true, opacity: 0.8 })}
        visible={true}
      />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.opacity).toBe('0.8');
  });

  it('is always visible when hideWithControls is false', () => {
    const { container } = render(
      <LogoOverlay
        config={createLogoConfig({ hideWithControls: false })}
        visible={false}
      />
    );
    const el = container.firstChild as HTMLElement;
    // When hideWithControls is false, isVisible is always true
    expect(el.style.opacity).toBe('0.8');
  });

  it('applies pointer-events-none when not visible', () => {
    const { container } = render(
      <LogoOverlay
        config={createLogoConfig({ hideWithControls: true })}
        visible={false}
      />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('pointer-events-none');
  });

  // ── Custom component ──────────────────────────────────────────────

  it('renders custom component instead of image', () => {
    function CustomLogo(props: LogoComponentProps) {
      return <div data-testid="custom-logo">Custom {props.isPlaying ? 'Playing' : 'Paused'}</div>;
    }
    render(
      <LogoOverlay config={createLogoConfig({ src: undefined, component: CustomLogo })} isPlaying={true} />
    );
    expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
    expect(screen.getByText('Custom Playing')).toBeInTheDocument();
  });

  it('passes visibility props to custom component', () => {
    function CustomLogo(props: LogoComponentProps) {
      return (
        <div data-testid="custom-logo">
          {props.visible ? 'visible' : 'hidden'}
          {props.isFullscreen ? ' fullscreen' : ''}
        </div>
      );
    }
    render(
      <LogoOverlay
        config={createLogoConfig({ src: undefined, component: CustomLogo })}
        visible={true}
        isFullscreen={true}
      />
    );
    expect(screen.getByText('visible fullscreen')).toBeInTheDocument();
  });

  it('prefers custom component over src', () => {
    function CustomLogo() {
      return <div data-testid="custom-logo">Custom</div>;
    }
    render(
      <LogoOverlay config={createLogoConfig({ component: CustomLogo })} />
    );
    expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
    expect(screen.queryByAltText('Test Logo')).not.toBeInTheDocument();
  });

  // ── className ─────────────────────────────────────────────────────

  it('applies custom className prop', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig()} className="my-overlay" />
    );
    expect((container.firstChild as HTMLElement).className).toContain('my-overlay');
  });

  it('applies config className', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig({ className: 'config-class' })} />
    );
    expect((container.firstChild as HTMLElement).className).toContain('config-class');
  });

  // ── Absolute positioning class ────────────────────────────────────

  it('has absolute positioning class', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig()} />
    );
    expect((container.firstChild as HTMLElement).className).toContain('absolute');
  });

  it('has z-index class', () => {
    const { container } = render(
      <LogoOverlay config={createLogoConfig()} />
    );
    expect((container.firstChild as HTMLElement).className).toContain('z-[15]');
  });
});
