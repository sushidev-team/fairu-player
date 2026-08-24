/**
 * Scrub thumbnails inside the bar's hover tooltip.
 *
 * The tooltip already existed and already knew how to show a marker's own
 * preview image. This is about the frames coming from a thumbnail sheet, and
 * about which of the two wins when both apply.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';
import { ThumbnailPreview } from '@/components/controls/ThumbnailPreview';
import { useThumbnails } from '@/hooks/useThumbnails';
import type { ThumbnailConfig } from '@/core/thumbnails';
import type { TimelineMarker } from '@/types/markers';

const DURATION = 300;
const VTT_URL = 'https://cdn.example.test/thumbs/index.vtt';

const VTT = `WEBVTT

00:00:00.000 --> 00:01:00.000
sheet.jpg#xywh=0,0,160,90

00:01:00.000 --> 00:02:00.000
sheet.jpg#xywh=160,0,160,90
`;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, status: 200, text: async () => VTT } as Response))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** One pixel stands in for one second, as in the sibling suite. */
function withLayout(node: HTMLElement) {
  node.getBoundingClientRect = () =>
    ({
      left: 0,
      width: DURATION,
      top: 0,
      height: 8,
      right: DURATION,
      bottom: 8,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  return node;
}

/**
 * What a caller writes. The bar takes a slot rather than a thumbnail config, so
 * that the audio bundle does not carry a video-only feature.
 */
function Harness({
  thumbnails,
  ...props
}: { thumbnails?: ThumbnailConfig } & Partial<React.ComponentProps<typeof ProgressBar>>) {
  const frames = useThumbnails(thumbnails);

  return (
    <ProgressBar
      currentTime={0}
      duration={DURATION}
      renderPreview={
        thumbnails
          ? (time) => <ThumbnailPreview cue={frames.cueAt(time)} width={160} height={90} />
          : undefined
      }
      {...props}
    />
  );
}

function setup(
  props: { thumbnails?: ThumbnailConfig } & Partial<React.ComponentProps<typeof ProgressBar>> = {}
) {
  const view = render(<Harness thumbnails={{ vttUrl: VTT_URL }} {...props} />);
  const bar = withLayout(view.container.querySelector('[role="slider"]') as HTMLElement);
  return { ...view, bar };
}

const hoverAt = (bar: HTMLElement, seconds: number) =>
  fireEvent.mouseMove(bar, { clientX: seconds });

const sprite = () => screen.queryByTestId('thumbnail-sprite');

describe('ProgressBar thumbnails', () => {
  it('shows the frame for the time under the pointer', async () => {
    const { bar } = setup();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(VTT_URL, expect.anything()));

    hoverAt(bar, 90);

    await waitFor(() => expect(sprite()).toBeInTheDocument());
    const frame = sprite()!.firstElementChild as HTMLElement;
    // 90s falls in the second cue, which sits one tile along the sheet.
    // The browser normalises `-0px` away.
    expect(frame.style.backgroundPosition).toBe('-160px 0px');
  });

  it('follows the pointer to another frame', async () => {
    const { bar } = setup();
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    hoverAt(bar, 90);
    await waitFor(() => expect(sprite()).toBeInTheDocument());

    hoverAt(bar, 10);

    await waitFor(() => {
      const frame = sprite()!.firstElementChild as HTMLElement;
      expect(frame.style.backgroundPosition).toBe('0px 0px');
    });
  });

  it('shows nothing before the sheet has loaded', () => {
    const { bar } = setup();

    hoverAt(bar, 90);

    // The tooltip still appears with its timestamp; only the picture is absent.
    expect(sprite()).not.toBeInTheDocument();
    expect(screen.getByText('1:30')).toBeInTheDocument();
  });

  it('shows nothing when no thumbnails are configured', () => {
    const { bar } = setup({ thumbnails: undefined });

    hoverAt(bar, 90);

    expect(sprite()).not.toBeInTheDocument();
  });

  it('leaves the tooltip alone past the last frame', async () => {
    const { bar } = setup();
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    // The sheet only covers the first two minutes.
    hoverAt(bar, 280);

    expect(sprite()).not.toBeInTheDocument();
    expect(screen.getByText('4:40')).toBeInTheDocument();
  });

  it('lets a marker keep its own picture', async () => {
    const markers: TimelineMarker[] = [
      { id: 'm', time: 90, title: 'Kapitel', previewImage: 'https://cdn.example.test/m.jpg' },
    ];
    const { bar, container } = setup({ markers });
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    hoverAt(bar, 90);

    // A marker's image was chosen for that moment; a thumbnail is only the
    // frame that happens to be there.
    await waitFor(() =>
      expect(container.querySelector('img[src="https://cdn.example.test/m.jpg"]')).toBeInTheDocument()
    );
    expect(sprite()).not.toBeInTheDocument();
  });
});
