import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useRealtimeAge } from './useRealtimeAge';

function AgeConsumer({ recordedAt }: { recordedAt?: Date }) {
  const age = useRealtimeAge(recordedAt);
  return createElement('span', { 'data-testid': 'age' }, age !== undefined ? `${age}s` : 'none');
}

describe('useRealtimeAge', () => {
  it('returns none when recordedAt is undefined', () => {
    const html = renderToStaticMarkup(createElement(AgeConsumer, { recordedAt: undefined }));
    expect(html).toContain('none');
  });

  it('calculates the elapsed seconds from recordedAt', () => {
    const past = new Date(Date.now() - 14_000);
    const html = renderToStaticMarkup(createElement(AgeConsumer, { recordedAt: past }));
    expect(html).toMatch(/1[3-5]s/);
  });
});
