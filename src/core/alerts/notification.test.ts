import { describe, expect, it } from 'vitest';
import {
  mergeAlertNotificationContext,
  selectNotifiableAlerts,
  shouldNotifyAlert,
} from './notification';
import type { AlertNotificationContext } from './notification';
import type { TransitAlert } from './types';

function alert(overrides: Partial<TransitAlert> = {}): TransitAlert {
  return {
    id: 'a1',
    source: 'transloc',
    scope: 'routes',
    severity: 'info',
    message: 'message',
    affectedRouteIds: [],
    affectedStopIds: [],
    active: true,
    ...overrides,
  };
}

const context: AlertNotificationContext = {
  scope: 'my-routes',
  routeIds: ['TL-4', 'TL-13'],
  stopIds: ['TL-200'],
};

describe('alert notification preference filtering', () => {
  it('sends nothing when notifications are off', () => {
    expect(
      shouldNotifyAlert(alert({ scope: 'system', severity: 'important' }), {
        ...context,
        scope: 'off',
      }),
    ).toBe(false);
    expect(selectNotifiableAlerts([alert()], { ...context, scope: 'off' })).toEqual([]);
  });

  it('sends every active alert for "all alerts"', () => {
    const alerts = [
      alert({ id: 'a1', scope: 'unknown' }),
      alert({ id: 'a2', severity: 'important' }),
    ];
    expect(selectNotifiableAlerts(alerts, { ...context, scope: 'all' })).toHaveLength(2);
  });

  it('sends only important alerts for "important alerts only"', () => {
    const info = alert({ id: 'a1', severity: 'info' });
    const important = alert({ id: 'a2', severity: 'important' });
    const sent = selectNotifiableAlerts([info, important], { ...context, scope: 'important' });
    expect(sent.map((item) => item.id)).toEqual(['a2']);
  });

  it('notifies on the saved route, an upcoming commute route, or a saved stop', () => {
    expect(shouldNotifyAlert(alert({ affectedRouteIds: ['TL-13'] }), context)).toBe(true);
    expect(shouldNotifyAlert(alert({ affectedStopIds: ['TL-200'] }), context)).toBe(true);
  });

  it('notifies on an explicitly system-wide alert', () => {
    expect(shouldNotifyAlert(alert({ scope: 'system' }), context)).toBe(true);
  });

  it('does not notify for an unrelated route under "my routes only"', () => {
    expect(shouldNotifyAlert(alert({ affectedRouteIds: ['TL-16'] }), context)).toBe(false);
  });

  it('does not notify for an unmatched (unknown) alert under "my routes only"', () => {
    expect(shouldNotifyAlert(alert({ scope: 'unknown', affectedRouteIds: [] }), context)).toBe(
      false,
    );
  });

  it('never notifies an inactive alert', () => {
    expect(shouldNotifyAlert(alert({ active: false, affectedRouteIds: ['TL-4'] }), context)).toBe(
      false,
    );
  });
});

describe('mergeAlertNotificationContext', () => {
  it('unions saved and commute routes/stops and drops blanks', () => {
    const merged = mergeAlertNotificationContext({
      scope: 'my-routes',
      savedRouteIds: ['TL-4'],
      commuteRouteIds: [undefined, 'TL-13'],
      savedStopIds: ['TL-200'],
      commuteStopIds: [],
    });
    expect(merged).toEqual({
      scope: 'my-routes',
      routeIds: ['TL-4', 'TL-13'],
      stopIds: ['TL-200'],
    });
  });
});
