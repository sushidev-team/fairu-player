import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { MarkerList } from './MarkerList';
import type { TimelineMarker } from '@/types/markers';

const meta: Meta<typeof MarkerList> = {
  title: 'Markers/MarkerList',
  component: MarkerList,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '320px', padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MarkerList>;

const sampleMarkers: TimelineMarker[] = [
  {
    id: 'm1',
    time: 15,
    title: 'Introduction',
    previewImage: 'https://picsum.photos/seed/m1/160/90',
    color: '#ff4444',
  },
  {
    id: 'm2',
    time: 65,
    title: 'Main Topic Begins',
    previewImage: 'https://picsum.photos/seed/m2/160/90',
  },
  {
    id: 'm3',
    time: 142,
    title: 'Key Argument',
    previewImage: 'https://picsum.photos/seed/m3/160/90',
    color: '#44ff44',
  },
  {
    id: 'm4',
    time: 230,
    title: 'Summary & Conclusion',
    previewImage: 'https://picsum.photos/seed/m4/160/90',
  },
];

export const Default: Story = {
  args: {
    markers: sampleMarkers,
    currentTime: 70,
    duration: 300,
    activeMarkerIndex: 1,
  },
};

export const NoImages: Story = {
  args: {
    markers: sampleMarkers.map(({ previewImage: _, ...rest }) => rest),
    currentTime: 70,
    duration: 300,
    activeMarkerIndex: 1,
    showPreviewImage: false,
  },
};

export const Interactive: Story = {
  render: () => {
    const [activeIndex, setActiveIndex] = useState(0);

    return (
      <MarkerList
        markers={sampleMarkers}
        currentTime={sampleMarkers[activeIndex]?.time ?? 0}
        duration={300}
        activeMarkerIndex={activeIndex}
        onMarkerClick={(_marker, index) => setActiveIndex(index)}
      />
    );
  },
};
