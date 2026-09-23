import type { AlertScope } from './types';

export interface AlertRouteAlias {
  routeIds: string[];
  /** Lowercase phrases; a match on any phrase attributes every `routeId`. */
  patterns: string[];
}

export interface AlertStopAlias {
  stopIds: string[];
  patterns: string[];
}

export interface AlertMatchCatalog {
  routes: AlertRouteAlias[];
  stops: AlertStopAlias[];
  /** Phrases that explicitly mean the entire network is affected. */
  systemPatterns: string[];
}

export interface AlertMatchResult {
  routeIds: string[];
  stopIds: string[];
  scope: AlertScope;
}

export function normalizeAlertText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const normalized = normalizeAlertText(phrase);
  if (!normalized) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalized)}([^a-z0-9]|$)`, 'i').test(haystack);
}

/**
 * Maps alert text onto known routes and stops. Deliberately conservative: a
 * route/stop is only reported when a known alias appears on a token boundary,
 * and "system-wide" is only reported when an explicit phrase is present.
 */
export function matchAlertText(rawText: string, catalog: AlertMatchCatalog): AlertMatchResult {
  const text = normalizeAlertText(rawText);

  const routeIds = new Set<string>();
  for (const alias of catalog.routes) {
    if (alias.patterns.some((pattern) => containsPhrase(text, pattern))) {
      for (const id of alias.routeIds) routeIds.add(id);
    }
  }

  const stopIds = new Set<string>();
  for (const alias of catalog.stops) {
    if (alias.patterns.some((pattern) => containsPhrase(text, pattern))) {
      for (const id of alias.stopIds) stopIds.add(id);
    }
  }

  const systemWide = catalog.systemPatterns.some((pattern) => containsPhrase(text, pattern));
  const scope: AlertScope = systemWide ? 'system' : routeIds.size > 0 ? 'routes' : 'unknown';

  return { routeIds: [...routeIds], stopIds: [...stopIds], scope };
}
