import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PauseAd } from './PauseAd';
import type { PauseAd as PauseAdType } from '@/types/pauseAd';

const mockAd: PauseAdType = {
  id: 'test-ad',
  imageUrl: 'https://example.com/ad.jpg',
  clickThroughUrl: 'https://example.com',
  title: 'Test Ad Title',
  description: 'Test description',
  altText: 'Test alt text',
};

describe('PauseAd', () => {
  it('should render nothing when not visible', () => {
    const { container } = render(
      <PauseAd ad={mockAd} visible={false} onDismiss={() => {}} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('should render ad when visible', () => {
    render(<PauseAd ad={mockAd} visible={true} onDismiss={() => {}} />);
    expect(screen.getByTestId('pause-ad')).toBeInTheDocument();
    expect(screen.getByAltText('Test alt text')).toBeInTheDocument();
  });

  it('should display title and description', () => {
    render(<PauseAd ad={mockAd} visible={true} onDismiss={() => {}} />);
    expect(screen.getByText('Test Ad Title')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should show AD badge', () => {
    render(<PauseAd ad={mockAd} visible={true} onDismiss={() => {}} />);
    expect(screen.getByText('AD')).toBeInTheDocument();
  });

  it('should call onDismiss when close button clicked', () => {
    const onDismiss = vi.fn();
    render(<PauseAd ad={mockAd} visible={true} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('pause-ad-close'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('should show Learn More button when clickThroughUrl exists', () => {
    render(<PauseAd ad={mockAd} visible={true} onDismiss={() => {}} />);
    expect(screen.getByTestId('pause-ad-cta')).toBeInTheDocument();
    expect(screen.getByText('Learn More')).toBeInTheDocument();
  });

  it('should not show Learn More when no clickThroughUrl', () => {
    const adNoUrl = { ...mockAd, clickThroughUrl: undefined };
    render(<PauseAd ad={adNoUrl} visible={true} onDismiss={() => {}} />);
    expect(screen.queryByTestId('pause-ad-cta')).not.toBeInTheDocument();
  });

  it('should call onClick when ad image clicked', () => {
    const onClick = vi.fn();
    render(<PauseAd ad={mockAd} visible={true} onDismiss={() => {}} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('pause-ad-image'));
    expect(onClick).toHaveBeenCalledWith(mockAd);
  });

  it('should open clickthrough URL in new tab', () => {
    const windowOpen = vi.spyOn(window, 'open');
    render(<PauseAd ad={mockAd} visible={true} onDismiss={() => {}} />);
    fireEvent.click(screen.getByTestId('pause-ad-image'));
    expect(windowOpen).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    windowOpen.mockRestore();
  });
});
