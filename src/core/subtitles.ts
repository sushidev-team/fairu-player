/**
 * Reading a WebVTT caption file.
 *
 * Ported from PR #16. The player normally lets the browser render captions from
 * a `<track>`; this is for the cases where that is not enough — placing them
 * above the controls bar instead of behind it, or styling beyond what `::cue`
 * reaches.
 *
 * A caption file is third-party content. Nothing here produces markup: cues
 * come out as plain text and a line list, so the thing that renders them cannot
 * be talked into rendering markup instead.
 */

export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  /** The cue as plain text, newlines preserved. */
  text: string;
  /** From a `<v Name>` tag, when the file names its speakers. */
  speaker?: string;
}

/** `HH:MM:SS.mmm`, `MM:SS.mmm` or seconds → seconds, or `null`. */
export function parseVttTimestamp(value: string): number | null {
  const parts = value.trim().split(':');
  if (parts.length > 3) return null;

  let seconds = 0;
  for (const part of parts) {
    const trimmed = part.trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) return null;
    seconds = seconds * 60 + Number(trimmed.replace(',', '.'));
  }

  return Number.isFinite(seconds) ? seconds : null;
}

const VOICE = /^<v(?:\.[^\s>]+)*\s+([^>]*)>/;

/**
 * A cue payload → text and, if it names one, a speaker.
 *
 * VTT markup (`<i>`, `<b>`, `<c.classname>`, timestamps) is dropped rather than
 * translated: the caller renders text, and a tag that survived would be shown
 * literally.
 */
export function parseCueText(raw: string): { text: string; speaker?: string } {
  const voice = VOICE.exec(raw.trimStart());
  const speaker = voice ? voice[1].trim() || undefined : undefined;

  const text = raw
    .replace(VOICE, '')
    .replace(/<\/?[^>]*>/g, '')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  return { text, speaker };
}

/**
 * A WebVTT file → cues.
 *
 * Blocks are separated by blank lines, which is what the format actually
 * guarantees — reading backwards from a timestamp line to guess whether the
 * line above was an identifier breaks on files that put a comment there.
 */
export function parseVtt(content: string): SubtitleCue[] {
  if (!content.trim()) return [];

  const blocks = content.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter((line, index) => index === 0 || line.trim() !== '');
    if (lines.length === 0) continue;

    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1) continue;

    const [startRaw, endRaw] = lines[timingIndex].split('-->');
    const startTime = parseVttTimestamp(startRaw ?? '');
    // Cue settings may follow the end time; only the first token is the time.
    const endTime = parseVttTimestamp((endRaw ?? '').trim().split(/\s+/)[0] ?? '');
    if (startTime === null || endTime === null || endTime <= startTime) continue;

    const payload = lines.slice(timingIndex + 1).join('\n');
    const { text, speaker } = parseCueText(payload);
    if (!text) continue;

    // The line above the timing is the cue identifier, when there is one.
    const identifier = timingIndex > 0 ? lines[0].trim() : '';

    cues.push({
      id: identifier || `cue-${cues.length}`,
      startTime,
      endTime,
      text,
      speaker,
    });
  }

  return cues.sort((a, b) => a.startTime - b.startTime);
}

/**
 * The cue covering a time, or `null`.
 *
 * A binary search: this runs on every `timeupdate`, and a feature-length film
 * carries a couple of thousand cues.
 */
export function activeCueAt(cues: readonly SubtitleCue[], time: number): SubtitleCue | null {
  if (!Number.isFinite(time)) return null;

  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    const cue = cues[middle];

    if (time < cue.startTime) high = middle - 1;
    else if (time >= cue.endTime) low = middle + 1;
    else return cue;
  }

  return null;
}
