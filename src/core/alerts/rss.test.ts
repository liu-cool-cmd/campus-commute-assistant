import { describe, expect, it } from 'vitest';
import { parseRssFeed, stripMarkup } from './rss';

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title><![CDATA[News RSS Feed]]></title>
  <description><![CDATA[News RSS Feed]]></description>
  <item>
    <title><![CDATA[Transit &amp; Parking Adjustments]]></title>
    <description><![CDATA[A detour serves <a href="https://example.com">East Campus</a>.]]></description>
    <link>https://today.duke.edu/2023/03/example</link>
    <guid isPermaLink="false">5a0b4c9e-86a0-422b-b8c2-2decf2736e55</guid>
    <pubDate>Thu, 09 Mar 2023 00:00:00 GMT</pubDate>
    <category>HR|Parking and Transportation|Staff</category>
  </item>
  <item>
    <title><![CDATA[No date item]]></title>
    <link>https://today.duke.edu/2024/01/no-date</link>
  </item>
</channel></rss>`;

describe('parseRssFeed', () => {
  it('extracts title, description, link, guid, pubDate and categories', () => {
    const items = parseRssFeed(feed);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: 'Transit & Parking Adjustments',
      description: 'A detour serves <a href="https://example.com">East Campus</a>.',
      link: 'https://today.duke.edu/2023/03/example',
      guid: '5a0b4c9e-86a0-422b-b8c2-2decf2736e55',
      categories: ['HR|Parking and Transportation|Staff'],
    });
    expect(items[0]!.pubDate?.toISOString()).toBe('2023-03-09T00:00:00.000Z');
  });

  it('tolerates items without a pubDate and ignores channel-level tags', () => {
    const items = parseRssFeed(feed);
    expect(items[1]).toMatchObject({ title: 'No date item', pubDate: undefined });
    expect(items.map((item) => item.title)).not.toContain('News RSS Feed');
  });

  it('strips embedded markup without touching comparison characters', () => {
    expect(stripMarkup('A detour serves <a href="x">East Campus</a>.')).toBe(
      'A detour serves East Campus .',
    );
    expect(stripMarkup('open 6 a.m. < 8 a.m.')).toBe('open 6 a.m. < 8 a.m.');
  });

  it('returns an empty list for malformed input', () => {
    expect(parseRssFeed('<rss><channel></channel></rss>')).toEqual([]);
  });
});
