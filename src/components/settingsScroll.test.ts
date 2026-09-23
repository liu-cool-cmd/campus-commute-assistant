import { describe, expect, it } from 'vitest';
import { settingsScrollTop } from './settingsScroll';

describe('settingsScrollTop', () => {
  it('aligns the target to the top of the container, less the outline padding', () => {
    expect(
      settingsScrollTop({
        targetTop: 500,
        containerTop: 100,
        containerScrollTop: 0,
        containerScrollHeight: 2_000,
        containerClientHeight: 600,
      }),
    ).toBe(388);
  });

  it('accounts for an already scrolled container', () => {
    expect(
      settingsScrollTop({
        targetTop: 300,
        containerTop: 100,
        containerScrollTop: 250,
        containerScrollHeight: 2_000,
        containerClientHeight: 600,
      }),
    ).toBe(438);
  });

  it('never scrolls past the top or past the end', () => {
    expect(
      settingsScrollTop({
        targetTop: 40,
        containerTop: 100,
        containerScrollTop: 0,
        containerScrollHeight: 2_000,
        containerClientHeight: 600,
      }),
    ).toBe(0);
    expect(
      settingsScrollTop({
        targetTop: 1_900,
        containerTop: 100,
        containerScrollTop: 0,
        containerScrollHeight: 1_200,
        containerClientHeight: 600,
      }),
    ).toBe(600);
  });

  it('returns 0 when the content already fits', () => {
    expect(
      settingsScrollTop({
        targetTop: 300,
        containerTop: 100,
        containerScrollTop: 0,
        containerScrollHeight: 500,
        containerClientHeight: 600,
      }),
    ).toBe(0);
  });
});
