/**
 * Subtitle appearance, without a renderer.
 *
 * Two things carry weight here. Stored preferences are the one input nobody
 * reviews — they outlive the schema that wrote them and end up inside a
 * stylesheet — so `normalizeStyle` is mostly a test about what it refuses. And
 * the output has to be `::cue` CSS, because native cues are the only thing the
 * player actually renders.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_PRESETS,
  cueLineFor,
  findPreset,
  hexToRgba,
  normalizeStyle,
  toCueCss,
  type SubtitleStyle,
} from './subtitleStyle';

describe('hexToRgba', () => {
  it('expands the long form', () => {
    expect(hexToRgba('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
    expect(hexToRgba('#000000', 0.75)).toBe('rgba(0, 0, 0, 0.75)');
  });

  it('expands the shorthand', () => {
    expect(hexToRgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
    expect(hexToRgba('#f00', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('clamps the opacity', () => {
    expect(hexToRgba('#000', 5)).toBe('rgba(0, 0, 0, 1)');
    expect(hexToRgba('#000', -2)).toBe('rgba(0, 0, 0, 0)');
  });

  it('refuses anything that is not a hex colour', () => {
    // The version this was ported from ran parseInt over these anyway and
    // produced `rgba(NaN, NaN, NaN, …)` — invalid CSS, which the browser
    // drops, so the backing box silently vanished.
    expect(hexToRgba('red', 1)).toBeNull();
    expect(hexToRgba('rgb(1,2,3)', 1)).toBeNull();
    expect(hexToRgba('#12345', 1)).toBeNull();
    expect(hexToRgba('', 1)).toBeNull();
  });
});

describe('normalizeStyle', () => {
  it('fills in everything that is missing', () => {
    expect(normalizeStyle({})).toEqual(DEFAULT_SUBTITLE_STYLE);
    expect(normalizeStyle(null)).toEqual(DEFAULT_SUBTITLE_STYLE);
  });

  it('keeps what is valid', () => {
    const style = normalizeStyle({ fontSize: 22, textColor: '#ff0000', position: 'top' });

    expect(style).toMatchObject({ fontSize: 22, textColor: '#ff0000', position: 'top' });
  });

  it('repairs one field without discarding the others', () => {
    const style = normalizeStyle({ fontSize: Number.NaN, textColor: '#ff0000' });

    // A single bad entry from an older schema must not reset the whole
    // preference.
    expect(style.fontSize).toBe(DEFAULT_SUBTITLE_STYLE.fontSize);
    expect(style.textColor).toBe('#ff0000');
  });

  it('clamps a font size to something readable', () => {
    expect(normalizeStyle({ fontSize: 2 }).fontSize).toBe(8);
    expect(normalizeStyle({ fontSize: 9000 }).fontSize).toBe(96);
  });

  it('clamps the opacity', () => {
    expect(normalizeStyle({ backgroundOpacity: 4 }).backgroundOpacity).toBe(1);
    expect(normalizeStyle({ backgroundOpacity: -1 }).backgroundOpacity).toBe(0);
  });

  it('refuses colours that are not hex', () => {
    expect(normalizeStyle({ textColor: 'red' as string }).textColor).toBe(
      DEFAULT_SUBTITLE_STYLE.textColor
    );
  });

  it('refuses a position it does not know', () => {
    expect(normalizeStyle({ position: 'middle' as 'top' }).position).toBe('bottom');
  });

  describe('refuses values that could break out of the declaration', () => {
    it('in the shadow', () => {
      const escaped = '2px 2px 4px black; } body { display: none';

      expect(normalizeStyle({ textShadow: escaped }).textShadow).toBe('none');
    });

    it('in the font family', () => {
      expect(normalizeStyle({ fontFamily: 'a; }' }).fontFamily).toBe('inherit');
      expect(normalizeStyle({ fontFamily: '' }).fontFamily).toBe('inherit');
    });

    it('and anything absurdly long', () => {
      expect(normalizeStyle({ textShadow: 'a'.repeat(500) }).textShadow).toBe('none');
    });
  });
});

describe('toCueCss', () => {
  const style: SubtitleStyle = {
    ...DEFAULT_SUBTITLE_STYLE,
    fontSize: 20,
    textColor: '#ffff00',
    backgroundOpacity: 0.5,
  };

  it('writes a rule for native cues', () => {
    const css = toCueCss(style, 'abc');

    // `::cue` is the only thing that styles a cue the browser draws.
    expect(css).toContain('video::cue');
    expect(css).toContain('color: #ffff00');
    expect(css).toContain('font-size: 20px');
    expect(css).toContain('background-color: rgba(0, 0, 0, 0.5)');
  });

  it('scopes the rule to one player', () => {
    const css = toCueCss(style, 'abc');

    // Two players on a page must not overwrite each other's subtitles.
    expect(css.startsWith('[data-fp-cue-scope="abc"]')).toBe(true);
  });

  it('leaves the font family alone when it is inherited', () => {
    expect(toCueCss(DEFAULT_SUBTITLE_STYLE, 'x')).not.toContain('font-family');
    expect(toCueCss({ ...DEFAULT_SUBTITLE_STYLE, fontFamily: 'Georgia' }, 'x')).toContain(
      'font-family: Georgia'
    );
  });

  it('says nothing about position', () => {
    // A cue's placement is a property on the cue object, not something CSS can
    // reach — the hook applies it separately.
    expect(toCueCss({ ...style, position: 'top' }, 'x')).not.toContain('top');
  });

  it('falls back to a usable background rather than emitting nothing', () => {
    const css = toCueCss({ ...style, backgroundColor: 'nonsense' }, 'x');

    expect(css).toContain('background-color: rgba(0, 0, 0, 0.5)');
  });
});

describe('presets', () => {
  it('are all valid styles', () => {
    for (const preset of SUBTITLE_PRESETS) {
      expect(normalizeStyle(preset.style)).toEqual(preset.style);
    }
  });

  it('include one built for readability', () => {
    const contrast = findPreset('high-contrast');

    expect(contrast?.style.backgroundOpacity).toBe(1);
  });

  it('report nothing for a name that does not exist', () => {
    expect(findPreset('nope')).toBeUndefined();
  });
});

describe('cueLineFor', () => {
  it('pins to the first line at the top', () => {
    expect(cueLineFor('top')).toBe(0);
  });

  it('leaves the browser default at the bottom', () => {
    expect(cueLineFor('bottom')).toBe('auto');
  });
});
