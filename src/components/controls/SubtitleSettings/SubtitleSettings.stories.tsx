import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SubtitleSettings } from './SubtitleSettings';
import { DEFAULT_SUBTITLE_STYLE, SUBTITLE_PRESETS } from '@/types/subtitleStyling';
import type { SubtitleStyle } from '@/types/subtitleStyling';

const meta: Meta<typeof SubtitleSettings> = {
  title: 'Controls/SubtitleSettings',
  component: SubtitleSettings,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ minHeight: '400px', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SubtitleSettings>;

export const Default: Story = {
  args: {
    style: { ...DEFAULT_SUBTITLE_STYLE },
    presets: SUBTITLE_PRESETS,
    onStyleChange: () => {},
    onPresetSelect: () => {},
    onReset: () => {},
  },
};

export const Disabled: Story = {
  args: {
    style: { ...DEFAULT_SUBTITLE_STYLE },
    presets: SUBTITLE_PRESETS,
    onStyleChange: () => {},
    onPresetSelect: () => {},
    onReset: () => {},
    disabled: true,
  },
};

export const Interactive: Story = {
  render: () => {
    const [style, setStyle] = useState<SubtitleStyle>({ ...DEFAULT_SUBTITLE_STYLE });

    const handleStyleChange = (updates: Partial<SubtitleStyle>) => {
      setStyle((prev) => ({ ...prev, ...updates }));
    };

    const handlePresetSelect = (presetName: string) => {
      const preset = SUBTITLE_PRESETS.find((p) => p.name === presetName);
      if (preset) {
        setStyle({ ...preset.style });
      }
    };

    const handleReset = () => {
      setStyle({ ...DEFAULT_SUBTITLE_STYLE });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '24px' }}>
        <SubtitleSettings
          style={style}
          onStyleChange={handleStyleChange}
          onPresetSelect={handlePresetSelect}
          onReset={handleReset}
          presets={SUBTITLE_PRESETS}
        />
        <div
          style={{
            position: 'relative',
            width: '480px',
            height: '120px',
            background: '#1a1a2e',
            borderRadius: '8px',
            display: 'flex',
            alignItems: style.position === 'top' ? 'flex-start' : 'flex-end',
            justifyContent: 'center',
            padding: '16px',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: `${style.fontSize}px`,
              fontFamily: style.fontFamily,
              color: style.textColor,
              backgroundColor: `${style.backgroundColor}${Math.round(style.backgroundOpacity * 255)
                .toString(16)
                .padStart(2, '0')}`,
              textShadow: style.textShadow,
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            This is a subtitle preview
          </span>
        </div>
      </div>
    );
  },
};
