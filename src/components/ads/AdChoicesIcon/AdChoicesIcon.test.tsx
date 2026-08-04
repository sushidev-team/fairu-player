import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdChoicesIcon, selectAdChoicesIcon } from './AdChoicesIcon';
import type { VastIcon } from '@/types/vast';

function icon(overrides: Partial<VastIcon> = {}): VastIcon {
  return {
    program: 'AdChoices',
    staticResource: 'https://cdn.example.com/adchoices.png',
    clickThroughUrl: 'https://privacy.example.com',
    clickTrackingUrls: [],
    viewTrackingUrls: [],
    ...overrides,
  };
}

describe('selectAdChoicesIcon', () => {
  it('prefers the icon that declares the AdChoices program', () => {
    const other = icon({ program: 'other', staticResource: 'https://cdn.example.com/other.png' });
    const adChoices = icon();

    expect(selectAdChoicesIcon([other, adChoices])).toBe(adChoices);
  });

  it('falls back to any icon with a static resource', () => {
    // Plenty of ad servers ship the badge with no program attribute at all.
    const unnamed = icon({ program: undefined });
    expect(selectAdChoicesIcon([unnamed])).toBe(unnamed);
  });

  it('skips icons the player cannot render', () => {
    const iframeOnly = icon({
      program: undefined,
      staticResource: undefined,
      iframeResource: 'https://cdn.example.com/badge.html',
    });

    // Rendering this as an <img> would show a broken image.
    expect(selectAdChoicesIcon([iframeOnly])).toBeUndefined();
  });

  it('handles no icons at all', () => {
    expect(selectAdChoicesIcon(undefined)).toBeUndefined();
    expect(selectAdChoicesIcon([])).toBeUndefined();
  });
});

describe('AdChoicesIcon', () => {
  let beacon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders nothing when the creative declares no icon', () => {
    const { container } = render(<AdChoicesIcon icons={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the badge as a link to the privacy page', () => {
    render(<AdChoicesIcon icons={[icon()]} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://privacy.example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  const viewTracked = () => [icon({ viewTrackingUrls: ['https://t.example.com/iconview'] })];
  const viewCount = () =>
    beacon.mock.calls.filter(([url]) => String(url).includes('iconview')).length;

  it('fires the icon view pixel once per ad, not once per render', () => {
    // A parent re-render routinely hands down a fresh ad object, so object
    // identity cannot be the dedupe key.
    const { rerender } = render(<AdChoicesIcon icons={viewTracked()} adId="ad-1" />);
    rerender(<AdChoicesIcon icons={viewTracked()} adId="ad-1" />);
    rerender(<AdChoicesIcon icons={viewTracked()} adId="ad-1" />);

    expect(viewCount()).toBe(1);
  });

  it('fires again for the next ad in a pod', () => {
    // Both spots normally carry the same badge URL and each owes its own
    // IconViewTracking, so the URL cannot be the dedupe key either.
    const { rerender } = render(<AdChoicesIcon icons={viewTracked()} adId="ad-1" />);
    rerender(<AdChoicesIcon icons={viewTracked()} adId="ad-2" />);

    expect(viewCount()).toBe(2);
  });

  it('fires icon click tracking without swallowing the navigation', async () => {
    const user = userEvent.setup();
    render(
      <AdChoicesIcon icons={[icon({ clickTrackingUrls: ['https://t.example.com/iconclick'] })]} />
    );

    await user.click(screen.getByRole('link'));

    expect(beacon).toHaveBeenCalledWith(expect.stringContaining('iconclick'));
  });

  it('does not let the click reach the player underneath', async () => {
    // The badge sits on surfaces that treat a click as play/pause or as an ad
    // click-through; neither is what the viewer meant.
    const onParentClick = vi.fn();
    const user = userEvent.setup();

    render(
      <div onClick={onParentClick}>
        <AdChoicesIcon icons={[icon()]} />
      </div>
    );

    await user.click(screen.getByRole('link'));
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('renders a plain image when the icon has no click-through', () => {
    render(<AdChoicesIcon icons={[icon({ clickThroughUrl: undefined })]} />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('presentation', { hidden: true })).toBeInTheDocument();
  });

  it('refuses a javascript: resource', () => {
    const { container } = render(
      <AdChoicesIcon icons={[icon({ staticResource: 'javascript:alert(1)' })]} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('refuses a javascript: click-through but still shows the badge', () => {
    render(<AdChoicesIcon icons={[icon({ clickThroughUrl: 'javascript:alert(1)' })]} />);

    // The badge itself is a compliance requirement; only the link is dropped.
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('presentation', { hidden: true })).toBeInTheDocument();
  });
});
