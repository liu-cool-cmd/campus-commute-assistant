import type { AlertKind } from '../core/alerts/labels';
import type { AppLanguage } from '../core/types';
import { translate } from '../i18n';

/** Localized short label for the route badge and alert chip. */
export function alertKindLabel(kind: AlertKind, language: AppLanguage): string {
  switch (kind) {
    case 'detour':
      return translate(language, 'alertBadgeDetour');
    case 'stop-change':
      return translate(language, 'alertBadgeStopChange');
    case 'suspended':
      return translate(language, 'alertBadgeSuspended');
    case 'service':
      return translate(language, 'alertBadgeService');
  }
}
