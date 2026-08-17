/**
 * Automated accessibility checks across the player's surfaces.
 *
 * axe catches the machine-checkable half of WCAG: missing accessible names,
 * broken ARIA, contradictory roles, orphaned labels. It cannot judge focus
 * order or whether a label is *meaningful* — but the half it does catch is the
 * half that regresses silently, because nothing in a normal test run notices
 * that a button lost its aria-label.
 *
 * Every control here is operated by keyboard and screen reader in the real
 * world: a media player with unlabelled buttons is unusable, not merely
 * awkward.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';

import { PlayButton } from '@/components/controls/PlayButton';
import { ProgressBar } from '@/components/controls/ProgressBar';
import { VolumeControl } from '@/components/controls/VolumeControl';
import { TimeDisplay } from '@/components/controls/TimeDisplay';
import { PlaybackSpeed } from '@/components/controls/PlaybackSpeed';
import { SkipButtons } from '@/components/controls/SkipButtons';
import { FullscreenButton } from '@/components/controls/FullscreenButton';
import { PictureInPictureButton } from '@/components/controls/PictureInPictureButton';
import { CastButton } from '@/components/controls/CastButton';
import { QualitySelector } from '@/components/controls/QualitySelector';
import { SubtitleSelector } from '@/components/controls/SubtitleSelector';
import { AdSkipButton } from '@/components/ads/AdSkipButton';
import { PlaylistControls } from '@/components/playlist/PlaylistControls';
import { ChapterList } from '@/components/chapters/ChapterList';
import { PlayerProvider } from '@/context/PlayerContext';
import { Player } from '@/components/Player';
import type { Track } from '@/types/player';

/** axe, with the rules that cannot apply to a component in isolation off. */
async function check(ui: React.ReactElement): Promise<AxeResults> {
  const { container } = render(ui);
  return (await axe(container, {
    rules: {
      // A fragment rendered on its own is not a document, so landmark and
      // page-structure rules would fail every component for the same reason
      // and drown anything real.
      region: { enabled: false },
      'page-has-heading-one': { enabled: false },
      // Contrast needs real rendering. jsdom has no layout and no canvas, so
      // axe cannot sample pixels — it reports "incomplete" rather than a
      // verdict, and floods the run with canvas errors on the way. Contrast is
      // checked against the built stylesheet, not here.
      'color-contrast': { enabled: false },
    },
  })) as AxeResults;
}

function expectNoViolations(results: AxeResults) {
  const violations = results.violations.map((v) => `${v.id}: ${v.description}`);
  expect(violations).toEqual([]);
}

const TRACK: Track = {
  id: 'ep-1',
  src: 'https://example.test/ep-1.mp3',
  title: 'Folge 1',
  artist: 'Fairu',
};

describe('accessibility', () => {
  afterEach(() => cleanup());

  describe('transport controls', () => {
    it('PlayButton has no violations', async () => {
      expectNoViolations(await check(<PlayButton isPlaying={false} />));
    });

    it('PlayButton while playing has no violations', async () => {
      expectNoViolations(await check(<PlayButton isPlaying />));
    });

    it('SkipButtons have no violations', async () => {
      expectNoViolations(await check(<SkipButtons />));
    });

    it('ProgressBar has no violations', async () => {
      // The slider is the hardest control to get right: it needs a role, a
      // label, and the value/min/max triple, or a screen reader announces
      // nothing useful about position.
      expectNoViolations(
        await check(<ProgressBar currentTime={30} duration={600} buffered={120} />)
      );
    });

    it('TimeDisplay has no violations', async () => {
      expectNoViolations(await check(<TimeDisplay currentTime={30} duration={600} />));
    });

    it('VolumeControl has no violations', async () => {
      expectNoViolations(await check(<VolumeControl volume={0.5} muted={false} />));
    });

    it('VolumeControl while muted has no violations', async () => {
      expectNoViolations(await check(<VolumeControl volume={0} muted />));
    });

    it('PlaybackSpeed has no violations', async () => {
      expectNoViolations(
        await check(<PlaybackSpeed speed={1} speeds={[0.5, 1, 1.5, 2]} />)
      );
    });
  });

  describe('video controls', () => {
    it('FullscreenButton has no violations', async () => {
      expectNoViolations(await check(<FullscreenButton isFullscreen={false} />));
    });

    it('PictureInPictureButton has no violations', async () => {
      expectNoViolations(
        await check(<PictureInPictureButton isPictureInPicture={false} />)
      );
    });

    it('CastButton has no violations', async () => {
      expectNoViolations(await check(<CastButton isCasting={false} />));
    });

    it('QualitySelector has no violations', async () => {
      expectNoViolations(
        await check(
          <QualitySelector
            currentQuality="auto"
            qualities={[{ label: '1080p', src: '' }, { label: '720p', src: '' }]}
          />
        )
      );
    });

    it('SubtitleSelector has no violations', async () => {
      expectNoViolations(
        await check(
          <SubtitleSelector
            currentSubtitle={null}
            subtitles={[{ id: 'de', label: 'Deutsch', language: 'de', src: '' }]}
          />
        )
      );
    });
  });

  describe('playlist and chapters', () => {
    it('PlaylistControls have no violations', async () => {
      expectNoViolations(
        await check(<PlaylistControls hasPrevious hasNext repeat="none" />)
      );
    });

    it('ChapterList has no violations', async () => {
      expectNoViolations(
        await check(
          <ChapterList
            chapters={[
              { id: 'c1', title: 'Intro', startTime: 0 },
              { id: 'c2', title: 'Hauptteil', startTime: 120 },
            ]}
            currentTime={30}
            currentChapterIndex={0}
            duration={600}
          />
        )
      );
    });
  });

  describe('ads', () => {
    it('AdSkipButton counting down has no violations', async () => {
      expectNoViolations(await check(<AdSkipButton canSkip={false} countdown={5} />));
    });

    it('AdSkipButton when skippable has no violations', async () => {
      expectNoViolations(await check(<AdSkipButton canSkip countdown={0} />));
    });
  });

  describe('the assembled player', () => {
    it('has no violations', async () => {
      // The composition matters as much as the parts: duplicate ids and
      // conflicting labels only appear once the controls sit together.
      expectNoViolations(
        await check(
          <PlayerProvider config={{ track: TRACK }}>
            <Player />
          </PlayerProvider>
        )
      );
    });

    it('has no violations with a playlist and chapters on show', async () => {
      expectNoViolations(
        await check(
          <PlayerProvider
            config={{
              playlist: [TRACK, { id: 'ep-2', src: 'b.mp3', title: 'Folge 2' }],
              track: {
                ...TRACK,
                chapters: [{ id: 'c1', title: 'Intro', startTime: 0 }],
              },
            }}
          >
            <Player showPlaylist showChapters />
          </PlayerProvider>
        )
      );
    });
  });
});
