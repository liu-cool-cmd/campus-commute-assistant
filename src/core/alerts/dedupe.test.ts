import { describe, expect, it } from 'vitest';
import { alertContentHash, selectAlertsToNotify } from './dedupe';
import type { TransitAlert } from './types';

const now = new Date('2026-09-23T12:00:00Z');

function alert(overrides: Partial<TransitAlert> = {}): TransitAlert {
  return {
    id: 'transloc:1',
    source: 'transloc',
    scope: 'routes',
    severity: 'important',
    message: 'C1 is on detour.',
    affectedRouteIds: ['TL-4'],
    affectedStopIds: [],
    startsAt: new Date('2026-09-23T11:00:00Z'),
    endsAt: new Date('2026-09-23T20:00:00Z'),
    active: true,
    ...overrides,
  };
}

describe('selectAlertsToNotify', () => {
  it('notifies on first appearance and stores the content hash', () => {
    const plan = selectAlertsToNotify([alert()], {}, now);
    expect(plan.toNotify.map((item) => item.id)).toEqual(['transloc:1']);
    expect(plan.nextState['transloc:1']?.hash).toBe(alertContentHash(alert()));
  });

  it('does not notify again when the content is unchanged', () => {
    const first = selectAlertsToNotify([alert()], {}, now);
    const second = selectAlertsToNotify(
      [alert()],
      first.nextState,
      new Date(now.getTime() + 60_000),
    );
    expect(second.toNotify).toEqual([]);
  });

  it('notifies again when the content changes meaningfully', () => {
    const first = selectAlertsToNotify([alert()], {}, now);
    const updated = alert({
      message: 'C1 detour extended.',
      endsAt: new Date('2026-09-24T02:00:00Z'),
    });
    const second = selectAlertsToNotify([updated], first.nextState, now);
    expect(second.toNotify.map((item) => item.id)).toEqual(['transloc:1']);
    expect(second.nextState['transloc:1']?.hash).toBe(alertContentHash(updated));
  });

  it('ignores inactive alerts and forgets them once they expire', () => {
    const expired = alert({ active: false });
    const plan = selectAlertsToNotify([expired], {}, now);
    expect(plan.toNotify).toEqual([]);
    expect(plan.nextState).toEqual({});

    const previouslyNotified = selectAlertsToNotify([alert()], {}, now);
    const afterExpiry = selectAlertsToNotify([expired], previouslyNotified.nextState, now);
    expect(afterExpiry.nextState).toEqual({});
  });
});
