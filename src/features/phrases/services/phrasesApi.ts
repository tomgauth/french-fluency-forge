/**
 * Phrases API - Supabase implementation with localStorage fallback
 * Attempts to use Supabase tables, falls back to localStorage if tables don't exist
 */

import { supabase } from '@/integrations/supabase/client';
import type { MemberPhraseCard, Phrase, PhraseReviewLog, PhraseSettings } from '../types';

// Tables created by migration 20260102164444_phrases_learning_ladder.sql:
// - phrases
// - member_phrase_cards
// - phrase_review_logs  
// - member_phrase_settings

type DbMemberPhraseCard = Record<string, unknown> & {
  phrase?: Record<string, unknown>;
};

const DEFAULT_SETTINGS: Omit<PhraseSettings, 'member_id'> = {
  new_per_day: 20,
  reviews_per_day: 100,
  target_retention: 0.9,
  speech_feedback_enabled: false,
  auto_assess_enabled: false,
  recognition_shadow_default: false,
  show_time_to_recall: true,
};

function mapPhraseRow(row: Record<string, unknown>): Phrase {
  return {
    id: row.id as string,
    mode: row.mode as Phrase['mode'],
    prompt_en: (row.prompt_en as string) ?? undefined,
    audio_url: (row.audio_url as string) ?? undefined,
    transcript_fr: (row.transcript_fr as string) ?? undefined,
    translation_en: (row.translation_en as string) ?? undefined,
    answers_fr: (row.answers_fr as string[]) ?? undefined,
    canonical_fr: (row.canonical_fr as string) ?? undefined,
    tags: (row.tags as string[]) ?? [],
    difficulty: ((row.difficulty as number) ?? 3) as 1 | 2 | 3 | 4 | 5,
    scaffold_overrides: (row.scaffold_overrides as Phrase['scaffold_overrides']) ?? undefined,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
  };
}

export function mapDbCardToMemberCard(row: DbMemberPhraseCard): MemberPhraseCard {
  return {
    id: row.id as string,
    member_id: row.member_id as string,
    phrase_id: row.phrase_id as string,
    status: row.status as MemberPhraseCard['status'],
    priority: (row.priority as number) ?? 0,
    scheduler: {
      algorithm: ((row.scheduler_algorithm as string) || 'fsrs') as 'fsrs' | 'sm2',
      state: (row.scheduler_state as MemberPhraseCard['scheduler']['state']) || 'new',
      due_at: row.due_at as string,
      last_reviewed_at: (row.last_reviewed_at as string) ?? undefined,
      stability: (row.stability as number) ?? undefined,
      difficulty: (row.difficulty as number) ?? undefined,
      interval_ms: (row.interval_ms as number) ?? undefined,
      repetitions: (row.repetitions as number) ?? undefined,
      interval_days: (row.interval_days as number) ?? undefined,
      ease_factor: (row.ease_factor as number) ?? undefined,
      scheduler_state_jsonb: (row.scheduler_state_jsonb as Record<string, unknown>) ?? undefined,
      short_term_step_index: (row.short_term_step_index as number) ?? undefined,
    },
    assist_level: (row.assist_level as number) ?? 0,
    consecutive_again: (row.consecutive_again as number) ?? 0,
    again_count_24h: (row.again_count_24h as number) ?? 0,
    again_count_7d: (row.again_count_7d as number) ?? 0,
    paused_reason: (row.paused_reason as string) ?? undefined,
    paused_at: (row.paused_at as string) ?? undefined,
    lapses: (row.lapses as number) ?? 0,
    reviews: (row.reviews as number) ?? 0,
    note: (row.note as string) ?? undefined,
    flag_reason: (row.flag_reason as string) ?? undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function mapMemberCardToDb(card: MemberPhraseCard) {
  return {
    id: card.id,
    member_id: card.member_id,
    phrase_id: card.phrase_id,
    status: card.status,
    priority: card.priority ?? 0,
    scheduler_algorithm: card.scheduler.algorithm,
    scheduler_state: card.scheduler.state,
    due_at: card.scheduler.due_at,
    last_reviewed_at: card.scheduler.last_reviewed_at ?? null,
    stability: card.scheduler.stability ?? null,
    difficulty: card.scheduler.difficulty ?? null,
    interval_ms: card.scheduler.interval_ms ?? null,
    repetitions: card.scheduler.repetitions ?? 0,
    interval_days: card.scheduler.interval_days ?? 0,
    ease_factor: card.scheduler.ease_factor ?? 2.5,
    scheduler_state_jsonb: card.scheduler.scheduler_state_jsonb ?? {},
    short_term_step_index: card.scheduler.short_term_step_index ?? null,
    assist_level: card.assist_level ?? 0,
    consecutive_again: card.consecutive_again ?? 0,
    again_count_24h: card.again_count_24h ?? 0,
    again_count_7d: card.again_count_7d ?? 0,
    paused_reason: card.paused_reason ?? null,
    paused_at: card.paused_at ?? null,
    lapses: card.lapses ?? 0,
    reviews: card.reviews ?? 0,
    note: card.note ?? null,
    flag_reason: card.flag_reason ?? null,
    updated_at: new Date().toISOString(),
  };
}

// Note: Using type assertion for Supabase client because the generated types
// may not include phrases tables until `supabase gen types typescript` is run
// after the phrases_learning_ladder migration is applied.
// This allows the code to work regardless of migration state.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// Fetch member cards with phrases from Supabase
export async function fetchMemberCardsWithPhrases(memberId: string): Promise<{
  cards: MemberPhraseCard[];
  phraseMap: Record<string, Phrase>;
}> {
  try {
    // Try to fetch from Supabase
    const { data, error } = await db
      .from('member_phrase_cards')
      .select('*, phrase:phrases(*)')
      .eq('member_id', memberId);

    if (error) {
      // Table might not exist, fall back to localStorage
      console.warn('[phrasesApi] Error fetching cards, falling back to localStorage:', error.message);
      return { cards: [], phraseMap: {} };
    }

    if (!data || data.length === 0) {
      return { cards: [], phraseMap: {} };
    }

    const cards: MemberPhraseCard[] = [];
    const phraseMap: Record<string, Phrase> = {};

    for (const row of data as DbMemberPhraseCard[]) {
      cards.push(mapDbCardToMemberCard(row));
      if (row.phrase) {
        const phrase = mapPhraseRow(row.phrase);
        phraseMap[phrase.id] = phrase;
      }
    }

    return { cards, phraseMap };
  } catch (err) {
    console.warn('[phrasesApi] fetchMemberCardsWithPhrases failed:', err);
    return { cards: [], phraseMap: {} };
  }
}

// Upsert member cards to Supabase
export async function upsertMemberCards(cards: MemberPhraseCard[]) {
  if (cards.length === 0) {
    return { data: null, error: null };
  }

  try {
    const dbCards = cards.map(mapMemberCardToDb);
    const { data, error } = await db
      .from('member_phrase_cards')
      .upsert(dbCards, { onConflict: 'id' });

    if (error) {
      console.warn('[phrasesApi] Error upserting cards:', error.message);
    }

    return { data, error };
  } catch (err) {
    console.warn('[phrasesApi] upsertMemberCards failed:', err);
    return { data: null, error: err };
  }
}

export function mapLogToDb(log: PhraseReviewLog) {
  return {
    member_id: log.member_id,
    phrase_id: log.phrase_id,
    card_id: log.card_id,
    started_at: log.started_at,
    revealed_at: log.revealed_at ?? null,
    rated_at: log.rated_at,
    rating: log.rating,
    response_time_ms: log.response_time_ms ?? null,
    mode: log.mode,
    state_before: log.state_before,
    state_after: log.state_after,
    due_before: log.due_before,
    due_after: log.due_after,
    interval_before_ms: log.interval_before_ms ?? null,
    interval_after_ms: log.interval_after_ms,
    stability_before: log.stability_before ?? null,
    stability_after: log.stability_after ?? null,
    difficulty_before: log.difficulty_before ?? null,
    difficulty_after: log.difficulty_after ?? null,
    elapsed_ms: log.elapsed_ms ?? null,
    was_overdue: log.was_overdue,
    overdue_ms: log.overdue_ms ?? null,
    config_snapshot: log.config_snapshot ?? null,
    speech_used: log.speech_used,
    transcript: log.transcript ?? null,
    similarity: log.similarity ?? null,
    auto_assessed: log.auto_assessed ?? false,
    suggested_rating: log.suggested_rating ?? null,
  };
}

// Insert review log to Supabase
export async function insertReviewLog(log: PhraseReviewLog) {
  try {
    const dbLog = mapLogToDb(log);
    const { data, error } = await db
      .from('phrase_review_logs')
      .insert(dbLog);

    if (error) {
      console.warn('[phrasesApi] Error inserting review log:', error.message);
    }

    return { data, error };
  } catch (err) {
    console.warn('[phrasesApi] insertReviewLog failed:', err);
    return { data: null, error: err };
  }
}

// Fetch member phrase settings from Supabase
export async function fetchMemberPhraseSettings(memberId: string): Promise<PhraseSettings> {
  try {
    const { data, error } = await db
      .from('member_phrase_settings')
      .select('*')
      .eq('member_id', memberId)
      .single();

    if (error || !data) {
      // Return defaults if not found
      return {
        member_id: memberId,
        ...DEFAULT_SETTINGS,
      };
    }

    return {
      member_id: data.member_id,
      new_per_day: data.new_per_day ?? DEFAULT_SETTINGS.new_per_day,
      reviews_per_day: data.reviews_per_day ?? DEFAULT_SETTINGS.reviews_per_day,
      target_retention: data.target_retention ?? DEFAULT_SETTINGS.target_retention,
      speech_feedback_enabled: data.speech_feedback_enabled ?? DEFAULT_SETTINGS.speech_feedback_enabled,
      auto_assess_enabled: data.auto_assess_enabled ?? DEFAULT_SETTINGS.auto_assess_enabled,
      recognition_shadow_default: data.recognition_shadow_default ?? DEFAULT_SETTINGS.recognition_shadow_default,
      show_time_to_recall: data.show_time_to_recall ?? DEFAULT_SETTINGS.show_time_to_recall,
    };
  } catch (err) {
    console.warn('[phrasesApi] fetchMemberPhraseSettings failed:', err);
    return {
      member_id: memberId,
      ...DEFAULT_SETTINGS,
    };
  }
}

// Upsert member phrase settings to Supabase
export async function upsertMemberPhraseSettings(settings: PhraseSettings) {
  try {
    const { data, error } = await db
      .from('member_phrase_settings')
      .upsert({
        member_id: settings.member_id,
        new_per_day: settings.new_per_day,
        reviews_per_day: settings.reviews_per_day,
        target_retention: settings.target_retention,
        speech_feedback_enabled: settings.speech_feedback_enabled,
        auto_assess_enabled: settings.auto_assess_enabled,
        recognition_shadow_default: settings.recognition_shadow_default,
        show_time_to_recall: settings.show_time_to_recall,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'member_id' });

    if (error) {
      console.warn('[phrasesApi] Error upserting settings:', error.message);
    }

    return { data, error };
  } catch (err) {
    console.warn('[phrasesApi] upsertMemberPhraseSettings failed:', err);
    return { data: null, error: err };
  }
}

// Insert phrases to Supabase (for TSV import)
export async function insertPhrases(phrases: Phrase[]) {
  if (phrases.length === 0) {
    return { data: null, error: null };
  }

  try {
    const dbPhrases = phrases.map((p) => ({
      id: p.id,
      mode: p.mode,
      prompt_en: p.prompt_en ?? null,
      audio_url: p.audio_url ?? null,
      transcript_fr: p.transcript_fr ?? null,
      translation_en: p.translation_en ?? null,
      answers_fr: p.answers_fr ?? null,
      canonical_fr: p.canonical_fr ?? null,
      tags: p.tags ?? [],
      difficulty: p.difficulty ?? 3,
      scaffold_overrides: p.scaffold_overrides ?? null,
      created_at: p.created_at,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await db
      .from('phrases')
      .upsert(dbPhrases, { onConflict: 'id' });

    if (error) {
      console.warn('[phrasesApi] Error inserting phrases:', error.message);
    }

    return { data, error };
  } catch (err) {
    console.warn('[phrasesApi] insertPhrases failed:', err);
    return { data: null, error: err };
  }
}
