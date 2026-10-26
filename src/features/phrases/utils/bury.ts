/**
 * Bury helpers
 *
 * "Bury" hides a phrase until the next day. The card is stored with
 * status = 'buried', paused_reason = BURY_REASON and paused_at = bury time.
 * Nothing on the server un-buries cards, so the client does it whenever the
 * member's cards are loaded or a session starts: every buried card whose bury
 * date is before today (local time) goes back to 'active'.
 *
 * Buried cards that carry no bury timestamp (cards buried before this logic
 * existed) are treated as expired and un-buried too, since the member was told
 * they would come back the next day.
 */

import type { MemberPhraseCard } from '../types';

export const BURY_REASON = 'buried';

function startOfLocalDay(date: Date): number {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/**
 * Mark a card as buried until tomorrow.
 */
export function buryCardUntilTomorrow(card: MemberPhraseCard, now: Date = new Date()): MemberPhraseCard {
  const nowIso = now.toISOString();
  return {
    ...card,
    status: 'buried',
    paused_reason: BURY_REASON,
    paused_at: nowIso,
    updated_at: nowIso,
  };
}

/**
 * True when a buried card should be visible again: it was buried on a day
 * before `now` (local time), or it has no bury timestamp at all.
 */
export function isBuryExpired(card: MemberPhraseCard, now: Date = new Date()): boolean {
  if (card.status !== 'buried') return false;
  if (!card.paused_at) return true;

  const buriedAt = new Date(card.paused_at);
  if (Number.isNaN(buriedAt.getTime())) return true;

  return startOfLocalDay(buriedAt) < startOfLocalDay(now);
}

/**
 * Un-bury every expired buried card. Returns the full card list (untouched
 * cards keep their identity) plus the list of cards that changed, so the
 * caller can persist only those.
 */
export function unburyExpiredCards(
  cards: MemberPhraseCard[],
  now: Date = new Date()
): { cards: MemberPhraseCard[]; changed: MemberPhraseCard[] } {
  const changed: MemberPhraseCard[] = [];
  const nowIso = now.toISOString();

  const next = cards.map((card) => {
    if (!isBuryExpired(card, now)) return card;
    const reactivated: MemberPhraseCard = {
      ...card,
      status: 'active',
      paused_reason: undefined,
      paused_at: undefined,
      updated_at: nowIso,
    };
    changed.push(reactivated);
    return reactivated;
  });

  return { cards: changed.length > 0 ? next : cards, changed };
}
