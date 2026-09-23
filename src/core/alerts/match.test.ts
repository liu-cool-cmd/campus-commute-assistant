import { describe, expect, it } from 'vitest';
import { matchAlertText } from './match';
import type { AlertMatchCatalog } from './match';

const catalog: AlertMatchCatalog = {
  routes: [
    { routeIds: ['TL-4'], patterns: ['c1', 'c1: east-west'] },
    { routeIds: ['TL-16'], patterns: ['lnc', 'lancaster commons'] },
    { routeIds: ['TL-4', 'TL-13', 'TL-17', 'TL-19'], patterns: ['lasalle loop'] },
  ],
  stops: [{ stopIds: ['TL-200'], patterns: ['abele quad'] }],
  systemPatterns: ['all duke transit', 'all routes'],
};

describe('matchAlertText', () => {
  it('matches routes and stops on token boundaries', () => {
    const result = matchAlertText(
      'The C1: East-West and Lancaster Commons routes resume use of Abele Quad stop.',
      catalog,
    );
    expect(new Set(result.routeIds)).toEqual(new Set(['TL-4', 'TL-16']));
    expect(result.stopIds).toEqual(['TL-200']);
    expect(result.scope).toBe('routes');
  });

  it('does not match a route code embedded in another token', () => {
    const result = matchAlertText('PR1 will detour via Swift Avenue.', catalog);
    expect(result.routeIds).toEqual([]);
    expect(result.scope).toBe('unknown');
  });

  it('maps a shared base name to every route in the family', () => {
    const result = matchAlertText('LaSalle Loop will run on altered schedules.', catalog);
    expect(new Set(result.routeIds)).toEqual(new Set(['TL-4', 'TL-13', 'TL-17', 'TL-19']));
  });

  it('reports a system scope only for an explicit system phrase', () => {
    const system = matchAlertText('All Duke Transit services are suspended today.', catalog);
    expect(system.scope).toBe('system');

    const unknown = matchAlertText('A detour will help buses access East Campus.', catalog);
    expect(unknown.scope).toBe('unknown');
    expect(unknown.routeIds).toEqual([]);
  });
});
