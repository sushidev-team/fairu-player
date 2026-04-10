import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Equalizer } from './Equalizer';
import { DEFAULT_BANDS, EQUALIZER_PRESETS } from '@/types/equalizer';
import type { EqualizerBand } from '@/types/equalizer';

const meta: Meta<typeof Equalizer> = {
  title: 'Controls/Equalizer',
  component: Equalizer,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <div className="fp-dark p-8 w-[400px]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Equalizer>;

export const Default: Story = {
  args: {
    bands: DEFAULT_BANDS,
    presets: EQUALIZER_PRESETS,
    currentPreset: 'flat',
    enabled: true,
    onBandChange: () => {},
    onPresetSelect: () => {},
    onReset: () => {},
    onEnabledChange: () => {},
  },
};

export const Disabled: Story = {
  args: {
    bands: DEFAULT_BANDS,
    presets: EQUALIZER_PRESETS,
    currentPreset: 'flat',
    enabled: false,
    onBandChange: () => {},
    onPresetSelect: () => {},
    onReset: () => {},
    onEnabledChange: () => {},
  },
};

export const PodcastPreset: Story = {
  args: {
    bands: DEFAULT_BANDS.map((band, i) => ({
      ...band,
      gain: [-2, 1, 4, 3, 1][i],
    })),
    presets: EQUALIZER_PRESETS,
    currentPreset: 'podcast',
    enabled: true,
    onBandChange: () => {},
    onPresetSelect: () => {},
    onReset: () => {},
    onEnabledChange: () => {},
  },
};

export const BassBoost: Story = {
  args: {
    bands: DEFAULT_BANDS.map((band, i) => ({
      ...band,
      gain: [6, 4, 0, 0, 0][i],
    })),
    presets: EQUALIZER_PRESETS,
    currentPreset: 'bass-boost',
    enabled: true,
    onBandChange: () => {},
    onPresetSelect: () => {},
    onReset: () => {},
    onEnabledChange: () => {},
  },
};

export const Interactive: Story = {
  render: () => {
    const [bands, setBands] = useState<EqualizerBand[]>(DEFAULT_BANDS);
    const [enabled, setEnabled] = useState(true);
    const [currentPreset, setCurrentPreset] = useState<string | null>('flat');

    const handleBandChange = (index: number, gain: number) => {
      setBands((prev) =>
        prev.map((band, i) => (i === index ? { ...band, gain } : band))
      );
      setCurrentPreset(null);
    };

    const handlePresetSelect = (presetName: string) => {
      const preset = EQUALIZER_PRESETS.find((p) => p.name === presetName);
      if (preset) {
        setBands((prev) =>
          prev.map((band, i) => ({ ...band, gain: preset.bands[i] }))
        );
        setCurrentPreset(presetName);
      }
    };

    const handleReset = () => {
      setBands(DEFAULT_BANDS);
      setCurrentPreset('flat');
    };

    return (
      <div>
        <Equalizer
          bands={bands}
          onBandChange={handleBandChange}
          onPresetSelect={handlePresetSelect}
          onReset={handleReset}
          presets={EQUALIZER_PRESETS}
          currentPreset={currentPreset}
          enabled={enabled}
          onEnabledChange={setEnabled}
        />
        <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--fp-color-text-muted)' }}>
          <div>Preset: {currentPreset ?? 'Custom'}</div>
          <div>Bands: [{bands.map((b) => b.gain).join(', ')}]</div>
          <div>Enabled: {enabled ? 'Yes' : 'No'}</div>
        </div>
      </div>
    );
  },
};
