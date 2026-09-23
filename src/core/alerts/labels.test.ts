import { describe, expect, it } from 'vitest';
import { alertKindForRoute, classifyAlertKind } from './labels';
import type { TransitAlert } from './types';

function alert(overrides: Partial<TransitAlert> = {}): TransitAlert {
  return {
    id: 'a1',
    source: 'transloc',
    scope: 'routes',
    severity: 'info',
    message: 'C1 will detour via Erwin Road',
    affectedRouteIds: ['TL-4'],
    affectedStopIds: [],
    active: true,
    ...overrides,
  };
}

describe('classifyAlertKind', () => {
  it('classifies suspensions, stop changes, detours and generic service changes', () => {
    expect(classifyAlertKind('C1 service is suspended')).toBe('suspended');
    expect(classifyAlertKind('Abele Quad stop has been relocated')).toBe('stop-change');
    expect(classifyAlertKind('C1 will detour via Erwin Road')).toBe('detour');
    expect(classifyAlertKind('Holiday schedule adjustments')).toBe('service');
  });
});

describe('alertKindForRoute', () => {
  it('returns the kind of the highest-priority active alert for the route', () => {
    const alerts = [
      alert({ id: 'a', severity: 'info', message: 'C1 will detour', affectedRouteIds: ['TL-4'] }),
      alert({
        id: 'b',
        severity: 'important',
        message: 'C1 is suspended',
        affectedRouteIds: ['TL-4'],
      }),
    ];
    expect(alertKindForRoute(alerts, 'TL-4')).toBe('suspended');
  });

  it('ignores unrelated routes and inactive alerts', () => {
    const alerts = [
      alert({ id: 'a', affectedRouteIds: ['TL-16'] }),
      alert({ id: 'b', active: false, affectedRouteIds: ['TL-4'] }),
    ];
    expect(alertKindForRoute(alerts, 'TL-4')).toBeUndefined();
  });

  it('treats a system-scope alert as affecting every route', () => {
    const alerts = [alert({ scope: 'system', message: 'All Duke Transit is suspended' })];
    expect(alertKindForRoute(alerts, 'TL-9')).toBe('suspended');
  });
});
