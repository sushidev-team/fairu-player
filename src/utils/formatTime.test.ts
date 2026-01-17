import { describe, it, expect } from 'vitest';
import { formatTime, formatDuration, parseTime, calculatePercentage } from './formatTime';

describe('formatTime', () => {
  it('formats seconds to MM:SS format', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(125)).toBe('2:05');
  });

  it('formats to HH:MM:SS when hours > 0', () => {
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3661)).toBe('1:01:01');
    expect(formatTime(7325)).toBe('2:02:05');
  });

  it('handles invalid inputs', () => {
    expect(formatTime(-1)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatTime(-Infinity)).toBe('0:00');
  });

  it('pads seconds and minutes correctly', () => {
    expect(formatTime(9)).toBe('0:09');
    expect(formatTime(60)).toBe('1:00');
    expect(formatTime(3609)).toBe('1:00:09');
  });
});

describe('formatDuration', () => {
  it('formats seconds to human-readable duration', () => {
    expect(formatDuration(0)).toBe('0 sec');
    expect(formatDuration(30)).toBe('30 sec');
    expect(formatDuration(60)).toBe('1 min');
    expect(formatDuration(90)).toBe('1 min 30 sec');
    expect(formatDuration(3600)).toBe('1 hr');
    expect(formatDuration(3660)).toBe('1 hr 1 min');
    expect(formatDuration(7261)).toBe('2 hr 1 min');
  });

  it('handles invalid inputs', () => {
    expect(formatDuration(-1)).toBe('0 sec');
    expect(formatDuration(NaN)).toBe('0 sec');
    expect(formatDuration(Infinity)).toBe('0 sec');
  });

  it('does not show seconds when hours > 0', () => {
    expect(formatDuration(3661)).toBe('1 hr 1 min');
    expect(formatDuration(3601)).toBe('1 hr');
  });
});

describe('parseTime', () => {
  it('parses MM:SS format', () => {
    expect(parseTime('0:00')).toBe(0);
    expect(parseTime('1:30')).toBe(90);
    expect(parseTime('10:05')).toBe(605);
  });

  it('parses HH:MM:SS format', () => {
    expect(parseTime('1:00:00')).toBe(3600);
    expect(parseTime('1:30:30')).toBe(5430);
    expect(parseTime('2:01:05')).toBe(7265);
  });

  it('parses single number as seconds', () => {
    expect(parseTime('30')).toBe(30);
    expect(parseTime('120')).toBe(120);
  });

  it('handles invalid inputs', () => {
    expect(parseTime('invalid')).toBe(0);
    expect(parseTime('a:b')).toBe(0);
    expect(parseTime('')).toBe(0);
  });
});

describe('calculatePercentage', () => {
  it('calculates percentage correctly', () => {
    expect(calculatePercentage(0, 100)).toBe(0);
    expect(calculatePercentage(50, 100)).toBe(50);
    expect(calculatePercentage(100, 100)).toBe(100);
    expect(calculatePercentage(25, 200)).toBe(12.5);
  });

  it('clamps percentage between 0 and 100', () => {
    expect(calculatePercentage(-10, 100)).toBe(0);
    expect(calculatePercentage(150, 100)).toBe(100);
  });

  it('handles edge cases', () => {
    expect(calculatePercentage(50, 0)).toBe(0);
    expect(calculatePercentage(50, -100)).toBe(0);
  });
});
