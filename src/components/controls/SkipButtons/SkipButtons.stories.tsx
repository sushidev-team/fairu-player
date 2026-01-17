import type { Meta, StoryObj } from '@storybook/react';
import { SkipButton, SkipButtons } from './SkipButtons';

const meta: Meta<typeof SkipButtons> = {
  title: 'Controls/SkipButtons',
  component: SkipButtons,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SkipButtons>;

export const Default: Story = {
  args: {
    forwardSeconds: 30,
    backwardSeconds: 10,
  },
};

export const CustomTimes: Story = {
  args: {
    forwardSeconds: 15,
    backwardSeconds: 15,
  },
};

export const Disabled: Story = {
  args: {
    forwardSeconds: 30,
    backwardSeconds: 10,
    disabled: true,
  },
};

// Individual buttons
export const ForwardButton: StoryObj<typeof SkipButton> = {
  render: () => <SkipButton direction="forward" seconds={30} />,
};

export const BackwardButton: StoryObj<typeof SkipButton> = {
  render: () => <SkipButton direction="backward" seconds={10} />,
};
