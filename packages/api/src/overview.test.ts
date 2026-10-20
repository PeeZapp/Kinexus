import { describe, expect, it, vi } from 'vitest';

import { loadNews, newsQueryForInterest, parseForecast, parseRssHeadlines, searchPlaces } from './overview.js';

const SAMPLE_RSS = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title><![CDATA[Markets open higher &amp; stay there]]></title>
    <link>https://www.bbc.com/news/business-1</link>
    <pubDate>Sat, 17 Oct 2026 08:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Markets open higher &amp; stay there</title>
    <link>https://www.bbc.com/news/business-1b</link>
  </item>
  <item>
    <title>Second story</title>
    <link>not-a-url</link>
  </item>
  <item>
    <title>Port workers reach a deal</title>
    <link>https://www.bbc.com/news/business-2</link>
    <source url="https://example.com">Harbour Times</source>
  </item>
</channel></rss>`;

describe('daily overview feeds', () => {
  it('keeps distinct http headlines and decodes titles', () => {
    const headlines = parseRssHeadlines(SAMPLE_RSS, 'BBC News', 5);
    expect(headlines).toEqual([
      {
        title: 'Markets open higher & stay there',
        url: 'https://www.bbc.com/news/business-1',
        source: 'BBC News',
        publishedAt: 'Sat, 17 Oct 2026 08:00:00 GMT',
      },
      {
        title: 'Port workers reach a deal',
        url: 'https://www.bbc.com/news/business-2',
        source: 'Harbour Times',
        publishedAt: null,
      },
    ]);
  });

  it('builds a seven-day forecast from Open-Meteo daily arrays', () => {
    const report = parseForecast({
      timezone: 'Australia/Perth',
      current: { temperature_2m: 21.4, weather_code: 2, wind_speed_10m: 18, relative_humidity_2m: 55 },
      daily: {
        time: ['2026-10-17', '2026-10-18'],
        weather_code: [2, 63],
        temperature_2m_max: [24.2, 19.1],
        temperature_2m_min: [13.4, 12],
        precipitation_probability_max: [10, 80],
      },
    });
    expect(report.timezone).toBe('Australia/Perth');
    expect(report.current.label).toBe('Partly cloudy');
    expect(report.days).toHaveLength(2);
    expect(report.days[1]).toMatchObject({ date: '2026-10-18', label: 'Rain', high: 19.1, low: 12, rainChance: 80 });
  });

  it('names a searched place from the geocoder', async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        results: [
          {
            id: 2147714,
            name: 'Perth',
            latitude: -31.95,
            longitude: 115.86,
            timezone: 'Australia/Perth',
            country: 'Australia',
            admin1: 'Western Australia',
          },
        ],
      }),
    );
    const places = await searchPlaces({ query: 'Perth' }, fetch);
    expect(places[0]).toMatchObject({
      label: 'Perth, Western Australia',
      latitude: -31.95,
      timezone: 'Australia/Perth',
    });
  });

  it('returns a section error when every edition fails', async () => {
    const fetch = vi.fn(async () => new Response('nope', { status: 500 }));
    const sections = await loadNews(['technology'], fetch);
    expect(sections[0]?.interest).toBe('Technology');
    expect(sections[0]?.headlines).toEqual([]);
    expect(sections[0]?.error).toBeTruthy();
  });

  it('biases gaming search toward releases, industry stories, and reviews', () => {
    const query = newsQueryForInterest('Gaming');
    expect(query).toContain('game release');
    expect(query).toContain('game review');
    expect(query).toContain('video game industry');
    expect(newsQueryForInterest('Technology')).toBe('Technology when:3d');
  });

  it('scopes curated interests to the topics the reader prioritised', () => {
    expect(newsQueryForInterest('Sport')).toBe('Sport when:3d');
    expect(newsQueryForInterest('Sport', { topicPriorities: { sport: ['AFL', 'Cricket'] } })).toBe(
      '("AFL" OR "Cricket") when:3d',
    );
    expect(newsQueryForInterest('Business', { topicPriorities: { business: ['ASX'] } })).toBe(
      '("ASX") when:3d',
    );
    expect(newsQueryForInterest('Gaming', { topicPriorities: { gaming: ['Nintendo'] } })).toContain(
      '"Nintendo"',
    );
  });

  it('orders curated headlines by the reader’s priority list', async () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item>
        <title>NBA finals preview - ESPN</title>
        <link>https://news.google.com/rss/articles/nba</link>
        <source url="https://www.espn.com">ESPN</source>
      </item>
      <item>
        <title>AFL grand final rematch - The Age</title>
        <link>https://news.google.com/rss/articles/afl</link>
        <source url="https://www.theage.com.au">The Age</source>
      </item>
      <item>
        <title>Cricket world cup squad - ABC</title>
        <link>https://news.google.com/rss/articles/cricket</link>
        <source url="https://www.abc.net.au">ABC</source>
      </item>
    </channel></rss>`;
    const fetch = vi.fn(async () => new Response(xml, { status: 200, headers: { 'content-type': 'application/xml' } }));
    const sections = await loadNews(['Sport'], fetch, {
      topicPriorities: { sport: ['Cricket', 'AFL', 'NBA'] },
    });
    expect(sections[0]?.headlines.map((item) => item.title)).toEqual([
      'Cricket world cup squad',
      'AFL grand final rematch',
      'NBA finals preview',
    ]);
  });

  it('mixes publishers and drops the outlet name from the headline', async () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item>
        <title>Streamer drops a funny clip - The Verge</title>
        <link>https://news.google.com/rss/articles/verge</link>
        <source url="https://www.theverge.com">The Verge</source>
      </item>
      <item>
        <title>Starfall review: a bold launch - IGN</title>
        <link>https://news.google.com/rss/articles/ign</link>
        <source url="https://www.ign.com">IGN</source>
      </item>
      <item>
        <title>New game release: Horizon docks today - GameSpot</title>
        <link>https://news.google.com/rss/articles/gamespot</link>
        <source url="https://www.gamespot.com">GameSpot</source>
      </item>
      <item>
        <title>Streamer drops a funny clip - The Verge</title>
        <link>https://news.google.com/rss/articles/verge-2</link>
        <source url="https://www.theverge.com">The Verge</source>
      </item>
    </channel></rss>`;
    const fetch = vi.fn(async (url: string | URL) => {
      expect(decodeURIComponent(String(url).replace(/\+/g, ' '))).toContain('game release');
      return new Response(xml, { status: 200, headers: { 'content-type': 'application/xml' } });
    });
    const sections = await loadNews(['gaming'], fetch);
    const headlines = sections[0]?.headlines ?? [];
    expect(headlines.map((item) => item.title)).toEqual([
      'New game release: Horizon docks today',
      'Starfall review: a bold launch',
      'Streamer drops a funny clip',
    ]);
    expect(headlines.map((item) => item.source)).toEqual(['GameSpot', 'IGN', 'The Verge']);
  });
});
