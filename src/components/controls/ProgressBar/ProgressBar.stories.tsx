import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ProgressBar } from './ProgressBar';
import type { Chapter } from '@/types/player';
import type { TimelineMarker } from '@/types/markers';

const meta: Meta<typeof ProgressBar> = {
  title: 'Controls/ProgressBar',
  component: ProgressBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '400px', padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Default: Story = {
  args: {
    currentTime: 60,
    duration: 300,
    buffered: 120,
  },
};

export const WithChapters: Story = {
  args: {
    currentTime: 90,
    duration: 300,
    buffered: 150,
    chapters: [
      { id: '1', title: 'Intro', startTime: 0 },
      { id: '2', title: 'Main Topic', startTime: 60 },
      { id: '3', title: 'Discussion', startTime: 180 },
      { id: '4', title: 'Outro', startTime: 270 },
    ] as Chapter[],
  },
};

export const NoTooltip: Story = {
  args: {
    currentTime: 60,
    duration: 300,
    showTooltip: false,
  },
};

export const Disabled: Story = {
  args: {
    currentTime: 60,
    duration: 300,
    disabled: true,
  },
};

export const Interactive: Story = {
  render: () => {
    const [time, setTime] = useState(60);
    const duration = 300;

    return (
      <div>
        <ProgressBar
          currentTime={time}
          duration={duration}
          buffered={Math.min(duration, time + 60)}
          onSeek={setTime}
        />
        <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--fp-color-text-muted)' }}>
          Current time: {Math.floor(time)}s / {duration}s
        </div>
      </div>
    );
  },
};

const sampleMarkers: TimelineMarker[] = [
  { id: 'm1', time: 30, title: 'Key Moment 1', color: '#ff4444' },
  { id: 'm2', time: 90, title: 'Key Moment 2' },
  { id: 'm3', time: 150, title: 'Key Moment 3', color: '#44ff44' },
  { id: 'm4', time: 240, title: 'Key Moment 4' },
];

export const WithMarkers: Story = {
  args: {
    currentTime: 60,
    duration: 300,
    buffered: 150,
    markers: sampleMarkers,
  },
};

export const WithMarkersAndChapters: Story = {
  args: {
    currentTime: 90,
    duration: 300,
    buffered: 150,
    chapters: [
      { id: '1', title: 'Intro', startTime: 0 },
      { id: '2', title: 'Main Topic', startTime: 60 },
      { id: '3', title: 'Discussion', startTime: 180 },
      { id: '4', title: 'Outro', startTime: 270 },
    ] as Chapter[],
    markers: sampleMarkers,
  },
};

export const WithABLoop: Story = {
  args: {
    currentTime: 90,
    duration: 300,
    buffered: 200,
    loopStart: 60,
    loopEnd: 180,
  },
};

export const ABLoopInteractive: Story = {
  render: () => {
    const [time, setTime] = useState(90);
    const [loopStart, setLoopStart] = useState<number | null>(null);
    const [loopEnd, setLoopEnd] = useState<number | null>(null);
    const duration = 300;

    const formatSeconds = (s: number | null) =>
      s !== null ? `${Math.floor(s)}s` : '—';

    return (
      <div>
        <ProgressBar
          currentTime={time}
          duration={duration}
          buffered={Math.min(duration, time + 60)}
          loopStart={loopStart}
          loopEnd={loopEnd}
          onSeek={setTime}
        />
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setLoopStart(time)}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: '1px solid #666',
              background: loopStart !== null ? '#2563eb' : '#333',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Set A
          </button>
          <button
            type="button"
            onClick={() => setLoopEnd(time)}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: '1px solid #666',
              background: loopEnd !== null ? '#2563eb' : '#333',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Set B
          </button>
          <button
            type="button"
            onClick={() => {
              setLoopStart(null);
              setLoopEnd(null);
            }}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: '1px solid #666',
              background: '#333',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Clear Loop
          </button>
        </div>
        <div
          style={{
            marginTop: '12px',
            fontSize: '14px',
            color: 'var(--fp-color-text-muted)',
            display: 'flex',
            gap: '16px',
          }}
        >
          <span>Current: {Math.floor(time)}s / {duration}s</span>
          <span>Loop A: {formatSeconds(loopStart)}</span>
          <span>Loop B: {formatSeconds(loopEnd)}</span>
        </div>
      </div>
    );
  },
};
