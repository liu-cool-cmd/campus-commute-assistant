import { describe, expect, it } from 'vitest';
import { localeFor, translate } from './i18n';

describe('i18n', () => {
  it('interpolates English and Chinese messages', () => {
    expect(translate('en', 'arriveEarly', { minutes: 8 })).toBe('Arrive 8 min early');
    expect(translate('zh-CN', 'arriveEarly', { minutes: 8 })).toBe('提前 8 分钟到达');
  });

  it('provides an explicit formatting locale', () => {
    expect(localeFor('en')).toBe('en-US');
    expect(localeFor('zh-CN')).toBe('zh-CN');
  });
});
