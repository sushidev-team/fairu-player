/**
 * Shared preview primitives for Storybook stories.
 *
 * Every story in this repo used to re-invent its own layout, so previews looked
 * inconsistent and interactive demos had no way to show what the component was
 * actually doing. This kit gives all of them the same vocabulary:
 *
 * - {@link Stage} — a titled surface every preview sits on
 * - {@link PhoneFrame} / {@link Viewport} — realistic device framing
 * - {@link Matrix} — render one component across a prop grid
 * - {@link EventLog} + {@link useEventLog} — a live event console
 * - {@link StateInspector} — the component's current state, at a glance
 * - {@link Panel}, {@link Toggle}, {@link Range}, {@link Segmented}, {@link Button}
 *   — controls for interactive demos
 * - {@link Snippet} — the code that produces what you are looking at
 *
 * Everything is styled with the player's own `--fp-*` custom properties, so a
 * preview automatically follows the theme selected in the Storybook toolbar.
 */

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/utils/cn';

/* -------------------------------------------------------------------------- */
/*                                   Stage                                    */
/* -------------------------------------------------------------------------- */

export interface StageProps {
  /** Short title above the preview. */
  title?: string;
  /** One or two sentences on what to look at or try. */
  description?: React.ReactNode;
  /** Layout of the preview area. */
  layout?: 'center' | 'stretch' | 'columns';
  /** Constrain the preview width. */
  maxWidth?: number | string;
  /** Render the surface flush, without padding — used for full-bleed players. */
  bleed?: boolean;
  /** Content rendered to the right of (or below) the preview. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * The standard frame for a preview: a title, a note, the component, and an
 * optional aside for controls or logs.
 */
export function Stage({
  title,
  description,
  layout = 'center',
  maxWidth,
  bleed = false,
  aside,
  children,
  className,
}: StageProps) {
  return (
    <div
      className={cn('fp-stage flex w-full flex-col gap-4', className)}
      style={{ fontFamily: 'var(--fp-font-family)', color: 'var(--fp-color-text)' }}
    >
      {(title || description) && (
        <header className="flex flex-col gap-1">
          {title && (
            <h3 className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--fp-color-text-primary)' }}>
              {title}
            </h3>
          )}
          {description && (
            <p className="max-w-2xl text-[13px] leading-relaxed" style={{ color: 'var(--fp-color-text-secondary)' }}>
              {description}
            </p>
          )}
        </header>
      )}

      <div className={cn('flex gap-5', aside ? 'flex-col xl:flex-row xl:items-start' : 'flex-col')}>
        <div
          className={cn(
            'min-w-0 flex-1 rounded-xl',
            bleed ? 'p-0' : 'p-6',
            layout === 'center' && 'flex items-center justify-center',
            layout === 'columns' && 'flex flex-wrap items-center gap-6'
          )}
          style={{
            background: 'var(--fp-color-background-elevated)',
            border: '1px solid var(--fp-border-color)',
            maxWidth: maxWidth ?? undefined,
          }}
        >
          {children}
        </div>

        {aside && <div className="flex w-full shrink-0 flex-col gap-4 xl:w-[320px]">{aside}</div>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Framing                                   */
/* -------------------------------------------------------------------------- */

export interface PhoneFrameProps {
  children: React.ReactNode;
  /** Frame height in px. Width follows from a 9:16 screen. Default 720. */
  height?: number;
  /** Show the notch and home indicator. Default `true`. */
  chrome?: boolean;
  label?: string;
  className?: string;
}

/**
 * A phone bezel for vertical, full-bleed previews.
 *
 * Short-form video is designed for a portrait screen with a notch eating the top
 * ~44px and a home indicator at the bottom. Previewing a reels feed in a plain
 * rectangle hides exactly the overlap problems this framing surfaces.
 */
export function PhoneFrame({
  children,
  height = 720,
  chrome = true,
  label,
  className,
}: PhoneFrameProps) {
  const width = Math.round((height * 9) / 16);

  return (
    <figure className={cn('m-0 flex flex-col items-center gap-2', className)}>
      <div
        className="relative shrink-0 overflow-hidden rounded-[2.25rem] bg-black p-[10px] shadow-2xl"
        style={{
          width: width + 20,
          height: height + 20,
          boxShadow: '0 0 0 2px #2a2a2a, 0 24px 48px rgba(0,0,0,0.45)',
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] bg-black">
          {children}

          {chrome && (
            <>
              <div className="pointer-events-none absolute left-1/2 top-2 z-50 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
              <div className="pointer-events-none absolute bottom-2 left-1/2 z-50 h-1 w-28 -translate-x-1/2 rounded-full bg-white/60" />
            </>
          )}
        </div>
      </div>

      {label && (
        <figcaption className="text-[11px] tabular-nums" style={{ color: 'var(--fp-color-text-muted)' }}>
          {label} · {width}×{height}
        </figcaption>
      )}
    </figure>
  );
}

export interface ViewportProps {
  children: React.ReactNode;
  width?: number | string;
  aspect?: string;
  label?: string;
  className?: string;
}

/** A plain sized box — for landscape players and page-level components. */
export function Viewport({ children, width = 800, aspect, label, className }: ViewportProps) {
  return (
    <figure className={cn('m-0 flex w-full flex-col items-center gap-2', className)}>
      <div className="w-full" style={{ maxWidth: width, aspectRatio: aspect }}>
        {children}
      </div>
      {label && (
        <figcaption className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
          {label}
        </figcaption>
      )}
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Matrix                                   */
/* -------------------------------------------------------------------------- */

export interface MatrixProps<T> {
  /** One entry per cell. */
  items: T[];
  /** Cell label. */
  label: (item: T, index: number) => React.ReactNode;
  /** Cell content. */
  render: (item: T, index: number) => React.ReactNode;
  /** Cells per row. Default: auto-fit at 140px. */
  columns?: number;
  /** Dark cell background — use for controls designed to sit on video. */
  onVideo?: boolean;
  className?: string;
}

/**
 * Render one component across every value of a prop, all visible at once.
 *
 * This replaces the pattern of one story per variant: comparing six sizes is
 * only possible when they are side by side.
 */
export function Matrix<T>({
  items,
  label,
  render,
  columns,
  onVideo = false,
  className,
}: MatrixProps<T>) {
  return (
    <div
      className={cn('grid w-full gap-3', className)}
      style={{
        gridTemplateColumns: columns
          ? `repeat(${columns}, minmax(0, 1fr))`
          : 'repeat(auto-fit, minmax(140px, 1fr))',
      }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className="flex flex-col items-center gap-2 rounded-lg p-4"
          style={{
            background: onVideo
              ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
              : 'var(--fp-color-surface)',
            border: '1px solid var(--fp-border-color)',
          }}
        >
          <div className="flex min-h-[48px] items-center justify-center">{render(item, index)}</div>
          <span
            className="text-center text-[11px] font-medium"
            style={{ color: onVideo ? 'rgba(255,255,255,0.55)' : 'var(--fp-color-text-muted)' }}
          >
            {label(item, index)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Panel                                    */
/* -------------------------------------------------------------------------- */

export interface PanelProps {
  title: string;
  /** Small text on the right of the header, e.g. a count. */
  meta?: React.ReactNode;
  /** Right-aligned header action. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** A titled card. The building block for controls, logs and inspectors. */
export function Panel({ title, meta, action, children, className }: PanelProps) {
  return (
    <section
      className={cn('overflow-hidden rounded-xl', className)}
      style={{
        background: 'var(--fp-color-background-elevated)',
        border: '1px solid var(--fp-border-color)',
      }}
    >
      <header
        className="flex items-center justify-between gap-2 px-3 py-2"
        style={{ borderBottom: '1px solid var(--fp-border-color)' }}
      >
        <div className="flex items-baseline gap-2">
          <h4
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--fp-color-text-secondary)' }}
          >
            {title}
          </h4>
          {meta && (
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--fp-color-text-muted)' }}>
              {meta}
            </span>
          )}
        </div>
        {action}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Controls                                  */
/* -------------------------------------------------------------------------- */

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
}

/** A labelled switch. */
export function Toggle({ label, checked, onChange, hint, disabled }: ToggleProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3 py-1.5',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <span className="flex flex-col">
        <span className="text-[13px]" style={{ color: 'var(--fp-color-text-primary)' }}>
          {label}
        </span>
        {hint && (
          <span className="text-[11px]" style={{ color: 'var(--fp-color-text-muted)' }}>
            {hint}
          </span>
        )}
      </span>

      <span className="relative shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          className="block h-5 w-9 rounded-full transition-colors"
          style={{ background: checked ? 'var(--fp-color-accent)' : 'var(--fp-progress-bg)' }}
        />
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
          style={{ left: checked ? '1.125rem' : '0.125rem' }}
        />
      </span>
    </label>
  );
}

export interface RangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Rendered next to the label, e.g. `${value}s`. */
  format?: (value: number) => string;
}

/** A labelled slider with a live value read-out. */
export function Range({ label, value, min, max, step = 1, onChange, format }: RangeProps) {
  return (
    <label className="flex flex-col gap-1.5 py-1.5">
      <span className="flex items-baseline justify-between">
        <span className="text-[13px]" style={{ color: 'var(--fp-color-text-primary)' }}>
          {label}
        </span>
        <span
          className="text-[12px] tabular-nums"
          style={{ color: 'var(--fp-color-text-secondary)' }}
        >
          {format ? format(value) : value}
        </span>
      </span>
      <input
        type="range"
        className="fp-slider-modern"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export interface SegmentedProps<T extends string | number> {
  label?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

/** A compact single-choice control. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="flex flex-col gap-1.5 py-1.5">
      {label && (
        <span className="text-[13px]" style={{ color: 'var(--fp-color-text-primary)' }}>
          {label}
        </span>
      )}
      <div
        className="flex gap-0.5 rounded-lg p-0.5"
        style={{ background: 'var(--fp-color-surface)' }}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className="flex-1 rounded-md px-2 py-1 text-[12px] font-medium transition-colors"
              style={{
                background: active ? 'var(--fp-color-accent)' : 'transparent',
                color: active ? '#000' : 'var(--fp-color-text-secondary)',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
}

/** A plain button for triggering demo actions. */
export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ButtonProps) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--fp-color-accent)', color: '#000' },
    secondary: {
      background: 'var(--fp-color-surface)',
      color: 'var(--fp-color-text-primary)',
      border: '1px solid var(--fp-border-color)',
    },
    ghost: { background: 'transparent', color: 'var(--fp-color-text-secondary)' },
  };

  return (
    <button
      type="button"
      className={cn(
        'rounded-lg font-medium transition-opacity hover:opacity-85 disabled:opacity-40',
        size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[13px]',
        className
      )}
      style={styles[variant]}
      {...rest}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Event log                                  */
/* -------------------------------------------------------------------------- */

export interface LogEntry {
  id: number;
  /** Wall-clock time the entry was recorded. */
  at: number;
  /** Event name. */
  event: string;
  /** Optional detail line. */
  detail?: string;
  /** Colour bucket — drives the dot next to the entry. */
  tone?: 'info' | 'ad' | 'success' | 'warn' | 'error';
}

export interface UseEventLogReturn {
  entries: LogEntry[];
  log: (event: string, detail?: string, tone?: LogEntry['tone']) => void;
  clear: () => void;
  /** Count per event name — handy for asserting "fired exactly once". */
  counts: Record<string, number>;
}

/**
 * Collect events for {@link EventLog}.
 *
 * Newest entries come first and the list is capped, so a chatty callback like
 * `onReelProgress` cannot grow the DOM without bound.
 */
export function useEventLog(limit = 60): UseEventLogReturn {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const idRef = useRef(0);

  const log = useCallback(
    (event: string, detail?: string, tone: LogEntry['tone'] = 'info') => {
      idRef.current += 1;
      const entry: LogEntry = { id: idRef.current, at: Date.now(), event, detail, tone };

      setEntries((prev) => [entry, ...prev].slice(0, limit));
      setCounts((prev) => ({ ...prev, [event]: (prev[event] ?? 0) + 1 }));
    },
    [limit]
  );

  const clear = useCallback(() => {
    setEntries([]);
    setCounts({});
  }, []);

  return { entries, log, clear, counts };
}

const TONE_COLORS: Record<NonNullable<LogEntry['tone']>, string> = {
  info: 'var(--fp-color-text-muted)',
  ad: 'var(--fp-color-accent)',
  success: '#22c55e',
  warn: '#f59e0b',
  error: '#ef4444',
};

export interface EventLogProps {
  entries: LogEntry[];
  onClear?: () => void;
  title?: string;
  height?: number;
  /** Show a per-event tally above the stream. */
  counts?: Record<string, number>;
}

/**
 * A live console of everything the component emitted.
 *
 * For an ad integration this is the single most useful preview affordance: you
 * can watch `impression → start → firstQuartile → … → complete` land in order,
 * and see immediately if something fires twice.
 */
export function EventLog({ entries, onClear, title = 'Events', height = 260, counts }: EventLogProps) {
  const first = entries[entries.length - 1]?.at;

  return (
    <Panel
      title={title}
      meta={entries.length > 0 ? `${entries.length}` : undefined}
      action={
        onClear && entries.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        ) : undefined
      }
    >
      {counts && Object.keys(counts).length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {Object.entries(counts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([event, n]) => (
              <span
                key={event}
                className="rounded px-1.5 py-0.5 text-[10px] tabular-nums"
                style={{ background: 'var(--fp-color-surface)', color: 'var(--fp-color-text-secondary)' }}
              >
                {event} <strong>{n}</strong>
              </span>
            ))}
        </div>
      )}

      <div
        className="overflow-y-auto font-mono text-[11px] leading-relaxed"
        style={{ height, fontFamily: 'var(--fp-font-family-mono)' }}
      >
        {entries.length === 0 ? (
          <p className="py-6 text-center" style={{ color: 'var(--fp-color-text-muted)' }}>
            Interact with the preview to see events.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2">
                <span
                  className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: TONE_COLORS[entry.tone ?? 'info'] }}
                />
                <span
                  className="w-12 shrink-0 tabular-nums"
                  style={{ color: 'var(--fp-color-text-muted)' }}
                >
                  {first ? `+${((entry.at - first) / 1000).toFixed(1)}s` : '0.0s'}
                </span>
                <span className="min-w-0 flex-1 break-words">
                  <span style={{ color: 'var(--fp-color-text-primary)' }}>{entry.event}</span>
                  {entry.detail && (
                    <span style={{ color: 'var(--fp-color-text-secondary)' }}> {entry.detail}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*                              State inspector                               */
/* -------------------------------------------------------------------------- */

export interface StateInspectorProps {
  /** Rows to display. `false`/`null`/`undefined` values render as dimmed. */
  state: Record<string, unknown>;
  title?: string;
  /** Highlight these keys. */
  highlight?: string[];
}

/** A compact key/value read-out of a component's live state. */
export function StateInspector({ state, title = 'State', highlight = [] }: StateInspectorProps) {
  const format = (value: unknown): { text: string; tone: string } => {
    if (value === null || value === undefined) {
      return { text: '—', tone: 'var(--fp-color-text-muted)' };
    }
    if (typeof value === 'boolean') {
      return {
        text: value ? 'true' : 'false',
        tone: value ? '#22c55e' : 'var(--fp-color-text-muted)',
      };
    }
    if (typeof value === 'number') {
      return {
        text: Number.isInteger(value) ? String(value) : value.toFixed(2),
        tone: 'var(--fp-color-text-primary)',
      };
    }
    if (Array.isArray(value)) {
      return { text: `[${value.length}]`, tone: 'var(--fp-color-text-primary)' };
    }
    if (typeof value === 'object') {
      return { text: `{${Object.keys(value as object).length}}`, tone: 'var(--fp-color-text-primary)' };
    }
    return { text: String(value), tone: 'var(--fp-color-text-primary)' };
  };

  return (
    <Panel title={title}>
      <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[12px]">
        {Object.entries(state).map(([key, value]) => {
          const { text, tone } = format(value);
          const isHighlighted = highlight.includes(key);

          return (
            <div key={key} className="col-span-2 grid grid-cols-subgrid items-baseline">
              <dt
                className="truncate"
                style={{
                  color: isHighlighted ? 'var(--fp-color-accent)' : 'var(--fp-color-text-secondary)',
                  fontWeight: isHighlighted ? 600 : 400,
                }}
              >
                {key}
              </dt>
              <dd
                className="m-0 text-right tabular-nums"
                style={{ color: tone, fontFamily: 'var(--fp-font-family-mono)' }}
              >
                {text}
              </dd>
            </div>
          );
        })}
      </dl>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Snippet                                   */
/* -------------------------------------------------------------------------- */

export interface SnippetProps {
  code: string;
  title?: string;
  language?: string;
}

/** A copyable code block showing how to produce the preview above it. */
export function Snippet({ code, title = 'Usage' }: SnippetProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  };

  return (
    <Panel
      title={title}
      action={
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      }
    >
      <pre
        className="m-0 overflow-x-auto text-[11px] leading-relaxed"
        style={{
          fontFamily: 'var(--fp-font-family-mono)',
          color: 'var(--fp-color-text-secondary)',
        }}
      >
        <code>{code.trim()}</code>
      </pre>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Notes                                    */
/* -------------------------------------------------------------------------- */

export interface NoteProps {
  tone?: 'info' | 'warn' | 'tip';
  children: React.ReactNode;
}

/** A short callout for a caveat or a "try this" hint. */
export function Note({ tone = 'info', children }: NoteProps) {
  const tones = {
    info: { border: 'var(--fp-color-accent)', bg: 'rgba(0,169,157,0.08)' },
    warn: { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
    tip: { border: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  } as const;

  return (
    <p
      className="m-0 rounded-r-lg px-3 py-2 text-[12px] leading-relaxed"
      style={{
        borderLeft: `2px solid ${tones[tone].border}`,
        background: tones[tone].bg,
        color: 'var(--fp-color-text-secondary)',
      }}
    >
      {children}
    </p>
  );
}
