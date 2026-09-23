export interface RssItem {
  title?: string;
  description?: string;
  link?: string;
  guid?: string;
  pubDate?: Date;
  categories: string[];
}

const CDATA = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/;
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value: string): string {
  return (
    value
      .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
        String.fromCodePoint(Number.parseInt(hex, 16)),
      )
      .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
      // `amp` is expanded last so a literal `&amp;lt;` is not double-decoded.
      .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name: string) => NAMED_ENTITIES[name] ?? '')
  );
}

function unwrapCdata(value: string): string {
  const match = CDATA.exec(value);
  return match ? (match[1] ?? '') : value;
}

function textOf(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const decoded = decodeEntities(unwrapCdata(value)).trim();
  return decoded || undefined;
}

function tagContent(block: string, name: string): string | undefined {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return match?.[1];
}

/** Removes markup a feed may embed (e.g. `<a>`) without touching comparison operators. */
export function stripMarkup(value: string): string {
  return value
    .replace(/<[a-z!/][^>]*>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseRssFeed(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const block = match[1] ?? '';
    const pubDateText = textOf(tagContent(block, 'pubDate'));
    const parsedPubDate = pubDateText ? new Date(pubDateText) : undefined;
    const pubDate =
      parsedPubDate && !Number.isNaN(parsedPubDate.getTime()) ? parsedPubDate : undefined;
    const categories: string[] = [];
    for (const entry of block.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)) {
      const value = textOf(entry[1]);
      if (value) categories.push(value);
    }
    items.push({
      title: textOf(tagContent(block, 'title')),
      description: textOf(tagContent(block, 'description')),
      link: textOf(tagContent(block, 'link')),
      guid: textOf(tagContent(block, 'guid')),
      pubDate,
      categories,
    });
  }
  return items;
}
