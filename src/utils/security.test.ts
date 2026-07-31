import { describe, it, expect } from 'vitest';
import { sanitizeUrl, sanitizeEndpoint, safeJsonParse } from './security';

describe('sanitizeUrl', () => {
  it('accepts http(s) URLs', () => {
    expect(sanitizeUrl('https://cdn.example.com/a.mp3')).toBe(
      'https://cdn.example.com/a.mp3'
    );
    expect(sanitizeUrl('http://example.com/a.png')).toBe('http://example.com/a.png');
  });

  it('accepts relative URLs', () => {
    expect(sanitizeUrl('/audio/track.mp3')).toBe('/audio/track.mp3');
  });

  it('accepts data: and blob: by default', () => {
    expect(sanitizeUrl('data:image/png;base64,iVBOR')).toBe('data:image/png;base64,iVBOR');
    expect(sanitizeUrl('blob:https://x/abc')).toBe('blob:https://x/abc');
  });

  it('rejects javascript: and other dangerous schemes', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeUrl('JavaScript:alert(1)')).toBeUndefined();
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBeUndefined();
    expect(sanitizeUrl('file:///etc/passwd')).toBeUndefined();
  });

  it('treats an attribute-breakout payload as a harmless relative path', () => {
    // sanitizeUrl only filters schemes; this resolves to a relative path (https).
    // Markup-breakout is prevented at the sink instead (loader uses DOM property
    // setters / React escapes), so the string is allowed but inert.
    expect(sanitizeUrl('x" onerror="alert(1)')).toBe('x" onerror="alert(1)');
  });

  it('handles empty / nullish input', () => {
    expect(sanitizeUrl('')).toBeUndefined();
    expect(sanitizeUrl('   ')).toBeUndefined();
    expect(sanitizeUrl(undefined)).toBeUndefined();
    expect(sanitizeUrl(null)).toBeUndefined();
  });
});

describe('sanitizeEndpoint', () => {
  it('allows http(s) only', () => {
    expect(sanitizeEndpoint('https://track.example.com/e')).toBe(
      'https://track.example.com/e'
    );
    expect(sanitizeEndpoint('data:text/plain,x')).toBeUndefined();
    expect(sanitizeEndpoint('javascript:fetch("//evil")')).toBeUndefined();
  });
});

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('[1,2,3]')).toEqual([1, 2, 3]);
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns fallback on malformed JSON instead of throwing', () => {
    expect(safeJsonParse('{not json')).toBeUndefined();
    expect(safeJsonParse('{not json', [])).toEqual([]);
  });

  it('returns fallback for empty / nullish input', () => {
    expect(safeJsonParse('')).toBeUndefined();
    expect(safeJsonParse(undefined)).toBeUndefined();
    expect(safeJsonParse(null, [])).toEqual([]);
  });
});
