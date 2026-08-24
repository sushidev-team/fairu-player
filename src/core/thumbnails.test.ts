/**
 * Scrubbing thumbnails, without a renderer.
 *
 * A thumbnail VTT is third-party content whose payload ends up in a
 * `background-image`, and whose URLs are almost always relative to the manifest
 * — so most of what follows is about resolving and refusing.
 */

import { describe, it, expect } from 'vitest';
import {
  cuesFromConfig,
  findCueAtTime,
  generateSpriteCues,
  parseSpatialFragment,
  parseThumbnailVtt,
  parseVttTime,
  resolveThumbnailUrl,
  type ThumbnailCue,
} from './thumbnails';

const BASE = 'https://cdn.example.test/media/thumbs.vtt';

describe('parseVttTime', () => {
  it('reads the three shapes a VTT uses', () => {
    expect(parseVttTime('00:00:05.000')).toBe(5);
    expect(parseVttTime('01:30.500')).toBe(90.5);
    expect(parseVttTime('12')).toBe(12);
  });

  it('reads hours', () => {
    expect(parseVttTime('01:02:03')).toBe(3723);
  });

  it('refuses what it cannot read', () => {
    // A NaN bound matches no time at all, so a malformed cue would fail
    // silently and the preview would simply never appear.
    expect(parseVttTime('soon')).toBeNull();
    expect(parseVttTime('1:2:3:4')).toBeNull();
    expect(parseVttTime('')).toBeNull();
    expect(parseVttTime('-5')).toBeNull();
  });
});

describe('parseSpatialFragment', () => {
  it('splits the crop off the URL', () => {
    expect(parseSpatialFragment('sheet.jpg#xywh=160,90,160,90')).toEqual({
      url: 'sheet.jpg',
      x: 160,
      y: 90,
      width: 160,
      height: 90,
    });
  });

  it('leaves a plain URL alone', () => {
    expect(parseSpatialFragment('shot.jpg')).toEqual({ url: 'shot.jpg' });
  });

  it('takes all four numbers or none', () => {
    // A partial crop puts the sprite window somewhere arbitrary, which reads as
    // a broken image rather than a missing feature.
    expect(parseSpatialFragment('sheet.jpg#xywh=1,2')).toEqual({ url: 'sheet.jpg' });
    expect(parseSpatialFragment('sheet.jpg#xywh=1,2,x,4')).toEqual({ url: 'sheet.jpg' });
  });
});

describe('resolveThumbnailUrl', () => {
  it('resolves against the manifest it came from', () => {
    // The common case by far: relative paths next to the VTT.
    expect(resolveThumbnailUrl('shots/042.jpg', BASE)).toBe(
      'https://cdn.example.test/media/shots/042.jpg'
    );
  });

  it('leaves an absolute URL alone', () => {
    expect(resolveThumbnailUrl('https://other.test/a.jpg', BASE)).toBe(
      'https://other.test/a.jpg'
    );
  });

  it('refuses a scheme that has no business in an image', () => {
    expect(resolveThumbnailUrl('javascript:alert(1)', BASE)).toBeNull();
    expect(resolveThumbnailUrl('file:///etc/passwd', BASE)).toBeNull();
  });

  it('refuses an empty payload', () => {
    expect(resolveThumbnailUrl('   ', BASE)).toBeNull();
  });
});

describe('parseThumbnailVtt', () => {
  const VTT = `WEBVTT

00:00:00.000 --> 00:00:05.000
shots/sheet.jpg#xywh=0,0,160,90

00:00:05.000 --> 00:00:10.000
shots/sheet.jpg#xywh=160,0,160,90
`;

  it('reads the cues', () => {
    const cues = parseThumbnailVtt(VTT, BASE);

    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({
      startTime: 0,
      endTime: 5,
      url: 'https://cdn.example.test/media/shots/sheet.jpg',
      x: 0,
      y: 0,
      width: 160,
      height: 90,
    });
    expect(cues[1].x).toBe(160);
  });

  it('tolerates CRLF', () => {
    // Roughly half the generators emit it.
    expect(parseThumbnailVtt(VTT.replace(/\n/g, '\r\n'), BASE)).toHaveLength(2);
  });

  it('reads cues that carry settings after the end time', () => {
    const cues = parseThumbnailVtt(
      'WEBVTT\n\n00:00:00.000 --> 00:00:05.000 align:start\nshot.jpg\n',
      BASE
    );

    expect(cues).toHaveLength(1);
  });

  it('skips a cue whose times make no sense', () => {
    const cues = parseThumbnailVtt(
      'WEBVTT\n\n00:00:10.000 --> 00:00:05.000\na.jpg\n\n00:00:00.000 --> 00:00:05.000\nb.jpg\n',
      BASE
    );

    expect(cues).toHaveLength(1);
    expect(cues[0].url).toContain('b.jpg');
  });

  it('skips a cue with no payload', () => {
    expect(parseThumbnailVtt('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n\n', BASE)).toHaveLength(0);
  });

  it('skips a cue pointing somewhere it should not', () => {
    const cues = parseThumbnailVtt(
      'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\njavascript:alert(1)\n',
      BASE
    );

    expect(cues).toHaveLength(0);
  });

  it('returns nothing for a file that is not one', () => {
    expect(parseThumbnailVtt('', BASE)).toEqual([]);
    expect(parseThumbnailVtt('not a vtt at all', BASE)).toEqual([]);
  });
});

describe('generateSpriteCues', () => {
  const sheet = {
    spriteUrl: 'https://cdn.example.test/sheet.jpg',
    columns: 3,
    rows: 2,
    thumbWidth: 160,
    thumbHeight: 90,
    interval: 10,
    duration: 60,
  };

  it('lays the grid over the timeline', () => {
    const cues = generateSpriteCues(sheet);

    expect(cues).toHaveLength(6);
    expect(cues[0]).toMatchObject({ startTime: 0, endTime: 10, x: 0, y: 0 });
    expect(cues[2]).toMatchObject({ x: 320, y: 0 });
    expect(cues[3]).toMatchObject({ x: 0, y: 90 });
  });

  it('stops at the end of the video', () => {
    const cues = generateSpriteCues({ ...sheet, duration: 25 });

    expect(cues).toHaveLength(3);
    expect(cues[2].endTime).toBe(25);
  });

  it('returns nothing for a sheet that describes nothing', () => {
    expect(generateSpriteCues({ ...sheet, columns: 0 })).toEqual([]);
    expect(generateSpriteCues({ ...sheet, duration: 0 })).toEqual([]);
  });
});

describe('cuesFromConfig', () => {
  it('derives the interval when it is not given', () => {
    const cues = cuesFromConfig({
      spriteUrl: 'https://cdn.example.test/sheet.jpg',
      spriteColumns: 2,
      spriteRows: 2,
      thumbWidth: 160,
      thumbHeight: 90,
      duration: 40,
    });

    expect(cues).toHaveLength(4);
    expect(cues[0].endTime).toBe(10);
  });

  it('returns nothing when the sheet is under-described', () => {
    expect(cuesFromConfig({ spriteUrl: 'https://cdn.example.test/s.jpg' })).toEqual([]);
  });
});

describe('findCueAtTime', () => {
  const cues: ThumbnailCue[] = [
    { startTime: 0, endTime: 5, url: 'a' },
    { startTime: 5, endTime: 10, url: 'b' },
    { startTime: 10, endTime: 15, url: 'c' },
  ];

  it('finds the cue covering a time', () => {
    expect(findCueAtTime(cues, 0)?.url).toBe('a');
    expect(findCueAtTime(cues, 4.9)?.url).toBe('a');
    expect(findCueAtTime(cues, 5)?.url).toBe('b');
    expect(findCueAtTime(cues, 14.99)?.url).toBe('c');
  });

  it('reports nothing outside the covered range', () => {
    expect(findCueAtTime(cues, -1)).toBeNull();
    expect(findCueAtTime(cues, 15)).toBeNull();
  });

  it('reports nothing for an empty list or a nonsense time', () => {
    expect(findCueAtTime([], 5)).toBeNull();
    expect(findCueAtTime(cues, Number.NaN)).toBeNull();
  });

  it('agrees with a linear scan across a long film', () => {
    // The search is binary because this runs on every pointer move; it has to
    // give the same answer a scan would.
    const many: ThumbnailCue[] = Array.from({ length: 1440 }, (_, i) => ({
      startTime: i * 5,
      endTime: (i + 1) * 5,
      url: `f${i}`,
    }));

    for (const time of [0, 1, 2500, 3600, 7199.9]) {
      const scanned = many.find((c) => time >= c.startTime && time < c.endTime) ?? null;
      expect(findCueAtTime(many, time)).toEqual(scanned);
    }
  });
});
