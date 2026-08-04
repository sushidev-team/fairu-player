import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useVastAdBreaks } from './useVastAdBreaks';

function inlineVast(id: string, duration = '00:00:15', skip = ' skipoffset="00:00:05"'): string {
  return `<VAST version="4.2"><Ad id="${id}"><InLine>
    <AdSystem>Test</AdSystem><AdTitle>${id}</AdTitle>
    <Impression><![CDATA[https://t.example.com/${id}/imp]]></Impression>
    <Creatives><Creative><Linear${skip}>
      <Duration>${duration}</Duration>
      <MediaFiles>
        <MediaFile type="video/mp4" bitrate="900" width="1280" height="720"><![CDATA[https://cdn.example.com/${id}.mp4]]></MediaFile>
      </MediaFiles>
    </Linear></Creative></Creatives>
  </InLine></Ad></VAST>`;
}

const NO_ADS = `<VAST version="4.2"><Error><![CDATA[https://t.example.com/noad]]></Error></VAST>`;

/** Install a fetch stub for the duration of one test. */
function stubFetch(routes: Record<string, string>) {
  const calls: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const body = routes[url.split('?')[0]] ?? routes[url];
    if (body === undefined) return { ok: false, status: 404, text: async () => '' } as Response;
    return { ok: true, status: 200, text: async () => body } as Response;
  });
  vi.stubGlobal('fetch', impl);
  return { calls };
}

describe('useVastAdBreaks', () => {
  it('turns a pre-roll tag into a VideoAdBreak', async () => {
    stubFetch({ 'https://ads.example.com/pre': inlineVast('pre') });

    const { result } = renderHook(() =>
      useVastAdBreaks({ preRoll: 'https://ads.example.com/pre' })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.adBreaks).toHaveLength(1);
    const [adBreak] = result.current.adBreaks;
    expect(adBreak.position).toBe('pre-roll');
    expect(adBreak.ads[0].src).toBe('https://cdn.example.com/pre.mp4');
    expect(adBreak.ads[0].skipAfterSeconds).toBe(5);
    vi.unstubAllGlobals();
  });

  it('places mid-rolls at their trigger times, in order', async () => {
    stubFetch({
      'https://ads.example.com/m1': inlineVast('m1'),
      'https://ads.example.com/m2': inlineVast('m2'),
    });

    const { result } = renderHook(() =>
      useVastAdBreaks({
        midRolls: [
          { at: 600, tagUrl: 'https://ads.example.com/m2' },
          { at: 120, tagUrl: 'https://ads.example.com/m1' },
        ],
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.adBreaks.map((b) => b.triggerTime)).toEqual([120, 600]);
    expect(result.current.adBreaks.every((b) => b.position === 'mid-roll')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('omits a break whose tag returned no ad, rather than emitting an empty one', async () => {
    stubFetch({
      'https://ads.example.com/pre': NO_ADS,
      'https://ads.example.com/post': inlineVast('post'),
    });

    const { result } = renderHook(() =>
      useVastAdBreaks({
        preRoll: 'https://ads.example.com/pre',
        postRoll: 'https://ads.example.com/post',
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.adBreaks).toHaveLength(1);
    expect(result.current.adBreaks[0].position).toBe('post-roll');
    vi.unstubAllGlobals();
  });

  it('walks a waterfall until a tag fills', async () => {
    const { calls } = stubFetch({
      'https://a.example.com/vast': NO_ADS,
      'https://b.example.com/vast': inlineVast('filled'),
    });

    const { result } = renderHook(() =>
      useVastAdBreaks({
        preRoll: ['https://a.example.com/vast', 'https://b.example.com/vast'],
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.adBreaks[0].ads[0].title).toBe('filled');
    expect(calls).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it('resolves placement from a VMAP document', async () => {
    const vmap = `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
      <vmap:AdBreak timeOffset="start" breakType="linear" breakId="pre">
        <vmap:AdSource><vmap:VASTAdData>${inlineVast('vmap-pre')}</vmap:VASTAdData></vmap:AdSource>
      </vmap:AdBreak>
      <vmap:AdBreak timeOffset="00:05:00" breakType="linear" breakId="mid">
        <vmap:AdSource><vmap:VASTAdData>${inlineVast('vmap-mid')}</vmap:VASTAdData></vmap:AdSource>
      </vmap:AdBreak>
      <vmap:AdBreak timeOffset="end" breakType="linear" breakId="post">
        <vmap:AdSource><vmap:VASTAdData>${inlineVast('vmap-post')}</vmap:VASTAdData></vmap:AdSource>
      </vmap:AdBreak>
      <vmap:AdBreak timeOffset="50%" breakType="display" breakId="banner">
        <vmap:AdSource><vmap:AdTagURI><![CDATA[https://x]]></vmap:AdTagURI></vmap:AdSource>
      </vmap:AdBreak>
    </vmap:VMAP>`;

    const { result } = renderHook(() => useVastAdBreaks({ vmapXml: vmap, duration: 1200 }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // The display break has nowhere to render in a video player and is dropped.
    expect(result.current.adBreaks).toHaveLength(3);
    expect(result.current.adBreaks.map((b) => b.position)).toEqual([
      'pre-roll',
      'mid-roll',
      'post-roll',
    ]);
    expect(result.current.adBreaks.map((b) => b.id)).toEqual(['pre', 'mid', 'post']);
    expect(result.current.adBreaks[1].triggerTime).toBe(300);
  });

  it('maps VMAP offsets onto positions and trigger times', async () => {
    const vmap = `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
      <vmap:AdBreak timeOffset="25%" breakType="linear" breakId="quarter">
        <vmap:AdSource><vmap:VASTAdData>${inlineVast('q')}</vmap:VASTAdData></vmap:AdSource>
      </vmap:AdBreak>
    </vmap:VMAP>`;

    const { result } = renderHook(() => useVastAdBreaks({ vmapXml: vmap, duration: 800 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.adBreaks[0]).toMatchObject({
      position: 'mid-roll',
      triggerTime: 200,
    });
  });

  it('drops a percentage break when the content duration is unknown', async () => {
    // Guessing would put the ad in the wrong place.
    const vmap = `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
      <vmap:AdBreak timeOffset="50%" breakType="linear" breakId="half">
        <vmap:AdSource><vmap:VASTAdData>${inlineVast('h')}</vmap:VASTAdData></vmap:AdSource>
      </vmap:AdBreak>
    </vmap:VMAP>`;

    const { result } = renderHook(() => useVastAdBreaks({ vmapXml: vmap }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.adBreaks).toHaveLength(0);
  });

  it('does nothing when disabled', async () => {
    const { calls } = stubFetch({ 'https://ads.example.com/pre': inlineVast('pre') });

    const { result } = renderHook(() =>
      useVastAdBreaks({ enabled: false, preRoll: 'https://ads.example.com/pre' })
    );

    await waitFor(() => expect(result.current.adBreaks).toHaveLength(0));
    expect(calls).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it('does not re-request when the host passes inline literals', async () => {
    const { calls } = stubFetch({ 'https://ads.example.com/pre': inlineVast('pre') });

    const { rerender, result } = renderHook(() =>
      // New array identity on every render — the hook must not treat that as a
      // config change, or every render would fire a fresh ad request.
      useVastAdBreaks({ preRoll: ['https://ads.example.com/pre'], onError: () => {} })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    const afterFirst = calls.length;

    rerender();
    rerender();
    await waitFor(() => expect(result.current.adBreaks).toHaveLength(1));

    expect(calls.length).toBe(afterFirst);
    vi.unstubAllGlobals();
  });

  it('surfaces a VMAP parse failure', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useVastAdBreaks({ vmapXml: '<not-vmap/>', onError })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.adBreaks).toHaveLength(0);
    expect(onError).toHaveBeenCalled();
  });

  describe('just-in-time requests', () => {
    const MID = 'https://ads.example.com/mid';
    const PRE = 'https://ads.example.com/pre';
    const POST = 'https://ads.example.com/post';

    /** Requests for one tag, ignoring the cache-buster query. */
    const hits = (calls: string[], tag: string) =>
      calls.filter((url) => url.split('?')[0] === tag).length;

    it('requests the pre-roll at mount but defers the mid-roll', async () => {
      const { calls } = stubFetch({ [PRE]: inlineVast('pre'), [MID]: inlineVast('mid') });

      const { result } = renderHook(() =>
        useVastAdBreaks({
          requestStrategy: 'just-in-time',
          preRoll: PRE,
          midRolls: [{ at: 1200, tagUrl: MID }],
        })
      );

      await waitFor(() => expect(result.current.adBreaks).toHaveLength(1));

      expect(hits(calls, PRE)).toBe(1);
      expect(hits(calls, MID)).toBe(0);
      vi.unstubAllGlobals();
    });

    it('requests the mid-roll once the playhead enters the prefetch window', async () => {
      const { calls } = stubFetch({ [MID]: inlineVast('mid') });

      const { result } = renderHook(() =>
        useVastAdBreaks({
          requestStrategy: 'just-in-time',
          prefetchSeconds: 15,
          midRolls: [{ at: 300, tagUrl: MID }],
        })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => result.current.notifyTime(280));
      expect(hits(calls, MID)).toBe(0);

      act(() => result.current.notifyTime(286));
      await waitFor(() => expect(result.current.adBreaks).toHaveLength(1));

      expect(hits(calls, MID)).toBe(1);
      expect(result.current.adBreaks[0]).toMatchObject({ position: 'mid-roll', triggerTime: 300 });
      vi.unstubAllGlobals();
    });

    it('never requests a break the viewer does not reach', async () => {
      const { calls } = stubFetch({ [MID]: inlineVast('mid') });

      const { result } = renderHook(() =>
        useVastAdBreaks({
          requestStrategy: 'just-in-time',
          midRolls: [{ at: 1200, tagUrl: MID }],
        })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.notifyTime(30));
      act(() => result.current.notifyTime(90));

      // The whole point: an abandoned session costs no ad request, so requests
      // and impressions stop drifting apart.
      expect(hits(calls, MID)).toBe(0);
      expect(result.current.adBreaks).toHaveLength(0);
      vi.unstubAllGlobals();
    });

    it('requests a break once however often the playhead is reported', async () => {
      const { calls } = stubFetch({ [MID]: inlineVast('mid') });

      const { result } = renderHook(() =>
        useVastAdBreaks({
          requestStrategy: 'just-in-time',
          midRolls: [{ at: 100, tagUrl: MID }],
        })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      for (let t = 85; t <= 120; t += 1) act(() => result.current.notifyTime(t));
      await waitFor(() => expect(result.current.adBreaks).toHaveLength(1));

      // A second request would be a second impression, i.e. a billing bug.
      expect(hits(calls, MID)).toBe(1);
      vi.unstubAllGlobals();
    });

    it('does not retry a break that came back empty', async () => {
      const { calls } = stubFetch({ [MID]: NO_ADS });

      const { result } = renderHook(() =>
        useVastAdBreaks({
          requestStrategy: 'just-in-time',
          midRolls: [{ at: 100, tagUrl: MID }],
        })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => result.current.notifyTime(90));
      await waitFor(() => expect(hits(calls, MID)).toBe(1));

      act(() => result.current.notifyTime(95));
      act(() => result.current.notifyTime(100));

      expect(hits(calls, MID)).toBe(1);
      expect(result.current.adBreaks).toHaveLength(0);
      vi.unstubAllGlobals();
    });

    it('times the post-roll off the duration reported alongside the playhead', async () => {
      const { calls } = stubFetch({ [POST]: inlineVast('post') });

      const { result } = renderHook(() =>
        useVastAdBreaks({ requestStrategy: 'just-in-time', postRoll: POST, duration: 600 })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => result.current.notifyTime(100, 600));
      expect(hits(calls, POST)).toBe(0);

      act(() => result.current.notifyTime(590, 600));
      await waitFor(() => expect(hits(calls, POST)).toBe(1));
      vi.unstubAllGlobals();
    });

    it('requests the post-roll up front when no duration is known', async () => {
      // There is nothing to time it against, and never requesting it at all
      // would silently lose the inventory.
      const { calls } = stubFetch({ [POST]: inlineVast('post') });

      const { result } = renderHook(() =>
        useVastAdBreaks({ requestStrategy: 'just-in-time', postRoll: POST })
      );

      await waitFor(() => expect(result.current.adBreaks).toHaveLength(1));
      expect(hits(calls, POST)).toBe(1);
      vi.unstubAllGlobals();
    });

    it('plans VMAP placement up front and defers only the ad request', async () => {
      const vmap = `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
        <vmap:AdBreak timeOffset="00:05:00" breakType="linear" breakId="mid-1">
          <vmap:AdSource><vmap:AdTagURI><![CDATA[${MID}]]></vmap:AdTagURI></vmap:AdSource>
        </vmap:AdBreak>
      </vmap:VMAP>`;
      const { calls } = stubFetch({ [MID]: inlineVast('mid') });

      const { result } = renderHook(() =>
        useVastAdBreaks({ requestStrategy: 'just-in-time', vmapXml: vmap })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(hits(calls, MID)).toBe(0);

      act(() => result.current.notifyTime(290));
      await waitFor(() => expect(result.current.adBreaks).toHaveLength(1));

      expect(result.current.adBreaks[0]).toMatchObject({ id: 'mid-1', triggerTime: 300 });
      vi.unstubAllGlobals();
    });

    it('is a no-op under the eager default', async () => {
      const { calls } = stubFetch({ [MID]: inlineVast('mid') });

      const { result } = renderHook(() =>
        useVastAdBreaks({ midRolls: [{ at: 1200, tagUrl: MID }] })
      );

      await waitFor(() => expect(result.current.adBreaks).toHaveLength(1));
      const afterMount = calls.length;

      act(() => result.current.notifyTime(1200));
      expect(calls.length).toBe(afterMount);
      vi.unstubAllGlobals();
    });
  });
});
