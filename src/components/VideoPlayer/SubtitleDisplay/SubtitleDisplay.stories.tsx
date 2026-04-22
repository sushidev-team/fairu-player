import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SubtitleDisplay } from './SubtitleDisplay';
import { DEFAULT_SUBTITLE_STYLE, SUBTITLE_PRESETS } from '@/types/subtitleStyling';
import type { SubtitleStyle } from '@/types/subtitleStyling';

/** Convert a SubtitleStyle to React.CSSProperties (mirrors useSubtitleStyling logic) */
function styleToCss(s: SubtitleStyle): React.CSSProperties {
  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  return {
    fontSize: `${s.fontSize}px`,
    fontFamily: s.fontFamily,
    color: s.textColor,
    backgroundColor: hexToRgba(s.backgroundColor, s.backgroundOpacity),
    textShadow: s.textShadow,
    ...(s.position === 'top'
      ? { top: '10%', bottom: 'auto' }
      : { bottom: '10%', top: 'auto' }),
    padding: '4px 8px',
    borderRadius: '4px',
  };
}

const meta: Meta<typeof SubtitleDisplay> = {
  title: 'VideoPlayer/SubtitleDisplay',
  component: SubtitleDisplay,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <div className="fp-dark p-8 w-[640px]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SubtitleDisplay>;

export const OverlayMode: Story = {
  render: () => (
    <div className="relative bg-black aspect-video w-full flex items-center justify-center">
      <span className="text-white/20 text-sm">Mock Video</span>
      <SubtitleDisplay
        text="Hello, welcome to the show."
        mode="overlay"
        style={styleToCss(DEFAULT_SUBTITLE_STYLE)}
      />
    </div>
  ),
};

export const BelowMode: Story = {
  render: () => (
    <div>
      <div className="bg-black aspect-video w-full flex items-center justify-center">
        <span className="text-white/20 text-sm">Mock Video</span>
      </div>
      <SubtitleDisplay
        text="Hello, welcome to the show."
        mode="below"
        style={styleToCss(DEFAULT_SUBTITLE_STYLE)}
      />
    </div>
  ),
};

export const NoText: Story = {
  render: () => (
    <div className="relative bg-black aspect-video w-full flex items-center justify-center">
      <span className="text-white/20 text-sm">Mock Video</span>
      <SubtitleDisplay
        text={null}
        mode="overlay"
        style={styleToCss(DEFAULT_SUBTITLE_STYLE)}
      />
    </div>
  ),
};

export const StyledOverlay: Story = {
  render: () => (
    <div className="relative bg-black aspect-video w-full flex items-center justify-center">
      <span className="text-white/20 text-sm">Mock Video</span>
      <SubtitleDisplay
        text="Hello, welcome to the show."
        mode="overlay"
        style={{
          fontSize: '24px',
          color: '#ffff00',
          backgroundColor: 'rgba(0,0,0,0.9)',
          textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.5)',
          bottom: '10%',
          padding: '6px 12px',
          borderRadius: '4px',
        }}
      />
    </div>
  ),
};

export const Interactive: Story = {
  render: () => {
    const [text, setText] = useState('Hello, welcome to the show.');
    const [mode, setMode] = useState<'overlay' | 'below'>('overlay');
    const [activePreset, setActivePreset] = useState<string>('default');
    const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(
      DEFAULT_SUBTITLE_STYLE
    );

    const handlePreset = (presetName: string) => {
      const preset = SUBTITLE_PRESETS.find((p) => p.name === presetName);
      if (preset) {
        setSubtitleStyle(preset.style);
        setActivePreset(presetName);
      }
    };

    const cssProps = styleToCss(subtitleStyle);

    return (
      <div>
        {/* Video container */}
        {mode === 'overlay' ? (
          <div className="relative bg-black aspect-video w-full flex items-center justify-center">
            <span className="text-white/20 text-sm">Mock Video</span>
            <SubtitleDisplay text={text} mode="overlay" style={cssProps} />
          </div>
        ) : (
          <>
            <div className="bg-black aspect-video w-full flex items-center justify-center">
              <span className="text-white/20 text-sm">Mock Video</span>
            </div>
            <SubtitleDisplay text={text} mode="below" style={cssProps} />
          </>
        )}

        {/* Controls */}
        <div
          style={{
            marginTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Text input */}
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}
            >
              Subtitle text
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid #444',
                backgroundColor: '#222',
                color: '#fff',
                fontSize: '14px',
              }}
            />
          </div>

          {/* Mode toggle */}
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}
            >
              Mode
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['overlay', 'below'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    border: '1px solid #555',
                    backgroundColor: mode === m ? '#4f46e5' : '#333',
                    color: '#fff',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Preset buttons */}
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}
            >
              Style presets
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {SUBTITLE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePreset(preset.name)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    border: '1px solid #555',
                    backgroundColor:
                      activePreset === preset.name ? '#4f46e5' : '#333',
                    color: '#fff',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Current state */}
          <div style={{ fontSize: '12px', color: '#777' }}>
            <div>Mode: {mode}</div>
            <div>Preset: {activePreset}</div>
            <div>Font size: {subtitleStyle.fontSize}px</div>
            <div>Text color: {subtitleStyle.textColor}</div>
          </div>
        </div>
      </div>
    );
  },
};
