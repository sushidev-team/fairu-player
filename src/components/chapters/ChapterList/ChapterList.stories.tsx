import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ChapterList } from './ChapterList';
import type { Chapter } from '@/types/player';

const sampleChapters: Chapter[] = [
  { id: '1', title: 'Introduction', startTime: 0, image: 'https://picsum.photos/100?random=1' },
  { id: '2', title: 'Main Topic Discussion', startTime: 120, image: 'https://picsum.photos/100?random=2' },
  { id: '3', title: 'Deep Dive into Details', startTime: 300, image: 'https://picsum.photos/100?random=3' },
  { id: '4', title: 'Q&A Session', startTime: 480, image: 'https://picsum.photos/100?random=4' },
  { id: '5', title: 'Conclusion & Wrap Up', startTime: 600, image: 'https://picsum.photos/100?random=5' },
];

const meta: Meta<typeof ChapterList> = {
  title: 'Chapters/ChapterList',
  component: ChapterList,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '400px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ChapterList>;

export const Default: Story = {
  args: {
    chapters: sampleChapters,
    currentChapterIndex: 1,
    currentTime: 150,
    duration: 720,
  },
};

export const NoImages: Story = {
  args: {
    chapters: sampleChapters.map(({ image, ...c }) => c),
    currentChapterIndex: 2,
    currentTime: 350,
    duration: 720,
    showImage: false,
  },
};

export const NoDuration: Story = {
  args: {
    chapters: sampleChapters,
    currentChapterIndex: 0,
    currentTime: 30,
    duration: 720,
    showDuration: false,
  },
};

export const Interactive: Story = {
  render: () => {
    const [currentTime, setCurrentTime] = useState(150);
    const duration = 720;

    const getCurrentChapterIndex = () => {
      for (let i = sampleChapters.length - 1; i >= 0; i--) {
        if (currentTime >= sampleChapters[i].startTime) return i;
      }
      return 0;
    };

    return (
      <ChapterList
        chapters={sampleChapters}
        currentChapterIndex={getCurrentChapterIndex()}
        currentTime={currentTime}
        duration={duration}
        onChapterClick={(chapter) => setCurrentTime(chapter.startTime)}
      />
    );
  },
};
