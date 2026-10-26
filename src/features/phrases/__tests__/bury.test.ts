/**
 * Bury / un-bury unit tests
 * "Bury" hides a card until the next local day; expired buries come back automatically.
 */

import { describe, it, expect } from 'vitest';
import { BURY_REASON, buryCardUntilTomorrow, isBuryExpired, unburyExpiredCards } from '../utils/bury';
import type { MemberPhraseCard } from '../types';

function createCard(id: string, overrides: Partial<MemberPhraseCard> = {}): MemberPhraseCard {
  return {
    id,
    member_id: 'test-user',
    phrase_id: `phrase-${id}`,
    status: 'active',
    priority: 0,
    scheduler: {
      algorithm: 'fsrs',
      state: 'review',
      due_at: '2026-01-01T10:00:00.000Z',
    },
    lapses: 0,
    reviews: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Local noon, so "start of day" comparisons never straddle a timezone edge.
const localDay = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0, 0);

describe('buryCardUntilTomorrow', () => {
  it('sets status, reason and bury timestamp', () => {
    const now = localDay(2026, 3, 10);
    const buried = buryCardUntilTomorrow(createCard('1'), now);

    expect(buried.status).toBe('buried');
    expect(buried.paused_reason).toBe(BURY_REASON);
    expect(buried.paused_at).toBe(now.toISOString());
    expect(buried.updated_at).toBe(now.toISOString());
  });
});

describe('isBuryExpired', () => {
  it('is false for non-buried cards', () => {
    expect(isBuryExpired(createCard('1', { status: 'suspended', paused_at: '2020-01-01T00:00:00.000Z' }))).toBe(false);
    expect(isBuryExpired(createCard('2', { status: 'active' }))).toBe(false);
  });

  it('is false on the day the card was buried', () => {
    const buriedAt = localDay(2026, 3, 10, 9);
    const card = buryCardUntilTomorrow(createCard('1'), buriedAt);

    expect(isBuryExpired(card, localDay(2026, 3, 10, 23))).toBe(false);
  });

  it('is true from the next local day onwards', () => {
    const buriedAt = localDay(2026, 3, 10, 23);
    const card = buryCardUntilTomorrow(createCard('1'), buriedAt);

    expect(isBuryExpired(card, localDay(2026, 3, 11, 0))).toBe(true);
    expect(isBuryExpired(card, localDay(2026, 4, 2))).toBe(true);
  });

  it('is true for legacy buried cards without a timestamp', () => {
    expect(isBuryExpired(createCard('1', { status: 'buried' }))).toBe(true);
    expect(isBuryExpired(createCard('2', { status: 'buried', paused_at: 'not-a-date' }))).toBe(true);
  });
});

describe('unburyExpiredCards', () => {
  it('reactivates expired buries and leaves everything else untouched', () => {
    const now = localDay(2026, 3, 11);
    const expired = buryCardUntilTomorrow(createCard('expired'), localDay(2026, 3, 10));
    const fresh = buryCardUntilTomorrow(createCard('fresh'), localDay(2026, 3, 11, 8));
    const legacy = createCard('legacy', { status: 'buried' });
    const suspended = createCard('suspended', { status: 'suspended', paused_reason: 'struggling', paused_at: '2026-01-01T00:00:00.000Z' });
    const active = createCard('active');

    const { cards, changed } = unburyExpiredCards([expired, fresh, legacy, suspended, active], now);

    expect(changed.map((c) => c.id).sort()).toEqual(['expired', 'legacy']);
    for (const card of changed) {
      expect(card.status).toBe('active');
      expect(card.paused_reason).toBeUndefined();
      expect(card.paused_at).toBeUndefined();
      expect(card.updated_at).toBe(now.toISOString());
    }

    // Order preserved, untouched cards keep their identity
    expect(cards.map((c) => c.id)).toEqual(['expired', 'fresh', 'legacy', 'suspended', 'active']);
    expect(cards[1]).toBe(fresh);
    expect(cards[3]).toBe(suspended);
    expect(cards[4]).toBe(active);
    expect(cards[3].status).toBe('suspended');
  });

  it('returns the same array when nothing expired', () => {
    const now = localDay(2026, 3, 11);
    const input = [createCard('a'), buryCardUntilTomorrow(createCard('b'), now)];

    const { cards, changed } = unburyExpiredCards(input, now);

    expect(changed).toHaveLength(0);
    expect(cards).toBe(input);
  });
});
