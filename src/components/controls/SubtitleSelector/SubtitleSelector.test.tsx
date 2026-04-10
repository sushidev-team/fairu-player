import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubtitleSelector } from './SubtitleSelector';
import { LabelsProvider } from '@/context/LabelsContext';
import type { ReactNode } from 'react';
import type { Subtitle } from '@/types/video';

// ─── Helpers ────────────────────────────────────────────────────────

function Wrapper({ children }: { children: ReactNode }) {
  return <LabelsProvider>{children}</LabelsProvider>;
}

function createSubtitles(): Subtitle[] {
  return [
    { id: 'en', label: 'English', language: 'en', src: '/subs/en.vtt' },
    { id: 'de', label: 'Deutsch', language: 'de', src: '/subs/de.vtt' },
    { id: 'fr', label: 'Fran\u00e7ais', language: 'fr', src: '/subs/fr.vtt' },
  ];
}

function renderSubtitleSelector(
  props: Partial<Parameters<typeof SubtitleSelector>[0]> = {}
) {
  const defaults = {
    currentSubtitle: null as string | null,
    subtitles: createSubtitles(),
    onSubtitleChange: vi.fn(),
  };
  return render(<SubtitleSelector {...defaults} {...props} />, { wrapper: Wrapper });
}

describe('SubtitleSelector', () => {
  // ── Basic rendering ───────────────────────────────────────────────

  it('renders the CC toggle button', () => {
    renderSubtitleSelector();
    expect(screen.getByRole('button', { name: 'Subtitles' })).toBeInTheDocument();
  });

  it('renders nothing when subtitles array is empty', () => {
    const { container } = renderSubtitleSelector({ subtitles: [] });
    expect(container.firstChild).toBeNull();
  });

  it('applies custom className', () => {
    const { container } = renderSubtitleSelector({ className: 'my-selector' });
    expect(container.querySelector('.fp-subtitle-selector')?.className).toContain('my-selector');
  });

  // ── Dropdown toggle ───────────────────────────────────────────────

  it('does not show dropdown initially', () => {
    renderSubtitleSelector();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows dropdown when toggle button is clicked', () => {
    renderSubtitleSelector();
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('hides dropdown when toggle button is clicked again', () => {
    renderSubtitleSelector();
    const btn = screen.getByRole('button', { name: 'Subtitles' });
    fireEvent.click(btn);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('sets aria-expanded to true when open', () => {
    renderSubtitleSelector();
    const btn = screen.getByRole('button', { name: 'Subtitles' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('has aria-haspopup listbox', () => {
    renderSubtitleSelector();
    const btn = screen.getByRole('button', { name: 'Subtitles' });
    expect(btn.getAttribute('aria-haspopup')).toBe('listbox');
  });

  // ── Dropdown content ──────────────────────────────────────────────

  it('shows "Off" option in dropdown', () => {
    renderSubtitleSelector();
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('shows all subtitle options in dropdown', () => {
    renderSubtitleSelector();
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Deutsch')).toBeInTheDocument();
    expect(screen.getByText('Fran\u00e7ais')).toBeInTheDocument();
  });

  it('marks "Off" as selected when currentSubtitle is null', () => {
    renderSubtitleSelector({ currentSubtitle: null });
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    const offOption = screen.getByRole('option', { name: /Off/ });
    expect(offOption.getAttribute('aria-selected')).toBe('true');
  });

  it('marks current subtitle as selected', () => {
    renderSubtitleSelector({ currentSubtitle: 'de' });
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    const deOption = screen.getByRole('option', { name: /Deutsch/ });
    expect(deOption.getAttribute('aria-selected')).toBe('true');
  });

  it('shows checkmark on selected subtitle', () => {
    renderSubtitleSelector({ currentSubtitle: 'en' });
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    const enOption = screen.getByRole('option', { name: /English/ });
    expect(enOption.querySelector('svg')).toBeTruthy();
  });

  it('does not show checkmark on unselected subtitle', () => {
    renderSubtitleSelector({ currentSubtitle: 'en' });
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    const deOption = screen.getByRole('option', { name: /Deutsch/ });
    expect(deOption.querySelector('svg')).toBeNull();
  });

  // ── Selection ─────────────────────────────────────────────────────

  it('calls onSubtitleChange with null when "Off" is selected', () => {
    const onChange = vi.fn();
    renderSubtitleSelector({ currentSubtitle: 'en', onSubtitleChange: onChange });
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    fireEvent.click(screen.getByText('Off'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onSubtitleChange with subtitle id when subtitle is selected', () => {
    const onChange = vi.fn();
    renderSubtitleSelector({ onSubtitleChange: onChange });
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    fireEvent.click(screen.getByText('English'));
    expect(onChange).toHaveBeenCalledWith('en');
  });

  it('closes dropdown after selecting a subtitle', () => {
    renderSubtitleSelector();
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    fireEvent.click(screen.getByText('Deutsch'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes dropdown after selecting "Off"', () => {
    renderSubtitleSelector({ currentSubtitle: 'en' });
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    fireEvent.click(screen.getByText('Off'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  // ── Close behaviors ───────────────────────────────────────────────

  it('closes dropdown when clicking outside', () => {
    renderSubtitleSelector();
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes dropdown when Escape key is pressed', () => {
    renderSubtitleSelector();
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  // ── Disabled state ────────────────────────────────────────────────

  it('disables the toggle button when disabled', () => {
    renderSubtitleSelector({ disabled: true });
    expect(screen.getByRole('button', { name: 'Subtitles' })).toBeDisabled();
  });

  it('applies disabled styling', () => {
    renderSubtitleSelector({ disabled: true });
    expect(screen.getByRole('button', { name: 'Subtitles' }).className).toContain('opacity-50');
  });

  // ── Current subtitle label display ────────────────────────────────

  it('shows current subtitle label next to CC icon when subtitle is active', () => {
    renderSubtitleSelector({ currentSubtitle: 'en' });
    // The label is shown in a span with hidden sm:inline
    const btn = screen.getByRole('button', { name: 'Subtitles' });
    expect(btn.textContent).toContain('English');
  });

  it('does not show subtitle label when currentSubtitle is null', () => {
    renderSubtitleSelector({ currentSubtitle: null });
    const btn = screen.getByRole('button', { name: 'Subtitles' });
    // When null, the subtitle label span is not rendered
    expect(btn.textContent).not.toContain('English');
    expect(btn.textContent).not.toContain('Off');
  });

  // ── Custom labels ─────────────────────────────────────────────────

  it('uses custom labels', () => {
    renderSubtitleSelector({
      labels: {
        subtitles: 'Untertitel',
        subtitleOptions: 'Untertitel-Optionen',
        subtitlesOff: 'Aus',
      },
    });
    expect(screen.getByRole('button', { name: 'Untertitel' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Untertitel' }));
    expect(screen.getByText('Aus')).toBeInTheDocument();
  });

  it('uses custom subtitle options aria-label on listbox', () => {
    renderSubtitleSelector({
      labels: {
        subtitles: 'Untertitel',
        subtitleOptions: 'Untertitel-Optionen',
        subtitlesOff: 'Aus',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Untertitel' }));
    expect(screen.getByRole('listbox', { name: 'Untertitel-Optionen' })).toBeInTheDocument();
  });

  // ── Dropdown aria ─────────────────────────────────────────────────

  it('dropdown has correct listbox aria-label', () => {
    renderSubtitleSelector();
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    expect(screen.getByRole('listbox', { name: 'Subtitle options' })).toBeInTheDocument();
  });

  it('all options have role="option"', () => {
    renderSubtitleSelector();
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    // Off + 3 subtitles = 4 options
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
  });
});
