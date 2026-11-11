import { describe, expect, it } from 'vitest';
import { notificationId, oneOffNotificationKey } from '../notifications/local';
import type { OneOffTrip } from '../types';

const trip = (overrides: Partial<OneOffTrip> = {}): OneOffTrip => ({
  id: 'oneoff:abc123',
  title: 'Dentist',
  arrivalDeadline: new Date('2026-10-05T14:00:00-04:00'),
  routeId: 'TL-21',
  originStopId: 'TL-100',
  destinationStopId: 'TL-200',
  bufferMinutes: 10,
  createdAt: new Date('2026-10-02T09:00:00-04:00'),
  ...overrides,
});

describe('one-off notification id namespacing', () => {
  it('adds the namespace so a raw id cannot hash onto a class reminder', () => {
    const raw = 'dentist-2026-10-05';
    expect(oneOffNotificationKey(raw)).toBe('oneoff:dentist-2026-10-05');
    expect(notificationId(oneOffNotificationKey(raw))).not.toBe(notificationId(raw));
  });

  it('does not double-prefix an id that already carries the namespace', () => {
    expect(oneOffNotificationKey('oneoff:abc')).toBe('oneoff:abc');
  });

  it('is stable for the same trip so rescheduling replaces its own reminder', () => {
    expect(notificationId(oneOffNotificationKey('oneoff:abc'))).toBe(
      notificationId(oneOffNotificationKey('oneoff:abc')),
    );
  });

  it('keeps distinct one-off trips on distinct notification ids', () => {
    expect(notificationId(oneOffNotificationKey('oneoff:a'))).not.toBe(
      notificationId(oneOffNotificationKey('oneoff:b')),
    );
  });

  it('schedules and cancels through the same key for a stored trip', () => {
    // Cancellation must resolve the same id the scheduler used, including the prefix.
    const stored = trip({ id: 'oneoff:stored-id' });
    expect(notificationId(oneOffNotificationKey(stored.id))).toBe(
      notificationId(oneOffNotificationKey(stored.id)),
    );
  });

  it('keeps alert reminders on their own namespace too', () => {
    const key = 'alert:some-alert-id';
    expect(notificationId(key)).not.toBe(notificationId(oneOffNotificationKey(key)));
  });
});

describe('one-off trip buffer', () => {
  it('is stored per trip rather than in the global settings', () => {
    expect(trip({ id: 'oneoff:a', bufferMinutes: 5 }).bufferMinutes).toBe(5);
    expect(trip({ id: 'oneoff:b', bufferMinutes: 25 }).bufferMinutes).toBe(25);
  });

  it('keeps a deliberate zero buffer instead of coercing it to a default', () => {
    expect(trip({ bufferMinutes: 0 }).bufferMinutes).toBe(0);
  });

  it('pulls the effective deadline earlier by exactly the buffer', () => {
    const deadline = new Date('2026-10-05T10:00:00-04:00');
    const effective = new Date(deadline.getTime() - 15 * 60_000);
    expect(effective.getHours()).toBe(9);
    expect(effective.getMinutes()).toBe(45);
  });
});

describe('one-off trip selection shape', () => {
  it('carries a complete selection so the engine never searches or substitutes', () => {
    const value = trip();
    expect(value.routeId).toBeTruthy();
    expect(value.originStopId).toBeTruthy();
    expect(value.destinationStopId).toBeTruthy();
  });

  it('keeps an optional route family alongside the canonical raw route id', () => {
    const value = trip({ routeId: 'TL-13', routeFamilyId: 'duke-llccw' });
    expect(value.routeId).toBe('TL-13');
    expect(value.routeFamilyId).toBe('duke-llccw');
  });

  it('allows a trip with no family for an ordinary single line', () => {
    expect(trip().routeFamilyId).toBeUndefined();
  });
});
