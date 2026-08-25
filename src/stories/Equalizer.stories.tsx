import type { Meta, StoryObj } from '@storybook/react';
import { useRef } from 'react';
import { Equalizer } from '@/components/controls/Equalizer';
import { useEqualizer } from '@/hooks/useEqualizer';
import { SAMPLE_AUDIO } from '@/stories/fixtures';
import { Note, Panel, Snippet, Stage } from '@/stories/preview-kit';

const meta: Meta = {
  title: 'Hooks/Equalizer',
  parameters: {
    docs: {
      description: {
        component:
          'A five-band equaliser over the element audio. Web Audio is a one-way ' +
          'door — once an element is routed through it, it stays routed — so the ' +
          'hook is built around never having to undo that.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

function Demo({ src, crossOrigin }: { src: string; crossOrigin?: 'anonymous' }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const eq = useEqualizer({ mediaRef: audioRef });

  return (
    <div className="flex flex-col gap-4">
      <audio ref={audioRef} src={src} controls crossOrigin={crossOrigin} className="w-full" />

      <Equalizer
        bands={eq.bands}
        presets={eq.presets}
        currentPreset={eq.currentPreset}
        enabled={eq.enabled}
        onToggle={eq.setEnabled}
        onBandChange={eq.setBandGain}
        onPresetSelect={eq.applyPreset}
        onReset={eq.reset}
        blockedByCors={eq.blockedByCors}
      />

      <div className="text-xs opacity-70">
        {eq.blockedByCors
          ? 'Quelle ohne crossorigin — Web Audio liefert hier Stille.'
          : eq.isConnected
            ? 'Filterkette aktiv'
            : 'nicht verbunden'}
      </div>
    </div>
  );
}

/**
 * Press play, switch the equaliser on, then drag a band. The difference is
 * audible immediately — the gains reach the running filters rather than
 * rebuilding the chain.
 */
export const Interactive: Story = {
  render: () => (
    <Stage
      title="Equalizer"
      description="Erst abspielen, dann einschalten. Die Regler wirken sofort."
      maxWidth={560}
      aside={
        <div className="flex flex-col gap-3">
          <Panel title="Eine Einbahnstraße">
            <p className="text-sm opacity-80">
              <code>createMediaElementSource</code> darf pro Element{' '}
              <strong>einmal</strong> aufgerufen werden, und danach läuft dessen
              Ton für immer durch Web Audio. Ausschalten heißt deshalb
              „durchschleifen", nicht „abbauen".
            </p>
          </Panel>
          <Note tone="warn">
            Den <code>AudioContext</code> zu schließen, während ein Element
            hineingeroutet ist, macht dieses Element dauerhaft stumm. Der Hook
            schließt ihn nie.
          </Note>
        </div>
      }
    >
      <Demo src={SAMPLE_AUDIO.horse} crossOrigin="anonymous" />
    </Stage>
  ),
};

/**
 * The same panel with a source the browser will not let Web Audio read. Nothing
 * here can work, so nothing here pretends to.
 */
export const CrossOriginSource: Story = {
  render: () => (
    <Stage
      title="Fremde Quelle ohne crossorigin"
      description="Der Browser gibt Web Audio hier nur Stille. Das Panel schaltet sich deshalb ab, statt den Hörer sich selbst stummschalten zu lassen."
      maxWidth={560}
    >
      <Demo src={SAMPLE_AUDIO.horse} />
    </Stage>
  ),
};

/** How it is wired up. */
export const Usage: Story = {
  render: () => (
    <Stage title="Usage" maxWidth={560}>
      <Snippet
        code={`import { useRef } from 'react';
import { useEqualizer, Equalizer } from '@fairu/player';

function Player({ src }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const eq = useEqualizer({ mediaRef: audioRef });

  return (
    <>
      {/* Without crossorigin a foreign source comes through as silence. */}
      <audio ref={audioRef} src={src} crossOrigin="anonymous" />

      <Equalizer
        bands={eq.bands}
        presets={eq.presets}
        currentPreset={eq.currentPreset}
        enabled={eq.enabled}
        onToggle={eq.setEnabled}
        onBandChange={eq.setBandGain}
        onPresetSelect={eq.applyPreset}
        onReset={eq.reset}
        blockedByCors={eq.blockedByCors}
      />
    </>
  );
}`}
      />
    </Stage>
  ),
};
