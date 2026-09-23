import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CommuteRecommendation } from '../core/types';
import { RecommendationCard } from './RecommendationCard';

function recommendation(overrides: Partial<CommuteRecommendation> = {}): CommuteRecommendation {
  return {
    kind: 'transit',
    leaveAt: new Date('2026-09-25T13:30:00Z'),
    originStop: { id: 'o', name: 'Home Stop', lat: 36, lon: -78.95 },
    destinationStop: { id: 'd', name: 'Duke Clinic', lat: 36, lon: -78.94 },
    route: { id: 'c1', shortName: 'C1', longName: 'East-West', type: 3 },
    trip: { id: 't1', routeId: 'c1', serviceId: 'weekday' },
    departureTime: new Date('2026-09-25T13:40:00Z'),
    departureTimeIsExact: true,
    arrivalTime: new Date('2026-09-25T13:48:00Z'),
    walkingMinutes: 0,
    waitingMinutes: 0,
    originWalkingMinutes: 0,
    destinationWalkingMinutes: 0,
    transitMinutes: 8,
    totalMinutes: 18,
    minutesEarly: 12,
    confidence: 'medium',
    ...overrides,
  };
}

describe('RecommendationCard', () => {
  it('keeps only the bus arrival visible and moves the rest behind details', () => {
    const html = renderToStaticMarkup(
      createElement(RecommendationCard, {
        language: 'en',
        recommendation: recommendation({ minutesEarly: 12, originWalkingMinutes: 6 }),
      }),
    );

    expect(html).toContain('Arrive 12 min early');
    expect(html).toContain('<details');
    expect(html).toContain('Details');
    expect(html).not.toContain('>Class<');

    const detailsStart = html.indexOf('<details');
    expect(html.indexOf('Bus C1')).toBeGreaterThan(-1);
    expect(html.indexOf('Bus C1')).toBeLessThan(detailsStart);
    // The destination stop time and the walk are detail rows, not headline facts.
    expect(html.indexOf('Arrive at Duke Clinic')).toBeGreaterThan(detailsStart);
    expect(html.indexOf('Walk to Home Stop')).toBeGreaterThan(detailsStart);
  });

  it('tags a following departure that may be late, and one that is late', () => {
    const tags = (status: 'at-risk' | 'late', minutesEarly: number) =>
      renderToStaticMarkup(
        createElement(RecommendationCard, {
          language: 'en',
          recommendation: recommendation({ minutesEarly }),
          arrivalStatus: status,
          compact: true,
        }),
      );

    expect(tags('at-risk', 4)).toContain('May be late');
    expect(tags('at-risk', 4)).not.toContain('>Late<');

    const lateHtml = tags('late', -6);
    expect(lateHtml).toContain('>Late<');
    expect(lateHtml).toContain('Arrive 6 min late');
  });
});
