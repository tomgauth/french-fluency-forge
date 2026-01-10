-- FRENCH FLUENCY FORGE - SAFE MIGRATIONS (Idempotent)
-- This version uses IF NOT EXISTS and won't fail if objects already exist
-- Run this if you get "already exists" errors with the regular migrations

-- ============================================================================
-- ENUMS (with conflict handling)
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
        CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'non_binary', 'prefer_not');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'age_band_type') THEN
        CREATE TYPE public.age_band_type AS ENUM ('18_24', '25_34', '35_44', '45_54', '55_64', '65_plus');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'track_type') THEN
        CREATE TYPE public.track_type AS ENUM ('small_talk', 'transactions', 'bilingual_friends', 'work', 'home', 'in_laws');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
        CREATE TYPE public.session_status AS ENUM ('intake', 'consent', 'quiz', 'mic_check', 'assessment', 'processing', 'completed', 'abandoned');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_stage') THEN
        CREATE TYPE public.call_stage AS ENUM ('rapport', 'diagnose', 'qualify', 'present', 'objections', 'close', 'next_steps');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_outcome') THEN
        CREATE TYPE public.call_outcome AS ENUM ('won', 'lost', 'follow_up', 'refer_out');
    END IF;
END $$;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchases table
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'pending',
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Consent records table
CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  recording_consent BOOLEAN NOT NULL DEFAULT false,
  data_processing_consent BOOLEAN NOT NULL DEFAULT false,
  retention_acknowledged BOOLEAN NOT NULL DEFAULT false,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Assessment sessions table
CREATE TABLE IF NOT EXISTS public.assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  status session_status NOT NULL DEFAULT 'intake',
  gender gender_type,
  age_band age_band_type,
  languages_spoken TEXT[],
  goals TEXT,
  primary_track track_type,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  variant TEXT,
  archetype TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns if they don't exist
ALTER TABLE public.assessment_sessions 
  ADD COLUMN IF NOT EXISTS fluency_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fluency_locked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS confidence_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence_locked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS syntax_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS syntax_locked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS conversation_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS conversation_locked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS comprehension_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS comprehension_locked_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- RECORDING TABLES
-- ============================================================================

-- Fluency recordings
CREATE TABLE IF NOT EXISTS public.fluency_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  item_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  used_for_scoring BOOLEAN NOT NULL DEFAULT true,
  superseded BOOLEAN NOT NULL DEFAULT false,
  transcript TEXT,
  word_count INTEGER,
  duration_seconds NUMERIC(10, 2),
  wpm INTEGER,
  pause_count INTEGER,
  total_pause_duration NUMERIC(10, 2),
  audio_storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  speaking_session_id UUID,
  speaking_item_id UUID,
  prompt_id TEXT,
  prompt_version TEXT,
  scorer_version TEXT,
  asr_version TEXT,
  UNIQUE(session_id, item_id, attempt_number)
);

-- Skill recordings
CREATE TABLE IF NOT EXISTS public.skill_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL CHECK (module_type IN ('confidence', 'syntax', 'conversation')),
  item_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  audio_storage_path TEXT,
  transcript TEXT,
  duration_seconds NUMERIC,
  word_count INTEGER,
  ai_score NUMERIC,
  ai_feedback TEXT,
  ai_breakdown JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'processing', 'completed', 'error')),
  error_message TEXT,
  superseded BOOLEAN NOT NULL DEFAULT false,
  used_for_scoring BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  speaking_session_id UUID,
  speaking_item_id UUID,
  prompt_id TEXT,
  prompt_version TEXT,
  scorer_version TEXT,
  asr_version TEXT
);

-- Comprehension recordings
CREATE TABLE IF NOT EXISTS public.comprehension_recordings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  item_id text NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  audio_storage_path text,
  transcript text,
  audio_played_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending',
  ai_score numeric,
  ai_feedback_fr text,
  understood_facts jsonb,
  intent_match jsonb,
  ai_confidence numeric,
  superseded boolean NOT NULL DEFAULT false,
  used_for_scoring boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  speaking_session_id UUID,
  speaking_item_id UUID,
  prompt_id TEXT,
  prompt_version TEXT,
  scorer_version TEXT,
  asr_version TEXT
);

-- ============================================================================
-- SUPPORT TABLES
-- ============================================================================

-- Fluency events
CREATE TABLE IF NOT EXISTS public.fluency_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  event_type TEXT NOT NULL,
  item_id TEXT,
  attempt_number INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Archetype feedback
CREATE TABLE IF NOT EXISTS public.archetype_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.assessment_sessions(id),
  feedback_text TEXT NOT NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Confidence questionnaire responses
CREATE TABLE IF NOT EXISTS public.confidence_questionnaire_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  responses jsonb NOT NULL DEFAULT '{}',
  raw_score numeric,
  normalized_score numeric,
  honesty_flag boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (session_id)
);

-- ============================================================================
-- SYSTEME.IO WEBHOOK + CREDITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.systemeio_webhook_events (
  id text PRIMARY KEY,
  event_name text NOT NULL,
  event_timestamp timestamptz NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  processing_status text NOT NULL DEFAULT 'received',
  error text NULL
);

CREATE TABLE IF NOT EXISTS public.app_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  email text NOT NULL UNIQUE,
  access_status text NOT NULL DEFAULT 'inactive',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  test_credits_remaining int NOT NULL DEFAULT 0,
  test_credits_lifetime int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  delta int NOT NULL,
  reason text NOT NULL,
  systemeio_order_id text NULL,
  systemeio_offer_price_plan_id text NULL,
  systemeio_message_id text NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.systemeio_product_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_price_plan_id text NOT NULL UNIQUE,
  product_key text NOT NULL,
  grants_access boolean NOT NULL DEFAULT false,
  credits_delta int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  note text NULL
);

-- ============================================================================
-- SALES CRM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  linked_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  timezone TEXT,
  country TEXT,
  current_level TEXT,
  goal TEXT,
  deadline_urgency TEXT,
  motivation TEXT,
  biggest_blockers TEXT[],
  past_methods_tried TEXT[],
  time_available_per_week INTEGER,
  willingness_to_speak INTEGER CHECK (willingness_to_speak >= 1 AND willingness_to_speak <= 5),
  budget_comfort INTEGER CHECK (budget_comfort >= 1 AND budget_comfort <= 5),
  decision_maker TEXT CHECK (decision_maker IN ('yes', 'no', 'unsure')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.sales_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.sales_leads(id) ON DELETE CASCADE NOT NULL,
  stage call_stage NOT NULL DEFAULT 'rapport',
  transcript_notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  answers JSONB DEFAULT '[]'::jsonb,
  outcome call_outcome,
  follow_up_email TEXT,
  summary TEXT,
  qualification_score INTEGER DEFAULT 50 CHECK (qualification_score >= 0 AND qualification_score <= 100),
  qualification_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.sales_playbook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  playbook_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ============================================================================
-- SPEAKING ASSESSMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.speaking_assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('full', 'single_module')),
  single_module_type TEXT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  seed INTEGER NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT '2026-01-04',
  scorer_version TEXT NOT NULL DEFAULT '2026-01-04',
  asr_version TEXT NOT NULL DEFAULT 'whisper-1',
  current_module TEXT NULL,
  current_item_index INTEGER NOT NULL DEFAULT 0,
  selected_prompt_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.speaking_assessment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.speaking_assessment_sessions(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL,
  item_index INTEGER NOT NULL,
  prompt_id TEXT NOT NULL,
  prompt_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'not_started',
  attempt_number INTEGER NOT NULL DEFAULT 1,
  result_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, module_type, item_index)
);

-- ============================================================================
-- SCORING TRACES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scoring_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  recording_id UUID,
  module_type TEXT,
  input_data JSONB,
  output_data JSONB,
  model_used TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- COMPREHENSION ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.comprehension_items (
  id TEXT PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'fr-FR',
  cefr_level TEXT NOT NULL CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  transcript_fr TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  estimated_duration_s NUMERIC NOT NULL,
  prompt JSONB,
  prompt_fr TEXT,
  prompt_en TEXT,
  options JSONB NOT NULL,
  answer_key JSONB NOT NULL,
  audio_url TEXT,
  audio_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- UNIFIED EXAM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.unified_exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_1_id TEXT NOT NULL,
  scenario_2_id TEXT NOT NULL,
  scenario_3_id TEXT NOT NULL,
  persona_1_id TEXT NOT NULL,
  persona_2_id TEXT NOT NULL,
  persona_3_id TEXT NOT NULL,
  tier_1 INTEGER NOT NULL CHECK (tier_1 IN (1, 2, 3)),
  tier_2 INTEGER NOT NULL CHECK (tier_2 IN (1, 2, 3)),
  tier_3 INTEGER NOT NULL CHECK (tier_3 IN (1, 2, 3)),
  conversation_transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  fluency_score INTEGER CHECK (fluency_score >= 0 AND fluency_score <= 100),
  syntax_score INTEGER CHECK (syntax_score >= 0 AND syntax_score <= 100),
  conversation_score INTEGER CHECK (conversation_score >= 0 AND conversation_score <= 100),
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  proficiency_level TEXT CHECK (proficiency_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  trace_id UUID,
  is_official BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluency_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprehension_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluency_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archetype_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confidence_questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.systemeio_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.systemeio_product_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_playbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_assessment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprehension_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_exam_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Admin check function
CREATE OR REPLACE FUNCTION public.is_admin_user(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN user_email IN ('tom@solvlanguages.com');
END;
$$;

-- ============================================================================
-- TRIGGERS (with safety checks)
-- ============================================================================

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- ============================================================================
-- RLS POLICIES (Drop and recreate to avoid conflicts)
-- ============================================================================

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Purchases
DROP POLICY IF EXISTS "Users can view own purchases" ON public.purchases;
CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id);

-- Consent
DROP POLICY IF EXISTS "Users can view own consent" ON public.consent_records;
DROP POLICY IF EXISTS "Users can insert own consent" ON public.consent_records;
CREATE POLICY "Users can view own consent" ON public.consent_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own consent" ON public.consent_records FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Assessment sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON public.assessment_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.assessment_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.assessment_sessions;
CREATE POLICY "Users can view own sessions" ON public.assessment_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.assessment_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.assessment_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Fluency recordings
DROP POLICY IF EXISTS "Users can view own fluency recordings" ON public.fluency_recordings;
DROP POLICY IF EXISTS "Users can insert own fluency recordings" ON public.fluency_recordings;
DROP POLICY IF EXISTS "Users can update own fluency recordings" ON public.fluency_recordings;
CREATE POLICY "Users can view own fluency recordings" ON public.fluency_recordings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own fluency recordings" ON public.fluency_recordings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fluency recordings" ON public.fluency_recordings FOR UPDATE USING (auth.uid() = user_id);

-- Skill recordings
DROP POLICY IF EXISTS "Users can view own skill recordings" ON public.skill_recordings;
DROP POLICY IF EXISTS "Users can insert own skill recordings" ON public.skill_recordings;
DROP POLICY IF EXISTS "Users can update own skill recordings" ON public.skill_recordings;
CREATE POLICY "Users can view own skill recordings" ON public.skill_recordings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own skill recordings" ON public.skill_recordings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own skill recordings" ON public.skill_recordings FOR UPDATE USING (auth.uid() = user_id);

-- Comprehension recordings
DROP POLICY IF EXISTS "Users can view own comprehension recordings" ON public.comprehension_recordings;
DROP POLICY IF EXISTS "Users can insert own comprehension recordings" ON public.comprehension_recordings;
DROP POLICY IF EXISTS "Users can update own comprehension recordings" ON public.comprehension_recordings;
CREATE POLICY "Users can view own comprehension recordings" ON public.comprehension_recordings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own comprehension recordings" ON public.comprehension_recordings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comprehension recordings" ON public.comprehension_recordings FOR UPDATE USING (auth.uid() = user_id);

-- Comprehension items (public read)
DROP POLICY IF EXISTS "Anyone can read comprehension items" ON public.comprehension_items;
CREATE POLICY "Anyone can read comprehension items" ON public.comprehension_items FOR SELECT USING (true);

-- App accounts
DROP POLICY IF EXISTS "Users can view own app_account" ON public.app_accounts;
CREATE POLICY "Users can view own app_account" ON public.app_accounts FOR SELECT USING (auth.uid() = user_id);

-- Credit wallets
DROP POLICY IF EXISTS "Users can view own credit_wallet" ON public.credit_wallets;
CREATE POLICY "Users can view own credit_wallet" ON public.credit_wallets FOR SELECT 
  USING (account_id IN (SELECT id FROM public.app_accounts WHERE user_id = auth.uid()));

-- Unified exam
DROP POLICY IF EXISTS "Users can read own unified exam sessions" ON public.unified_exam_sessions;
DROP POLICY IF EXISTS "Users can insert own unified exam sessions" ON public.unified_exam_sessions;
DROP POLICY IF EXISTS "Users can update own unified exam sessions" ON public.unified_exam_sessions;
CREATE POLICY "Users can read own unified exam sessions" ON public.unified_exam_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own unified exam sessions" ON public.unified_exam_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own unified exam sessions" ON public.unified_exam_sessions FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_fluency_recordings_session ON public.fluency_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_fluency_recordings_user ON public.fluency_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_recordings_session_id ON public.skill_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_skill_recordings_user_id ON public.skill_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_recordings_module_type ON public.skill_recordings(module_type);
CREATE INDEX IF NOT EXISTS idx_comprehension_recordings_session ON public.comprehension_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_comprehension_items_cefr ON public.comprehension_items(cefr_level);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT 'All tables created successfully!' as status;
