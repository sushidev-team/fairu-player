import { describe, expect, it, vi } from 'vitest';
import { VastClient, requestWaterfall } from './VastClient';
import { getLinearCreative } from './parseVast';
import { VastError } from '@/types/vast';

/** Build a minimal but valid in-line VAST document. */
function inlineVast(id: string, extra = ''): string {
  return `<VAST version="4.2">
    <Ad id="${id}"><InLine>
      <AdSystem>Test</AdSystem>
      <AdTitle>${id}</AdTitle>
      <Impression><![CDATA[https://t.example.com/${id}/imp]]></Impression>
      ${extra}
      <Creatives><Creative><Linear>
        <Duration>00:00:15</Duration>
        <TrackingEvents>
          <Tracking event="complete"><![CDATA[https://t.example.com/${id}/complete]]></Tracking>
        </TrackingEvents>
        <MediaFiles>
          <MediaFile type="video/mp4" bitrate="900" width="720" height="1280"><![CDATA[https://cdn.example.com/${id}.mp4]]></MediaFile>
        </MediaFiles>
      </Linear></Creative></Creatives>
    </InLine></Ad>
  </VAST>`;
}

/** Build a wrapper pointing at `target`. */
function wrapperVast(id: string, target: string, attrs = ''): string {
  return `<VAST version="4.2">
    <Ad id="${id}"><Wrapper ${attrs}>
      <AdSystem>Wrapper ${id}</AdSystem>
      <VASTAdTagURI><![CDATA[${target}]]></VASTAdTagURI>
      <Impression><![CDATA[https://t.example.com/${id}/imp]]></Impression>
      <Error><![CDATA[https://t.example.com/${id}/err]]></Error>
    </Wrapper></Ad>
  </VAST>`;
}

const NO_ADS = `<VAST version="4.2"><Error><![CDATA[https://t.example.com/noad]]></Error></VAST>`;

/** A fetch stub that serves a URL→body map and records every request. */
function stubFetch(routes: Record<string, string>) {
  const calls: string[] = [];

  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);

    const body = routes[url];
    if (body === undefined) {
      return { ok: false, status: 404, text: async () => '' } as unknown as Response;
    }
    return { ok: true, status: 200, text: async () => body } as unknown as Response;
  });

  return { impl: impl as unknown as typeof fetch, calls };
}

describe('VastClient', () => {
  it('resolves a direct in-line tag', async () => {
    const { impl, calls } = stubFetch({
      'https://ads.example.com/vast': inlineVast('direct'),
    });
    const client = new VastClient({ fetchImpl: impl });

    const result = await client.request('https://ads.example.com/vast');

    expect(calls).toEqual(['https://ads.example.com/vast']);
    expect(result.ads).toHaveLength(1);
    expect(result.ads[0].adTitle).toBe('direct');
    expect(result.documentCount).toBe(1);
  });

  it('substitutes macros in the tag URL before fetching', async () => {
    const { impl, calls } = stubFetch({});
    const client = new VastClient({ fetchImpl: impl });

    await client.request('https://ads.example.com/vast?cb=[CACHEBUSTING]').catch(() => {});

    expect(calls[0]).toMatch(/\?cb=\d{8}$/);
  });

  it('follows a wrapper chain and merges inherited tracking', async () => {
    const { impl, calls } = stubFetch({
      'https://ssp.example.com/a': wrapperVast('w1', 'https://ssp.example.com/b'),
      'https://ssp.example.com/b': wrapperVast('w2', 'https://dsp.example.com/c'),
      'https://dsp.example.com/c': inlineVast('final'),
    });
    const client = new VastClient({ fetchImpl: impl });

    const result = await client.request('https://ssp.example.com/a');

    expect(calls).toHaveLength(3);
    expect(result.ads).toHaveLength(1);

    const [ad] = result.ads;
    expect(ad.adTitle).toBe('final');
    // Both wrappers' impressions plus the in-line one.
    expect(ad.impressionUrls).toEqual([
      'https://t.example.com/w1/imp',
      'https://t.example.com/w2/imp',
      'https://t.example.com/final/imp',
    ]);
    expect(ad.wrapperDepth).toBe(2);
    expect(getLinearCreative(ad)!.trackingEvents.complete).toEqual([
      'https://t.example.com/final/complete',
    ]);
  });

  it('stops at maxWrapperDepth instead of looping forever', async () => {
    // A wrapper that points at itself — the classic misconfiguration.
    const { impl, calls } = stubFetch({
      'https://loop.example.com/vast': wrapperVast('loop', 'https://loop.example.com/vast'),
    });
    const client = new VastClient({ fetchImpl: impl, maxWrapperDepth: 3 });

    const result = await client.request('https://loop.example.com/vast');

    expect(result.ads).toHaveLength(0);
    // Root + 3 redirects, then the limit stops it.
    expect(calls).toHaveLength(4);
    expect(result.errorUrls).toContain('https://t.example.com/loop/err');
  });

  it('honours followAdditionalWrappers="false"', async () => {
    const { impl, calls } = stubFetch({
      'https://ssp.example.com/a': wrapperVast(
        'w1',
        'https://ssp.example.com/b',
        'followAdditionalWrappers="false"'
      ),
      'https://ssp.example.com/b': wrapperVast('w2', 'https://dsp.example.com/c'),
      'https://dsp.example.com/c': inlineVast('final'),
    });
    const client = new VastClient({ fetchImpl: impl });

    const result = await client.request('https://ssp.example.com/a');

    // The nested wrapper must not be fetched.
    expect(calls).toEqual(['https://ssp.example.com/a', 'https://ssp.example.com/b']);
    expect(result.ads).toHaveLength(0);
  });

  it('returns the wrapper error pixels when the chain ends with no ads', async () => {
    const { impl } = stubFetch({
      'https://ssp.example.com/a': wrapperVast('w1', 'https://ssp.example.com/empty'),
      'https://ssp.example.com/empty': NO_ADS,
    });
    const client = new VastClient({ fetchImpl: impl });

    const result = await client.request('https://ssp.example.com/a');

    expect(result.ads).toHaveLength(0);
    expect(result.errorUrls).toEqual(
      expect.arrayContaining(['https://t.example.com/w1/err', 'https://t.example.com/noad'])
    );
  });

  it('survives a dead wrapper hop without throwing', async () => {
    const { impl } = stubFetch({
      'https://ssp.example.com/a': wrapperVast('w1', 'https://dead.example.com/404'),
    });
    const client = new VastClient({ fetchImpl: impl });

    const result = await client.request('https://ssp.example.com/a');
    expect(result.ads).toHaveLength(0);
    expect(result.errorUrls).toContain('https://t.example.com/w1/err');
  });

  it('refuses non-http(s) tag URLs', async () => {
    const { impl, calls } = stubFetch({});
    const client = new VastClient({ fetchImpl: impl });

    await expect(client.request('javascript:alert(1)')).rejects.toThrow(VastError);
    await expect(client.request('file:///etc/passwd')).rejects.toThrow(/unsupported URL scheme/);
    expect(calls).toHaveLength(0);
  });

  it('refuses a wrapper that redirects to a dangerous scheme', async () => {
    const { impl, calls } = stubFetch({
      'https://ssp.example.com/a': wrapperVast('w1', 'javascript:alert(1)'),
    });
    const client = new VastClient({ fetchImpl: impl });

    const result = await client.request('https://ssp.example.com/a');

    expect(calls).toEqual(['https://ssp.example.com/a']);
    expect(result.ads).toHaveLength(0);
  });

  it('resolves inline XML without any network access', async () => {
    const { impl, calls } = stubFetch({});
    const client = new VastClient({ fetchImpl: impl });

    const result = await client.resolve(inlineVast('house'));

    expect(calls).toHaveLength(0);
    expect(result.ads).toHaveLength(1);
    expect(result.ads[0].adTitle).toBe('house');
  });

  it('keeps only the first ad unless the wrapper allows multiple', async () => {
    const pod = `<VAST version="4.2">
      <Ad id="p1" sequence="1"><InLine><AdTitle>p1</AdTitle>
        <Creatives><Creative><Linear><Duration>00:00:06</Duration>
          <MediaFiles><MediaFile type="video/mp4"><![CDATA[https://cdn.example.com/p1.mp4]]></MediaFile></MediaFiles>
        </Linear></Creative></Creatives></InLine></Ad>
      <Ad id="p2" sequence="2"><InLine><AdTitle>p2</AdTitle>
        <Creatives><Creative><Linear><Duration>00:00:06</Duration>
          <MediaFiles><MediaFile type="video/mp4"><![CDATA[https://cdn.example.com/p2.mp4]]></MediaFile></MediaFiles>
        </Linear></Creative></Creatives></InLine></Ad>
    </VAST>`;

    const single = stubFetch({
      'https://ssp.example.com/a': wrapperVast('w', 'https://dsp.example.com/pod'),
      'https://dsp.example.com/pod': pod,
    });
    const singleResult = await new VastClient({ fetchImpl: single.impl }).request(
      'https://ssp.example.com/a'
    );
    expect(singleResult.ads.map((a) => a.adTitle)).toEqual(['p1']);

    const multi = stubFetch({
      'https://ssp.example.com/a': wrapperVast(
        'w',
        'https://dsp.example.com/pod',
        'allowMultipleAds="true"'
      ),
      'https://dsp.example.com/pod': pod,
    });
    const multiResult = await new VastClient({ fetchImpl: multi.impl }).request(
      'https://ssp.example.com/a'
    );
    expect(multiResult.ads.map((a) => a.adTitle)).toEqual(['p1', 'p2']);
  });

  it('orders ad pods by sequence', async () => {
    const outOfOrder = `<VAST version="4.2">
      <Ad id="second" sequence="2"><InLine><AdTitle>second</AdTitle>
        <Creatives><Creative><Linear><Duration>00:00:06</Duration>
          <MediaFiles><MediaFile type="video/mp4"><![CDATA[https://cdn.example.com/2.mp4]]></MediaFile></MediaFiles>
        </Linear></Creative></Creatives></InLine></Ad>
      <Ad id="first" sequence="1"><InLine><AdTitle>first</AdTitle>
        <Creatives><Creative><Linear><Duration>00:00:06</Duration>
          <MediaFiles><MediaFile type="video/mp4"><![CDATA[https://cdn.example.com/1.mp4]]></MediaFile></MediaFiles>
        </Linear></Creative></Creatives></InLine></Ad>
    </VAST>`;

    const result = await new VastClient().resolve(outOfOrder);
    expect(result.ads.map((a) => a.adTitle)).toEqual(['first', 'second']);
  });
});

describe('requestWaterfall', () => {
  it('stops at the first tag that fills', async () => {
    const { impl, calls } = stubFetch({
      'https://a.example.com': NO_ADS,
      'https://b.example.com': inlineVast('filled'),
      'https://c.example.com': inlineVast('never'),
    });
    const client = new VastClient({ fetchImpl: impl });

    const result = await requestWaterfall(client, [
      'https://a.example.com',
      'https://b.example.com',
      'https://c.example.com',
    ]);

    expect(result.ads[0].adTitle).toBe('filled');
    expect(calls).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  it('returns an empty result when every tag is dry', async () => {
    const { impl } = stubFetch({
      'https://a.example.com': NO_ADS,
      'https://b.example.com': NO_ADS,
    });
    const client = new VastClient({ fetchImpl: impl });

    const result = await requestWaterfall(client, [
      'https://a.example.com',
      'https://b.example.com',
    ]);

    expect(result.ads).toHaveLength(0);
  });

  it('keeps walking the waterfall past a hard failure', async () => {
    const { impl, calls } = stubFetch({
      'https://b.example.com': inlineVast('filled'),
    });
    const client = new VastClient({ fetchImpl: impl });

    const result = await requestWaterfall(client, [
      'https://broken.example.com',
      'https://b.example.com',
    ]);

    expect(result.ads[0].adTitle).toBe('filled');
    expect(calls).toHaveLength(2);
  });
});
