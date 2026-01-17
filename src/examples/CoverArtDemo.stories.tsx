import type { Meta, StoryObj } from '@storybook/react';
import { CoverArtDemo } from './CoverArtDemo';

const meta: Meta<typeof CoverArtDemo> = {
  title: 'Examples/CoverArtDemo',
  component: CoverArtDemo,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof CoverArtDemo>;

export const Default: Story = {};
