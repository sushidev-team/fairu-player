import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VolumeControl } from './VolumeControl';

describe('VolumeControl pointer input', () => {
  it('sets and drags volume with touch, then stops on cancellation', () => {
    const change = vi.fn();
    render(<VolumeControl volume={1} muted={false} orientation="horizontal" onVolumeChange={change} />);
    const slider = screen.getByRole('slider', { name: 'Volume' });
    slider.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 44 } as DOMRect);
    fireEvent.pointerDown(slider, { pointerId: 7, pointerType: 'touch', clientX: 35, clientY: 30 });
    expect(change).toHaveBeenLastCalledWith(0.25);
    fireEvent.pointerMove(slider, { pointerId: 7, pointerType: 'touch', clientX: 85, clientY: 30 });
    expect(change).toHaveBeenLastCalledWith(0.75);
    fireEvent.pointerCancel(slider, { pointerId: 7 });
    change.mockClear();
    fireEvent.pointerMove(slider, { pointerId: 7, pointerType: 'touch', clientX: 110 });
    expect(change).not.toHaveBeenCalled();
  });

  it('ignores secondary touches and disabled sliders', () => {
    const change = vi.fn();
    const { rerender } = render(<VolumeControl volume={1} muted={false} orientation="horizontal" onVolumeChange={change} />);
    const slider = screen.getByRole('slider', { name: 'Volume' });
    fireEvent.pointerDown(slider, { pointerId: 2, pointerType: 'touch', isPrimary: false });
    expect(change).not.toHaveBeenCalled();
    rerender(<VolumeControl volume={1} muted={false} orientation="horizontal" onVolumeChange={change} disabled />);
    fireEvent.pointerDown(slider, { pointerId: 1, pointerType: 'touch' });
    expect(change).not.toHaveBeenCalled();
  });

  it('retains keyboard volume control', () => {
    const change = vi.fn();
    render(<VolumeControl volume={0.5} muted={false} onVolumeChange={change} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Volume' }), { key: 'ArrowUp' });
    expect(change).toHaveBeenLastCalledWith(0.55);
  });
});
