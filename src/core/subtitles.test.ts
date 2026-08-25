/**
 * Reading a caption file.
 *
 * The file is third-party content, and nothing here may produce markup — the
 * component this feeds renders text.
 */

import { describe, it, expect } from 'vitest';
import { activeCueAt, parseCueText, parseVtt, parseVttTimestamp, type SubtitleCue } from './subtitles';

const VTT = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Erste Zeile
Zweite Zeile

00:00:05.000 --> 00:00:08.000
<v Anna>Hallo zusammen

00:00:09.000 --> 00:00:12.000
<i>kursiv</i> und <b>fett</b>
`;

describe('parseVttTimestamp', () => {
  it('reads the shapes a VTT uses', () => {
    expect(parseVttTimestamp('00:00:05.000')).toBe(5);
    expect(parseVttTimestamp('01:30.500')).toBe(90.5);
    expect(parseVttTimestamp('12')).toBe(12);
    expect(parseVttTimestamp('01:02:03')).toBe(3723);
  });

  it('accepts the comma some tools write', () => {
    expect(parseVttTimestamp('00:00:05,250')).toBe(5.25);
  });

  it('refuses what it cannot read', () => {
    // A NaN bound matches no time, so a malformed cue would silently never show.
    expect(parseVttTimestamp('soon')).toBeNull();
    expect(parseVttTimestamp('1:2:3:4')).toBeNull();
    expect(parseVttTimestamp('')).toBeNull();
  });
});

describe('parseCueText', () => {
  it('keeps the words and the line breaks', () => {
    expect(parseCueText('Erste\nZweite')).toEqual({ text: 'Erste\nZweite', speaker: undefined });
  });

  it('takes the speaker out of a voice tag', () => {
    expect(parseCueText('<v Anna>Hallo')).toEqual({ text: 'Hallo', speaker: 'Anna' });
    expect(parseCueText('<v.loud Anna Meier>Hallo')).toEqual({
      text: 'Hallo',
      speaker: 'Anna Meier',
    });
  });

  it('drops the rest of the markup', () => {
    // Not translated — the caller renders text, and a surviving tag would be
    // shown literally.
    expect(parseCueText('<i>kursiv</i> und <b>fett</b>').text).toBe('kursiv und fett');
    expect(parseCueText('<c.yellow>gelb</c>').text).toBe('gelb');
  });

  it('drops anything shaped like markup, whatever it is', () => {
    expect(parseCueText('<img src=x onerror=alert(1)>hi').text).toBe('hi');
    expect(parseCueText('<script>alert(1)</script>ok').text).toBe('alert(1)ok');
  });
});

describe('parseVtt', () => {
  it('reads the cues', () => {
    const cues = parseVtt(VTT);

    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject({
      id: '1',
      startTime: 1,
      endTime: 4,
      text: 'Erste Zeile\nZweite Zeile',
    });
    expect(cues[1].speaker).toBe('Anna');
    expect(cues[2].text).toBe('kursiv und fett');
  });

  it('numbers a cue that has no identifier', () => {
    expect(parseVtt(VTT)[1].id).toBe('cue-1');
  });

  it('tolerates CRLF', () => {
    expect(parseVtt(VTT.replace(/\n/g, '\r\n'))).toHaveLength(3);
  });

  it('reads cue settings after the end time', () => {
    const cues = parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000 line:90% align:center\nText\n');

    expect(cues).toHaveLength(1);
    expect(cues[0].endTime).toBe(2);
  });

  it('skips a block whose times make no sense', () => {
    const cues = parseVtt(
      'WEBVTT\n\n00:00:09.000 --> 00:00:02.000\nRückwärts\n\n00:00:01.000 --> 00:00:02.000\nGut\n'
    );

    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Gut');
  });

  it('skips a block with no text', () => {
    expect(parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<i></i>\n')).toHaveLength(0);
  });

  it('ignores NOTE blocks and the header', () => {
    const cues = parseVtt(
      'WEBVTT\n\nNOTE Übersetzt von jemandem\n\n00:00:01.000 --> 00:00:02.000\nText\n'
    );

    expect(cues).toHaveLength(1);
  });

  it('returns nothing for a file that is not one', () => {
    expect(parseVtt('')).toEqual([]);
    expect(parseVtt('nur Text ohne alles')).toEqual([]);
  });

  it('puts the cues in time order', () => {
    const cues = parseVtt(
      'WEBVTT\n\n00:00:09.000 --> 00:00:10.000\nB\n\n00:00:01.000 --> 00:00:02.000\nA\n'
    );

    // The search below is binary and assumes it.
    expect(cues.map((c) => c.text)).toEqual(['A', 'B']);
  });
});

describe('activeCueAt', () => {
  const cues: SubtitleCue[] = [
    { id: 'a', startTime: 0, endTime: 5, text: 'A' },
    { id: 'b', startTime: 5, endTime: 10, text: 'B' },
    { id: 'c', startTime: 20, endTime: 25, text: 'C' },
  ];

  it('finds the cue covering a time', () => {
    expect(activeCueAt(cues, 0)?.text).toBe('A');
    expect(activeCueAt(cues, 4.99)?.text).toBe('A');
    expect(activeCueAt(cues, 5)?.text).toBe('B');
    expect(activeCueAt(cues, 24)?.text).toBe('C');
  });

  it('reports nothing in a gap or outside', () => {
    expect(activeCueAt(cues, 15)).toBeNull();
    expect(activeCueAt(cues, 30)).toBeNull();
    expect(activeCueAt([], 1)).toBeNull();
    expect(activeCueAt(cues, Number.NaN)).toBeNull();
  });

  it('agrees with a linear scan across a feature-length file', () => {
    const many: SubtitleCue[] = Array.from({ length: 2000 }, (_, i) => ({
      id: `c${i}`,
      startTime: i * 3,
      endTime: i * 3 + 2,
      text: `${i}`,
    }));

    for (const time of [0, 1, 2.5, 2999, 5998.5]) {
      const scanned =
        many.find((c) => time >= c.startTime && time < c.endTime) ?? null;
      expect(activeCueAt(many, time)).toEqual(scanned);
    }
  });
});
