-- ============================================
-- TOM'S BASELINE MIGRATION
-- ============================================
-- This file simulates Tom's existing Supabase state
-- Run this FIRST on a fresh Supabase project to test
-- that the delivery SQL files (01, 02, 03) work correctly.
--
-- Source: tomgauth/french-fluency-forge
--   - 20260102164444_phrases_learning_ladder.sql
-- ============================================

-- ============================================
-- ENUMS (from Tom's phrases migration)
-- ============================================
CREATE TYPE public.phrase_mode AS ENUM ('recall', 'recognition');
CREATE TYPE public.phrase_status AS ENUM ('active', 'buried', 'suspended', 'removed');
CREATE TYPE public.rating_type AS ENUM ('again', 'hard', 'good', 'easy');
CREATE TYPE public.scheduler_state AS ENUM ('new', 'learning', 'review', 'relearning');

-- ============================================
-- PHRASES TABLE (from Tom's migration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode phrase_mode NOT NULL,
  
  -- Recall: show English, expect French
  prompt_en TEXT,
  
  -- Recognition: audio prompt, reveal transcript+translation
  audio_url TEXT,
  transcript_fr TEXT,
  translation_en TEXT,
  
  -- Answers (recall)
  answers_fr TEXT[], -- acceptable variants
  canonical_fr TEXT, -- primary display
  
  tags TEXT[] DEFAULT '{}',
  difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 5) DEFAULT 3,
  
  -- Scaffold overrides for assist levels
  scaffold_overrides JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- MEMBER PHRASE CARDS TABLE (from Tom's migration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.member_phrase_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phrase_id UUID REFERENCES public.phrases(id) ON DELETE CASCADE NOT NULL,
  
  status phrase_status NOT NULL DEFAULT 'active',
  priority INTEGER DEFAULT 0,
  
  -- Scheduler state
  scheduler_algorithm TEXT DEFAULT 'fsrs' CHECK (scheduler_algorithm IN ('fsrs', 'sm2')),
  scheduler_state scheduler_state NOT NULL DEFAULT 'new',
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed_at TIMESTAMPTZ,
  
  -- FSRS fields
  stability NUMERIC, -- days
  difficulty NUMERIC CHECK (difficulty >= 1 AND difficulty <= 10),
  interval_ms BIGINT, -- precise interval in milliseconds (for short-term steps)
  
  -- SM-2 fields (for backward compatibility)
  repetitions INTEGER DEFAULT 0,
  interval_days INTEGER DEFAULT 0,
  ease_factor NUMERIC DEFAULT 2.5 CHECK (ease_factor >= 1.3),
  
  -- FSRS card state (full state as JSONB)
  scheduler_state_jsonb JSONB DEFAULT '{}',
  
  -- Assist level (0-4)
  assist_level INTEGER NOT NULL DEFAULT 0 CHECK (assist_level >= 0 AND assist_level <= 4),
  
  -- Struggle counters
  consecutive_again INTEGER NOT NULL DEFAULT 0,
  again_count_24h INTEGER NOT NULL DEFAULT 0,
  again_count_7d INTEGER NOT NULL DEFAULT 0,
  
  -- Pause fields
  paused_reason TEXT,
  paused_at TIMESTAMPTZ,
  
  -- Short-term step tracking
  short_term_step_index INTEGER,
  
  -- UX/analytics
  lapses INTEGER NOT NULL DEFAULT 0,
  reviews INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  flag_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one card per member per phrase
  UNIQUE(member_id, phrase_id)
);

-- ============================================
-- PHRASE EXPLANATIONS TABLE (from Tom's migration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.phrase_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase_id UUID REFERENCES public.phrases(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  explanation_json JSONB NOT NULL,
  model TEXT, -- e.g., "gpt-4o-mini", "gpt-4.1"
  version INTEGER NOT NULL DEFAULT 1,
  
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PHRASE STRUGGLE EVENTS TABLE (from Tom's migration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.phrase_struggle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phrase_id UUID REFERENCES public.phrases(id) ON DELETE CASCADE NOT NULL,
  card_id UUID REFERENCES public.member_phrase_cards(id) ON DELETE CASCADE NOT NULL,
  
  trigger TEXT NOT NULL, -- e.g., "again_5_in_24h", "consecutive_5"
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================
-- PHRASE REVIEW LOGS TABLE (from Tom's migration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.phrase_review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phrase_id UUID REFERENCES public.phrases(id) ON DELETE CASCADE NOT NULL,
  card_id UUID REFERENCES public.member_phrase_cards(id) ON DELETE CASCADE NOT NULL,
  
  started_at TIMESTAMPTZ NOT NULL, -- card shown
  revealed_at TIMESTAMPTZ,
  rated_at TIMESTAMPTZ NOT NULL,
  
  rating rating_type NOT NULL,
  response_time_ms INTEGER, -- reveal - start
  mode phrase_mode NOT NULL,
  
  -- FSRS scheduling data
  state_before scheduler_state NOT NULL,
  state_after scheduler_state NOT NULL,
  due_before TIMESTAMPTZ NOT NULL,
  due_after TIMESTAMPTZ NOT NULL,
  interval_before_ms BIGINT,
  interval_after_ms BIGINT NOT NULL,
  stability_before NUMERIC,
  stability_after NUMERIC,
  difficulty_before NUMERIC,
  difficulty_after NUMERIC,
  elapsed_ms BIGINT, -- now - last_reviewed_at
  was_overdue BOOLEAN NOT NULL DEFAULT false,
  overdue_ms BIGINT,
  
  -- Config snapshot (for debugging and optimization)
  config_snapshot JSONB,
  
  -- Speech (optional)
  speech_used BOOLEAN NOT NULL DEFAULT false,
  transcript TEXT,
  similarity NUMERIC CHECK (similarity >= 0 AND similarity <= 1),
  auto_assessed BOOLEAN DEFAULT false,
  suggested_rating rating_type,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- MEMBER PHRASE SETTINGS TABLE (from Tom's migration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.member_phrase_settings (
  member_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  new_per_day INTEGER NOT NULL DEFAULT 20 CHECK (new_per_day >= 0 AND new_per_day <= 50),
  reviews_per_day INTEGER NOT NULL DEFAULT 100 CHECK (reviews_per_day >= 0 AND reviews_per_day <= 200),
  target_retention NUMERIC NOT NULL DEFAULT 0.90 CHECK (target_retention >= 0.75 AND target_retention <= 0.95),
  
  speech_feedback_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_assess_enabled BOOLEAN NOT NULL DEFAULT false,
  recognition_shadow_default BOOLEAN NOT NULL DEFAULT false,
  show_time_to_recall BOOLEAN NOT NULL DEFAULT true,
  
  -- FSRS config
  learning_steps TEXT[] DEFAULT ARRAY['30s', '5m', '20m'],
  relearning_steps TEXT[] DEFAULT ARRAY['2m', '10m'],
  enable_fuzz BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES (from Tom's migration)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_member_phrase_cards_member_id ON public.member_phrase_cards(member_id);
CREATE INDEX IF NOT EXISTS idx_member_phrase_cards_phrase_id ON public.member_phrase_cards(phrase_id);
CREATE INDEX IF NOT EXISTS idx_member_phrase_cards_due_at ON public.member_phrase_cards(due_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_member_phrase_cards_status ON public.member_phrase_cards(status);
CREATE INDEX IF NOT EXISTS idx_phrase_review_logs_member_id ON public.phrase_review_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_phrase_review_logs_card_id ON public.phrase_review_logs(card_id);
CREATE INDEX IF NOT EXISTS idx_phrase_review_logs_rated_at ON public.phrase_review_logs(rated_at);
CREATE INDEX IF NOT EXISTS idx_phrase_struggle_events_member_id ON public.phrase_struggle_events(member_id);
CREATE INDEX IF NOT EXISTS idx_phrase_struggle_events_resolved_at ON public.phrase_struggle_events(resolved_at) WHERE resolved_at IS NULL;

-- ============================================
-- ROW LEVEL SECURITY POLICIES (from Tom's migration)
-- ============================================

-- Phrases: everyone can read (SELECT only - THIS IS THE KEY!)
ALTER TABLE public.phrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Phrases are viewable by everyone"
  ON public.phrases FOR SELECT
  USING (true);

-- NOTE: Tom's original migration does NOT have INSERT/UPDATE/DELETE policies for phrases!
-- This is what causes the 403 error on TSV import.
-- Our 02_phrases_write_policies.sql fixes this.

-- Member phrase cards: members see their own (full CRUD)
ALTER TABLE public.member_phrase_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own cards"
  ON public.member_phrase_cards FOR SELECT
  USING (auth.uid() = member_id);

CREATE POLICY "Members can insert their own cards"
  ON public.member_phrase_cards FOR INSERT
  WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Members can update their own cards"
  ON public.member_phrase_cards FOR UPDATE
  USING (auth.uid() = member_id)
  WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Members can delete their own cards"
  ON public.member_phrase_cards FOR DELETE
  USING (auth.uid() = member_id);

-- Phrase explanations: everyone can read
ALTER TABLE public.phrase_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Phrase explanations are viewable by everyone"
  ON public.phrase_explanations FOR SELECT
  USING (true);

-- Phrase struggle events: members see their own
ALTER TABLE public.phrase_struggle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own struggle events"
  ON public.phrase_struggle_events FOR SELECT
  USING (auth.uid() = member_id);

-- Phrase review logs: members see their own
ALTER TABLE public.phrase_review_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own review logs"
  ON public.phrase_review_logs FOR SELECT
  USING (auth.uid() = member_id);

CREATE POLICY "Members can insert their own review logs"
  ON public.phrase_review_logs FOR INSERT
  WITH CHECK (auth.uid() = member_id);

-- Member phrase settings: members see and update their own
ALTER TABLE public.member_phrase_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own settings"
  ON public.member_phrase_settings FOR SELECT
  USING (auth.uid() = member_id);

CREATE POLICY "Members can insert their own settings"
  ON public.member_phrase_settings FOR INSERT
  WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Members can update their own settings"
  ON public.member_phrase_settings FOR UPDATE
  USING (auth.uid() = member_id)
  WITH CHECK (auth.uid() = member_id);

-- ============================================
-- UPDATED_AT TRIGGERS (from Tom's migration)
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_phrases_updated_at
  BEFORE UPDATE ON public.phrases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_phrase_cards_updated_at
  BEFORE UPDATE ON public.member_phrase_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_phrase_explanations_updated_at
  BEFORE UPDATE ON public.phrase_explanations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_phrase_settings_updated_at
  BEFORE UPDATE ON public.member_phrase_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- DONE! Tom's baseline is now set up.
-- Next, run the delivery SQL files:
--   1. 01_habits_goals.sql (adds new tables)
--   2. 02_phrases_write_policies.sql (fixes 403 error)
--   3. 03_phrases_audio_bucket.sql (adds storage)
-- ============================================
