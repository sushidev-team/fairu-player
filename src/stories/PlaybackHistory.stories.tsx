import type { Meta, StoryObj } from '@storybook/react';
import { usePlaybackHistory } from '@/hooks/usePlaybackHistory';
import { poster } from '@/stories/fixtures';
import { Note, Panel, Snippet, Stage } from '@/stories/preview-kit';
import { formatTime } from '@/utils';

const meta: Meta = {
  title: 'Hooks/Playback History',
  parameters: {
    docs: {
      description: {
        component:
          'What was played, how far, and when — the list a "continue watching" row ' +
          'is built from. Held in one store per storage key, so every component ' +
          'reading it sees the same history.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const CATALOGUE = [
  { trackId: 'ep-1', title: 'Folge 1 — Anfänge', duration: 1800 },
  { trackId: 'ep-2', title: 'Folge 2 — Der Umbau', duration: 2400 },
  { trackId: 'ep-3', title: 'Folge 3 — Nachspiel', duration: 1500 },
];

/** Two independent components, one history — which is the whole point. */
function Recorder() {
  const history = usePlaybackHistory();

  return (
    <Panel title="Abspielen">
      <div className="flex flex-col gap-2">
        {CATALOGUE.map((item, index) => (
          <div key={item.trackId} className="flex items-center gap-2">
            <span className="flex-1 text-sm">{item.title}</span>
            <button
              type="button"
              onClick={() =>
                history.recordPlay({
                  ...item,
                  artwork: poster(item.trackId, 80, 45),
                  lastPosition: item.duration * 0.3,
                  progress: 30,
                  completed: false,
                })
              }
              className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
            >
              30 % ansehen
            </button>
            <button
              type="button"
              onClick={() =>
                history.recordPlay({
                  ...item,
                  artwork: poster(item.trackId, 80, 45),
                  lastPosition: item.duration,
                  progress: 100,
                  completed: true,
                })
              }
              className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
            >
              zu Ende
            </button>
            {index === 0 && <span className="sr-only">erste Zeile</span>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ResumeRow() {
  const history = usePlaybackHistory();

  return (
    <Panel title="Weiterschauen" meta={`${history.resumable.length}`}>
      {history.resumable.length === 0 ? (
        <p className="text-sm opacity-60">Nichts angefangen.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {history.resumable.map((entry) => (
            <div key={entry.trackId} className="flex items-center gap-3">
              {entry.artwork && (
                <img src={entry.artwork} alt="" className="h-9 w-16 rounded object-cover" />
              )}
              <div className="flex-1">
                <div className="text-sm">{entry.title}</div>
                <div className="text-xs opacity-60">
                  {formatTime(entry.lastPosition)} von {formatTime(entry.duration)} ·{' '}
                  {entry.playCount}× gespielt
                </div>
              </div>
              <button
                type="button"
                onClick={() => history.remove(entry.trackId)}
                className="rounded px-2 py-1 text-xs opacity-60 hover:opacity-100"
              >
                entfernen
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Everything() {
  const history = usePlaybackHistory();

  return (
    <div className="flex flex-col gap-3">
      <Recorder />
      <ResumeRow />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={history.clear}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
        >
          Verlauf löschen
        </button>
        <span className="text-xs opacity-70">{history.count} Einträge gespeichert</span>
      </div>
    </div>
  );
}

/**
 * Press a button in the upper panel; the lower one updates without being told.
 * They are separate components sharing one store.
 */
export const Interactive: Story = {
  render: () => (
    <Stage
      title="Weiterschauen"
      description="Die beiden Panels sind unabhängige Komponenten. Was oben aufgezeichnet wird, erscheint unten — und übersteht einen Reload."
      maxWidth={640}
      aside={
        <div className="flex flex-col gap-3">
          <Note tone="tip">
            Eine „Weiterschauen"-Zeile und der Player, der sie füttert, sind nie
            dieselbe Komponente. Ein Verlauf pro Instanz ließe sie
            auseinanderlaufen.
          </Note>
          <Note tone="warn">
            Der gespeicherte Verlauf überlebt das Schema, das ihn geschrieben hat.
            Einträge ohne ID oder Zeitstempel werden verworfen statt als leere
            Zeile gerendert.
          </Note>
        </div>
      }
    >
      <Everything />
    </Stage>
  ),
};

/** How it is wired up. */
export const Usage: Story = {
  render: () => (
    <Stage title="Usage" maxWidth={640}>
      <Snippet
        code={`import { usePlaybackHistory } from '@fairu/player';

function ContinueWatching() {
  const history = usePlaybackHistory();

  return history.resumable.map((entry) => (
    <button key={entry.trackId} onClick={() => open(entry.trackId, entry.lastPosition)}>
      {entry.title} — {Math.round(entry.progress)} %
    </button>
  ));
}

function Player({ track }) {
  const history = usePlaybackHistory();

  // Anywhere the position is known — on pause, on ended, on a timer.
  const remember = (position, duration) =>
    history.recordPlay({
      trackId: track.id,
      title: track.title,
      artwork: track.artwork,
      lastPosition: position,
      duration,
      progress: (position / duration) * 100,
      completed: position / duration >= 0.95,
    });
}`}
      />
    </Stage>
  ),
};
