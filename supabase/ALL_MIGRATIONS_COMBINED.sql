-- Enums
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'non_binary', 'prefer_not');
CREATE TYPE public.age_band_type AS ENUM ('18_24', '25_34', '35_44', '45_54', '55_64', '65_plus');
CREATE TYPE public.track_type AS ENUM ('small_talk', 'transactions', 'bilingual_friends', 'work', 'home', 'in_laws');
CREATE TYPE public.session_status AS ENUM ('intake', 'consent', 'quiz', 'mic_check', 'assessment', 'processing', 'completed', 'abandoned');

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchases table
CREATE TABLE public.purchases (
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
CREATE TABLE public.consent_records (
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
CREATE TABLE public.assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  status session_status NOT NULL DEFAULT 'intake',
  
  -- Intake data
  gender gender_type,
  age_band age_band_type,
  languages_spoken TEXT[],
  goals TEXT,
  primary_track track_type,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- A/B testing
  variant TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Purchases policies (users see their own, service can create)
CREATE POLICY "Users can view own purchases" ON public.purchases
  FOR SELECT USING (auth.uid() = user_id);

-- Consent policies
CREATE POLICY "Users can view own consent" ON public.consent_records
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own consent" ON public.consent_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Assessment session policies
CREATE POLICY "Users can view own sessions" ON public.assessment_sessions
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own sessions" ON public.assessment_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own sessions" ON public.assessment_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_assessment_sessions_updated_at
  BEFORE UPDATE ON public.assessment_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
-- Fix function search path for update_updated_at
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
-- Add archetype column to store quiz results
ALTER TABLE public.assessment_sessions 
ADD COLUMN archetype text;
-- Create fluency recordings table to track all attempts
CREATE TABLE public.fluency_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  item_id TEXT NOT NULL, -- e.g., 'fluency-1', 'fluency-2'
  attempt_number INTEGER NOT NULL DEFAULT 1,
  used_for_scoring BOOLEAN NOT NULL DEFAULT true,
  superseded BOOLEAN NOT NULL DEFAULT false,
  
  -- Analysis results (stored, but never shown to user)
  transcript TEXT,
  word_count INTEGER,
  duration_seconds NUMERIC(10, 2),
  wpm INTEGER,
  pause_count INTEGER,
  total_pause_duration NUMERIC(10, 2),
  
  -- Storage reference (audio stored in blob storage, not DB)
  audio_storage_path TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Ensure unique attempt numbers per item per session
  UNIQUE(session_id, item_id, attempt_number)
);

-- Add fluency_locked column to assessment_sessions to track lock state
ALTER TABLE public.assessment_sessions 
ADD COLUMN fluency_locked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN fluency_locked_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient queries
CREATE INDEX idx_fluency_recordings_session ON public.fluency_recordings(session_id);
CREATE INDEX idx_fluency_recordings_user ON public.fluency_recordings(user_id);
CREATE INDEX idx_fluency_recordings_scoring ON public.fluency_recordings(session_id, item_id, used_for_scoring) WHERE used_for_scoring = true;

-- Enable RLS
ALTER TABLE public.fluency_recordings ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own recordings
CREATE POLICY "Users can view own fluency recordings"
ON public.fluency_recordings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fluency recordings"
ON public.fluency_recordings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fluency recordings"
ON public.fluency_recordings
FOR UPDATE
USING (auth.uid() = user_id);

-- Create event logging table for fluency events
CREATE TABLE public.fluency_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'fluency_recording_started',
    'fluency_recording_completed',
    'fluency_redo_clicked',
    'fluency_redo_confirmed',
    'fluency_redo_cancelled',
    'fluency_module_locked'
  )),
  item_id TEXT,
  attempt_number INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient event queries
CREATE INDEX idx_fluency_events_session ON public.fluency_events(session_id);

-- Enable RLS on events
ALTER TABLE public.fluency_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for events
CREATE POLICY "Users can view own fluency events"
ON public.fluency_events
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fluency events"
ON public.fluency_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);
-- Create table for user feedback on archetype results
CREATE TABLE public.archetype_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.assessment_sessions(id),
  feedback_text TEXT NOT NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.archetype_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
ON public.archetype_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
ON public.archetype_feedback
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_archetype_feedback_user ON public.archetype_feedback(user_id);
CREATE INDEX idx_archetype_feedback_session ON public.archetype_feedback(session_id);
-- Create skill_recordings table for confidence, syntax, and conversation modules
CREATE TABLE public.skill_recordings (
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
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add lock columns to assessment_sessions for new modules
ALTER TABLE public.assessment_sessions 
  ADD COLUMN confidence_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN confidence_locked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN syntax_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN syntax_locked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN conversation_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN conversation_locked_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on skill_recordings
ALTER TABLE public.skill_recordings ENABLE ROW LEVEL SECURITY;

-- RLS policies for skill_recordings
CREATE POLICY "Users can insert own skill recordings"
ON public.skill_recordings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own skill recordings"
ON public.skill_recordings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own skill recordings"
ON public.skill_recordings
FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_skill_recordings_session_id ON public.skill_recordings(session_id);
CREATE INDEX idx_skill_recordings_user_id ON public.skill_recordings(user_id);
CREATE INDEX idx_skill_recordings_module_type ON public.skill_recordings(module_type);
-- Create table for confidence questionnaire responses
CREATE TABLE public.confidence_questionnaire_responses (
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

-- Enable RLS
ALTER TABLE public.confidence_questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can insert own questionnaire responses"
ON public.confidence_questionnaire_responses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own questionnaire responses"
ON public.confidence_questionnaire_responses
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own questionnaire responses"
ON public.confidence_questionnaire_responses
FOR UPDATE
USING (auth.uid() = user_id);
-- Add comprehension_locked columns to assessment_sessions
ALTER TABLE public.assessment_sessions 
ADD COLUMN IF NOT EXISTS comprehension_locked boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS comprehension_locked_at timestamp with time zone;

-- Create comprehension_recordings table
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
  completed_at timestamp with time zone
);

-- Enable Row Level Security
ALTER TABLE public.comprehension_recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comprehension_recordings
CREATE POLICY "Users can insert own comprehension recordings" 
ON public.comprehension_recordings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comprehension recordings" 
ON public.comprehension_recordings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own comprehension recordings" 
ON public.comprehension_recordings 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_comprehension_recordings_session 
ON public.comprehension_recordings(session_id);

CREATE INDEX IF NOT EXISTS idx_comprehension_recordings_user 
ON public.comprehension_recordings(user_id);
-- Prompt 1: Systeme.io webhook-gated auth + credits system

-- Table 1: systemeio_webhook_events (stores all incoming webhooks)
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

-- Table 2: app_accounts (email-based access control)
CREATE TABLE IF NOT EXISTS public.app_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  email text NOT NULL UNIQUE,
  access_status text NOT NULL DEFAULT 'inactive',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table 3: credit_wallets (credits for paid tests)
CREATE TABLE IF NOT EXISTS public.credit_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  test_credits_remaining int NOT NULL DEFAULT 0,
  test_credits_lifetime int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table 4: credit_transactions (audit log for credit changes)
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

-- Table 5: systemeio_product_map (maps Systeme.io products to access/credits)
CREATE TABLE IF NOT EXISTS public.systemeio_product_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_price_plan_id text NOT NULL UNIQUE,
  product_key text NOT NULL,
  grants_access boolean NOT NULL DEFAULT false,
  credits_delta int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  note text NULL
);

-- Enable RLS on all tables
ALTER TABLE public.systemeio_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.systemeio_product_map ENABLE ROW LEVEL SECURITY;

-- RLS Policies for app_accounts (users can view their own account via user_id link)
CREATE POLICY "Users can view own app_account"
  ON public.app_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for credit_wallets (users can view their own wallet)
CREATE POLICY "Users can view own credit_wallet"
  ON public.credit_wallets
  FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM public.app_accounts WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for credit_transactions (users can view their own transactions)
CREATE POLICY "Users can view own credit_transactions"
  ON public.credit_transactions
  FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM public.app_accounts WHERE user_id = auth.uid()
    )
  );

-- RLS for systemeio_product_map (only service role can access - no user policies)
-- systemeio_webhook_events has no user access policies (service role only)

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_accounts_email ON public.app_accounts(email);
CREATE INDEX IF NOT EXISTS idx_app_accounts_user_id ON public.app_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_wallets_account_id ON public.credit_wallets(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_account_id ON public.credit_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON public.credit_transactions(account_id, created_at DESC);

-- Trigger to update updated_at on app_accounts
CREATE TRIGGER update_app_accounts_updated_at
  BEFORE UPDATE ON public.app_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger to update updated_at on credit_wallets
CREATE TRIGGER update_credit_wallets_updated_at
  BEFORE UPDATE ON public.credit_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
-- Add RLS policies for systemeio_product_map table (admin management)
CREATE POLICY "Authenticated users can view product map"
ON public.systemeio_product_map
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert product map"
ON public.systemeio_product_map
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update product map"
ON public.systemeio_product_map
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete product map"
ON public.systemeio_product_map
FOR DELETE
TO authenticated
USING (true);
-- Sales Copilot Migration
-- Creates tables for leads, calls, and playbook management

-- Enums for call stages and outcomes
CREATE TYPE public.call_stage AS ENUM (
  'rapport',
  'diagnose',
  'qualify',
  'present',
  'objections',
  'close',
  'next_steps'
);

CREATE TYPE public.call_outcome AS ENUM (
  'won',
  'lost',
  'follow_up',
  'refer_out'
);

-- Sales Leads table
CREATE TABLE public.sales_leads (
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

-- Sales Calls table
CREATE TABLE public.sales_calls (
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

-- Sales Playbook table
CREATE TABLE public.sales_playbook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  playbook_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_sales_leads_email ON public.sales_leads(email);
CREATE INDEX idx_sales_leads_linked_user ON public.sales_leads(linked_user_id);
CREATE INDEX idx_sales_calls_lead ON public.sales_calls(lead_id);
CREATE INDEX idx_sales_playbook_active ON public.sales_playbook(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_playbook ENABLE ROW LEVEL SECURITY;

-- Function to check if user is admin (by email)
CREATE OR REPLACE FUNCTION public.is_admin_user(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check against known admin emails
  -- This should match the ADMIN_EMAILS in src/config/admin.ts
  RETURN user_email IN (
    'tom@solvlanguages.com'
  );
END;
$$;

-- RLS Policies for sales_leads
CREATE POLICY "Admins can view all leads" ON public.sales_leads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

CREATE POLICY "Admins can insert leads" ON public.sales_leads
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

CREATE POLICY "Admins can update leads" ON public.sales_leads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

-- RLS Policies for sales_calls
CREATE POLICY "Admins can view all calls" ON public.sales_calls
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

CREATE POLICY "Admins can insert calls" ON public.sales_calls
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

CREATE POLICY "Admins can update calls" ON public.sales_calls
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

-- RLS Policies for sales_playbook
CREATE POLICY "Admins can view all playbooks" ON public.sales_playbook
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

CREATE POLICY "Admins can insert playbooks" ON public.sales_playbook
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

CREATE POLICY "Admins can update playbooks" ON public.sales_playbook
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

-- Function to auto-link leads to users by email
CREATE OR REPLACE FUNCTION public.auto_link_lead_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.linked_user_id IS NULL THEN
    SELECT id INTO NEW.linked_user_id
    FROM public.profiles
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-link on insert/update
CREATE TRIGGER auto_link_lead_trigger
  BEFORE INSERT OR UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lead_to_user();

-- Trigger for updated_at on sales_leads
CREATE TRIGGER update_sales_leads_updated_at
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger for updated_at on sales_calls
CREATE TRIGGER update_sales_calls_updated_at
  BEFORE UPDATE ON public.sales_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger for updated_at on sales_playbook
CREATE TRIGGER update_sales_playbook_updated_at
  BEFORE UPDATE ON public.sales_playbook
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
-- Fix search_path for auto_link_lead_to_user function
CREATE OR REPLACE FUNCTION public.auto_link_lead_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.linked_user_id IS NULL THEN
    SELECT id INTO NEW.linked_user_id
    FROM public.profiles
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;
-- Sales Copilot Migration
-- Creates tables for leads, calls, and playbook management

-- Enums for call stages and outcomes
CREATE TYPE public.call_stage AS ENUM (
  'rapport',
  'diagnose',
  'qualify',
  'present',
  'objections',
  'close',
  'next_steps'
);

CREATE TYPE public.call_outcome AS ENUM (
  'won',
  'lost',
  'follow_up',
  'refer_out'
);

-- Sales Leads table
CREATE TABLE public.sales_leads (
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

-- Sales Calls table
CREATE TABLE public.sales_calls (
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

-- Sales Playbook table
CREATE TABLE public.sales_playbook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  playbook_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_sales_leads_email ON public.sales_leads(email);
CREATE INDEX idx_sales_leads_linked_user ON public.sales_leads(linked_user_id);
CREATE INDEX idx_sales_calls_lead ON public.sales_calls(lead_id);
CREATE INDEX idx_sales_playbook_active ON public.sales_playbook(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_playbook ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin-only access)
-- Note: We'll use a function to check admin status
-- For now, we'll allow service role and check admin in application layer

-- Function to check if user is admin (by email)
CREATE OR REPLACE FUNCTION public.is_admin_user(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check against known admin emails
  -- This should match the ADMIN_EMAILS in src/config/admin.ts
  RETURN user_email IN (
    'tom@solvlanguages.com'
  );
END;
$$;

-- RLS Policies for sales_leads
CREATE POLICY "Admins can view all leads" ON public.sales_leads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

CREATE POLICY "Admins can insert leads" ON public.sales_leads
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

CREATE POLICY "Admins can update leads" ON public.sales_leads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

-- RLS Policies for sales_calls
CREATE POLICY "Admins can view all calls" ON public.sales_calls
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

CREATE POLICY "Admins can insert calls" ON public.sales_calls
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

CREATE POLICY "Admins can update calls" ON public.sales_calls
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

-- RLS Policies for sales_playbook
CREATE POLICY "Admins can view all playbooks" ON public.sales_playbook
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

CREATE POLICY "Admins can insert playbooks" ON public.sales_playbook
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

CREATE POLICY "Admins can update playbooks" ON public.sales_playbook
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND public.is_admin_user(email)
    )
  );

-- Function to auto-link leads to users by email
CREATE OR REPLACE FUNCTION public.auto_link_lead_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.linked_user_id IS NULL THEN
    SELECT id INTO NEW.linked_user_id
    FROM public.profiles
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-link on insert/update
CREATE TRIGGER auto_link_lead_trigger
  BEFORE INSERT OR UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lead_to_user();

-- Trigger for updated_at on sales_leads
CREATE TRIGGER update_sales_leads_updated_at
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger for updated_at on sales_calls
CREATE TRIGGER update_sales_calls_updated_at
  BEFORE UPDATE ON public.sales_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger for updated_at on sales_playbook
CREATE TRIGGER update_sales_playbook_updated_at
  BEFORE UPDATE ON public.sales_playbook
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();


-- Phrases Learning Ladder Migration
-- Creates tables for phrases, cards, explanations, struggle events, and review logs
-- Implements assist levels, short-term learning steps, and struggle detection

-- Enums for phrase system
CREATE TYPE public.phrase_mode AS ENUM ('recall', 'recognition');
CREATE TYPE public.phrase_status AS ENUM ('active', 'buried', 'suspended', 'removed');
CREATE TYPE public.rating_type AS ENUM ('again', 'hard', 'good', 'easy');
CREATE TYPE public.scheduler_state AS ENUM ('new', 'learning', 'review', 'relearning');

-- Phrases table (canonical phrase content)
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

-- Member phrase cards (per phrase per member)
CREATE TABLE IF NOT EXISTS public.member_phrase_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
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

-- Phrase explanations (cached, global per phrase)
CREATE TABLE IF NOT EXISTS public.phrase_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase_id UUID REFERENCES public.phrases(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  explanation_json JSONB NOT NULL,
  model TEXT, -- e.g., "gpt-4o-mini", "gpt-4.1"
  version INTEGER NOT NULL DEFAULT 1,
  
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phrase struggle events
CREATE TABLE IF NOT EXISTS public.phrase_struggle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  phrase_id UUID REFERENCES public.phrases(id) ON DELETE CASCADE NOT NULL,
  card_id UUID REFERENCES public.member_phrase_cards(id) ON DELETE CASCADE NOT NULL,
  
  trigger TEXT NOT NULL, -- e.g., "again_5_in_24h", "consecutive_5"
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Phrase review logs (append-only analytics)
CREATE TABLE IF NOT EXISTS public.phrase_review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
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

-- Member phrase settings
CREATE TABLE IF NOT EXISTS public.member_phrase_settings (
  member_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_member_phrase_cards_member_id ON public.member_phrase_cards(member_id);
CREATE INDEX IF NOT EXISTS idx_member_phrase_cards_phrase_id ON public.member_phrase_cards(phrase_id);
CREATE INDEX IF NOT EXISTS idx_member_phrase_cards_due_at ON public.member_phrase_cards(due_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_member_phrase_cards_status ON public.member_phrase_cards(status);
CREATE INDEX IF NOT EXISTS idx_phrase_review_logs_member_id ON public.phrase_review_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_phrase_review_logs_card_id ON public.phrase_review_logs(card_id);
CREATE INDEX IF NOT EXISTS idx_phrase_review_logs_rated_at ON public.phrase_review_logs(rated_at);
CREATE INDEX IF NOT EXISTS idx_phrase_struggle_events_member_id ON public.phrase_struggle_events(member_id);
CREATE INDEX IF NOT EXISTS idx_phrase_struggle_events_resolved_at ON public.phrase_struggle_events(resolved_at) WHERE resolved_at IS NULL;

-- Row Level Security Policies

-- Phrases: everyone can read
ALTER TABLE public.phrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Phrases are viewable by everyone"
  ON public.phrases FOR SELECT
  USING (true);

-- Member phrase cards: members see their own
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

-- Phrase struggle events: members see their own, coaches see assigned members
ALTER TABLE public.phrase_struggle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own struggle events"
  ON public.phrase_struggle_events FOR SELECT
  USING (auth.uid() = member_id);

-- TODO: Add coach policy when coach system is implemented
-- For now, coaches would need service role or admin access

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

-- Updated_at triggers
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


-- Speaking Assessment Sessions and Items (Monster Spec Implementation)
-- This migration creates new tables for resumable, deterministic speaking assessment sessions

-- ============================================================================
-- NEW TABLES: assessment_sessions and assessment_items
-- ============================================================================

-- Assessment Sessions table (separate from existing assessment_sessions for speaking checkup)
CREATE TABLE IF NOT EXISTS public.speaking_assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('full', 'single_module')),
  single_module_type TEXT NULL CHECK (single_module_type IS NULL OR single_module_type IN ('pronunciation', 'fluency', 'confidence', 'syntax', 'conversation', 'comprehension')),
  status TEXT NOT NULL CHECK (status IN ('created', 'in_progress', 'completed', 'abandoned')) DEFAULT 'created',
  
  -- Deterministic prompt selection
  seed INTEGER NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT '2026-01-04',
  scorer_version TEXT NOT NULL DEFAULT '2026-01-04',
  asr_version TEXT NOT NULL DEFAULT 'whisper-1',
  
  -- Progress tracking
  current_module TEXT NULL,
  current_item_index INTEGER NOT NULL DEFAULT 0,
  selected_prompt_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Metadata
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assessment Items table (tracks individual items within sessions)
CREATE TABLE IF NOT EXISTS public.speaking_assessment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.speaking_assessment_sessions(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL CHECK (module_type IN ('pronunciation', 'fluency', 'confidence', 'syntax', 'conversation', 'comprehension')),
  item_index INTEGER NOT NULL,
  prompt_id TEXT NOT NULL,
  prompt_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('not_started', 'recording', 'processing', 'completed', 'error')) DEFAULT 'not_started',
  attempt_number INTEGER NOT NULL DEFAULT 1,
  result_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one item per session/module/index
  UNIQUE(session_id, module_type, item_index)
);

-- ============================================================================
-- EXTEND EXISTING RECORDING TABLES
-- ============================================================================

-- Add session/item tracking to fluency_recordings
ALTER TABLE public.fluency_recordings
  ADD COLUMN IF NOT EXISTS speaking_session_id UUID REFERENCES public.speaking_assessment_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS speaking_item_id UUID REFERENCES public.speaking_assessment_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prompt_id TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS scorer_version TEXT,
  ADD COLUMN IF NOT EXISTS asr_version TEXT;

-- Add session/item tracking to skill_recordings
ALTER TABLE public.skill_recordings
  ADD COLUMN IF NOT EXISTS speaking_session_id UUID REFERENCES public.speaking_assessment_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS speaking_item_id UUID REFERENCES public.speaking_assessment_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prompt_id TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS scorer_version TEXT,
  ADD COLUMN IF NOT EXISTS asr_version TEXT;

-- Add session/item tracking to pronunciation_recordings (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pronunciation_recordings') THEN
    ALTER TABLE public.pronunciation_recordings
      ADD COLUMN IF NOT EXISTS speaking_session_id UUID REFERENCES public.speaking_assessment_sessions(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS speaking_item_id UUID REFERENCES public.speaking_assessment_items(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS prompt_id TEXT,
      ADD COLUMN IF NOT EXISTS prompt_version TEXT,
      ADD COLUMN IF NOT EXISTS scorer_version TEXT,
      ADD COLUMN IF NOT EXISTS asr_version TEXT;
  END IF;
END $$;

-- Add session/item tracking to comprehension_recordings
ALTER TABLE public.comprehension_recordings
  ADD COLUMN IF NOT EXISTS speaking_session_id UUID REFERENCES public.speaking_assessment_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS speaking_item_id UUID REFERENCES public.speaking_assessment_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prompt_id TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS scorer_version TEXT,
  ADD COLUMN IF NOT EXISTS asr_version TEXT;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_speaking_sessions_user_status 
  ON public.speaking_assessment_sessions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_speaking_sessions_created 
  ON public.speaking_assessment_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_speaking_items_session_module 
  ON public.speaking_assessment_items(session_id, module_type);

CREATE INDEX IF NOT EXISTS idx_speaking_items_status 
  ON public.speaking_assessment_items(session_id, status);

CREATE INDEX IF NOT EXISTS idx_fluency_recordings_speaking_session 
  ON public.fluency_recordings(speaking_session_id);

CREATE INDEX IF NOT EXISTS idx_skill_recordings_speaking_session 
  ON public.skill_recordings(speaking_session_id);

CREATE INDEX IF NOT EXISTS idx_comprehension_recordings_speaking_session 
  ON public.comprehension_recordings(speaking_session_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.speaking_assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_assessment_items ENABLE ROW LEVEL SECURITY;

-- Speaking assessment sessions policies
CREATE POLICY "Users can view own speaking sessions" 
  ON public.speaking_assessment_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own speaking sessions" 
  ON public.speaking_assessment_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own speaking sessions" 
  ON public.speaking_assessment_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Speaking assessment items policies
CREATE POLICY "Users can view own speaking items" 
  ON public.speaking_assessment_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.speaking_assessment_sessions
      WHERE id = speaking_assessment_items.session_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert speaking items via sessions" 
  ON public.speaking_assessment_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.speaking_assessment_sessions
      WHERE id = speaking_assessment_items.session_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own speaking items" 
  ON public.speaking_assessment_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.speaking_assessment_sessions
      WHERE id = speaking_assessment_items.session_id
      AND user_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_speaking_assessment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_speaking_sessions_updated_at
  BEFORE UPDATE ON public.speaking_assessment_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_speaking_assessment_updated_at();

CREATE TRIGGER update_speaking_items_updated_at
  BEFORE UPDATE ON public.speaking_assessment_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_speaking_assessment_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.speaking_assessment_sessions IS 'Tracks speaking assessment sessions with deterministic prompt selection and resume capability';
COMMENT ON TABLE public.speaking_assessment_items IS 'Individual items within speaking assessment sessions (prompts/questions/pictures)';
COMMENT ON COLUMN public.speaking_assessment_sessions.seed IS 'Random seed for deterministic prompt selection';
COMMENT ON COLUMN public.speaking_assessment_sessions.selected_prompt_ids IS 'Map of module -> array of selected prompt IDs';
COMMENT ON COLUMN public.speaking_assessment_items.result_ref IS 'Reference to result record (table + id)';


-- User Phoneme Statistics Tracking
-- Tracks per-user pronunciation accuracy for each French phoneme

-- ============================================================================
-- USER PHONEME STATS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_phoneme_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phoneme TEXT NOT NULL,
  
  -- Statistics
  attempts INTEGER NOT NULL DEFAULT 0,
  mean_accuracy FLOAT NOT NULL DEFAULT 0, -- 0-100
  confidence FLOAT NOT NULL DEFAULT 0, -- 0-1
  
  -- Tracking
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- One row per user per phoneme
  UNIQUE(user_id, phoneme)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_phoneme_stats_user 
  ON public.user_phoneme_stats(user_id);

CREATE INDEX IF NOT EXISTS idx_user_phoneme_stats_confidence 
  ON public.user_phoneme_stats(user_id, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_user_phoneme_stats_accuracy 
  ON public.user_phoneme_stats(user_id, mean_accuracy ASC);

CREATE INDEX IF NOT EXISTS idx_user_phoneme_stats_attempts 
  ON public.user_phoneme_stats(user_id, attempts ASC);

-- ============================================================================
-- EXTEND PRONUNCIATION RECORDINGS
-- ============================================================================

-- Add phoneme data to pronunciation recordings
ALTER TABLE public.pronunciation_recordings
  ADD COLUMN IF NOT EXISTS phoneme_scores JSONB,
  ADD COLUMN IF NOT EXISTS phoneme_coverage JSONB,
  ADD COLUMN IF NOT EXISTS phrase_id TEXT,
  ADD COLUMN IF NOT EXISTS phrase_ipa TEXT;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.user_phoneme_stats ENABLE ROW LEVEL SECURITY;

-- Users can view their own phoneme stats
CREATE POLICY "Users can view own phoneme stats" 
  ON public.user_phoneme_stats
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own phoneme stats
CREATE POLICY "Users can insert own phoneme stats" 
  ON public.user_phoneme_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own phoneme stats
CREATE POLICY "Users can update own phoneme stats" 
  ON public.user_phoneme_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update phoneme stats (online mean calculation)
CREATE OR REPLACE FUNCTION public.update_user_phoneme_stat(
  p_user_id UUID,
  p_phoneme TEXT,
  p_accuracy FLOAT
)
RETURNS void AS $$
DECLARE
  v_current_attempts INTEGER;
  v_current_mean FLOAT;
  v_new_attempts INTEGER;
  v_new_mean FLOAT;
  v_new_confidence FLOAT;
BEGIN
  -- Get current stats (if exists)
  SELECT attempts, mean_accuracy
  INTO v_current_attempts, v_current_mean
  FROM public.user_phoneme_stats
  WHERE user_id = p_user_id AND phoneme = p_phoneme;

  IF FOUND THEN
    -- Update existing record (online mean)
    v_new_attempts := v_current_attempts + 1;
    v_new_mean := (v_current_mean * v_current_attempts + p_accuracy) / v_new_attempts;
    v_new_confidence := 1 - EXP(-v_new_attempts / 12.0);

    UPDATE public.user_phoneme_stats
    SET 
      attempts = v_new_attempts,
      mean_accuracy = v_new_mean,
      confidence = v_new_confidence,
      last_tested_at = now(),
      updated_at = now()
    WHERE user_id = p_user_id AND phoneme = p_phoneme;
  ELSE
    -- Insert new record
    v_new_confidence := 1 - EXP(-1 / 12.0);

    INSERT INTO public.user_phoneme_stats (
      user_id,
      phoneme,
      attempts,
      mean_accuracy,
      confidence,
      last_tested_at
    ) VALUES (
      p_user_id,
      p_phoneme,
      1,
      p_accuracy,
      v_new_confidence,
      now()
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_user_phoneme_stats_updated_at
  BEFORE UPDATE ON public.user_phoneme_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_speaking_assessment_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.user_phoneme_stats IS 'Tracks per-user pronunciation accuracy for each French phoneme over time';
COMMENT ON COLUMN public.user_phoneme_stats.phoneme IS 'IPA symbol (e.g., /u/, /Ê/, /É›Ìƒ/)';
COMMENT ON COLUMN public.user_phoneme_stats.attempts IS 'Number of times this phoneme has been tested';
COMMENT ON COLUMN public.user_phoneme_stats.mean_accuracy IS 'Average accuracy score 0-100 (online mean)';
COMMENT ON COLUMN public.user_phoneme_stats.confidence IS 'Confidence in the mean (0-1), formula: 1 - exp(-attempts/12)';
COMMENT ON FUNCTION public.update_user_phoneme_stat IS 'Updates phoneme stats using online mean calculation';


-- Add new columns for multi-select comprehension module
ALTER TABLE public.comprehension_recordings
ADD COLUMN IF NOT EXISTS selected_option_ids text[],
ADD COLUMN IF NOT EXISTS correct_option_ids text[],
ADD COLUMN IF NOT EXISTS correct_selections text[],
ADD COLUMN IF NOT EXISTS missed_selections text[],
ADD COLUMN IF NOT EXISTS incorrect_selections text[],
ADD COLUMN IF NOT EXISTS prompt_version text,
ADD COLUMN IF NOT EXISTS scorer_version text,
ADD COLUMN IF NOT EXISTS asr_version text;
-- Scoring Traces Table
-- Stores unified scoring traces for calibration and debugging

CREATE TABLE IF NOT EXISTS scoring_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL CHECK (module_type IN ('fluency', 'syntax', 'conversation', 'confidence', 'pronunciation', 'comprehension')),
  trace_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_scoring_traces_session ON scoring_traces(session_id);
CREATE INDEX idx_scoring_traces_module ON scoring_traces(module_type);
CREATE INDEX idx_scoring_traces_created ON scoring_traces(created_at DESC);

-- Index on JSONB fields for common queries
CREATE INDEX idx_scoring_traces_scenario_id ON scoring_traces((trace_data->'meta'->>'scenario_id'));
CREATE INDEX idx_scoring_traces_persona_id ON scoring_traces((trace_data->'meta'->>'persona_id'));

-- RLS Policies
ALTER TABLE scoring_traces ENABLE ROW LEVEL SECURITY;

-- Users can read their own traces
CREATE POLICY "Users can read own scoring traces"
  ON scoring_traces
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM assessment_sessions WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own traces
CREATE POLICY "Users can insert own scoring traces"
  ON scoring_traces
  FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM assessment_sessions WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to scoring traces"
  ON scoring_traces
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_scoring_traces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scoring_traces_updated_at
  BEFORE UPDATE ON scoring_traces
  FOR EACH ROW
  EXECUTE FUNCTION update_scoring_traces_updated_at();

-- Comments for documentation
COMMENT ON TABLE scoring_traces IS 'Unified scoring traces for all assessment modules, storing detailed turn-by-turn data, metrics, and debug information';
COMMENT ON COLUMN scoring_traces.trace_data IS 'JSONB containing the complete ScoringTrace object with turns, scores, repair events, and debug flags';
COMMENT ON COLUMN scoring_traces.module_type IS 'Primary module type for this trace (fluency, syntax, conversation, confidence, pronunciation, comprehension)';
-- Migration: Confidence Phone Call System
-- Adds tables for phone-call style confidence assessment with turn-by-turn tracking

-- Store phone call scenario attempts
CREATE TABLE IF NOT EXISTS confidence_phone_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_id TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX idx_confidence_phone_calls_session ON confidence_phone_calls(session_id);
CREATE INDEX idx_confidence_phone_calls_user ON confidence_phone_calls(user_id);
CREATE INDEX idx_confidence_phone_calls_scenario ON confidence_phone_calls(scenario_id);

-- Store per-turn recordings with timing
CREATE TABLE IF NOT EXISTS confidence_phone_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES confidence_phone_calls(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  prompt_end_ts TIMESTAMPTZ NOT NULL, -- When bot finished speaking
  user_speech_start_ts TIMESTAMPTZ, -- When user started speaking (recording start + first word)
  user_speech_end_ts TIMESTAMPTZ, -- When user finished speaking (recording end)
  recording_start_ts TIMESTAMPTZ NOT NULL, -- Actual recording start time
  recording_end_ts TIMESTAMPTZ NOT NULL, -- Actual recording end time
  transcript TEXT,
  word_timestamps JSONB, -- Whisper word-level data: [{word: "hello", start: 0.1, end: 0.5}, ...]
  metrics JSONB, -- Turn-level metrics: {start_latency_ms, speech_ms, silence_ms, speech_ratio, longest_silence_ms, silence_count, pauses}
  audio_blob_url TEXT, -- Optional: URL to stored audio blob
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(call_id, turn_number)
);

-- Add index for turn retrieval
CREATE INDEX idx_confidence_phone_turns_call ON confidence_phone_turns(call_id);

-- Store final analysis results
CREATE TABLE IF NOT EXISTS confidence_speaking_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES confidence_phone_calls(id) ON DELETE CASCADE UNIQUE,
  -- D1-D5 scores (0-5)
  d1_score INTEGER CHECK (d1_score >= 0 AND d1_score <= 5),
  d2_score INTEGER CHECK (d2_score >= 0 AND d2_score <= 5),
  d3_score INTEGER CHECK (d3_score >= 0 AND d3_score <= 5),
  d4_score INTEGER CHECK (d4_score >= 0 AND d4_score <= 5),
  d5_score INTEGER CHECK (d5_score >= 0 AND d5_score <= 5),
  -- Overall score (0-100)
  speaking_confidence_score INTEGER CHECK (speaking_confidence_score >= 0 AND speaking_confidence_score <= 100),
  -- Aggregate timing metrics
  timing_aggregates JSONB, -- {start_latency_ms_median, speech_ratio_avg, longest_silence_ms, etc.}
  -- Detected confidence signals with evidence
  signals JSONB, -- {ownership_markers: [{phrase, snippet, turn}], low_confidence_markers: [...], ...}
  -- Strengths (2-3 items)
  strengths JSONB, -- [{dimension: "D2", label: "You kept speaking with limited long silences."}]
  -- Focus areas (1-2 items)
  focus_areas JSONB, -- [{dimension: "D3", label: "Make one clear request earlier.", micro_drill: "..."}]
  -- Micro-drills
  micro_drills JSONB, -- [{dimension: "D1", title: "Instant Opener", instruction: "...", duration: "20-30s", example: "..."}]
  -- Learner message (optional summary)
  learner_message TEXT,
  -- Version tracking
  versions JSONB, -- {prompt_version, scorer_version, asr_version}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for analysis retrieval
CREATE INDEX idx_confidence_speaking_analysis_call ON confidence_speaking_analysis(call_id);

-- Enable Row Level Security
ALTER TABLE confidence_phone_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_phone_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_speaking_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data

-- confidence_phone_calls policies
CREATE POLICY "Users can view own phone calls"
  ON confidence_phone_calls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own phone calls"
  ON confidence_phone_calls FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own phone calls"
  ON confidence_phone_calls FOR UPDATE
  USING (auth.uid() = user_id);

-- confidence_phone_turns policies
CREATE POLICY "Users can view own turns"
  ON confidence_phone_turns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM confidence_phone_calls
      WHERE confidence_phone_calls.id = confidence_phone_turns.call_id
      AND confidence_phone_calls.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own turns"
  ON confidence_phone_turns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM confidence_phone_calls
      WHERE confidence_phone_calls.id = confidence_phone_turns.call_id
      AND confidence_phone_calls.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own turns"
  ON confidence_phone_turns FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM confidence_phone_calls
      WHERE confidence_phone_calls.id = confidence_phone_turns.call_id
      AND confidence_phone_calls.user_id = auth.uid()
    )
  );

-- confidence_speaking_analysis policies
CREATE POLICY "Users can view own analysis"
  ON confidence_speaking_analysis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM confidence_phone_calls
      WHERE confidence_phone_calls.id = confidence_speaking_analysis.call_id
      AND confidence_phone_calls.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert analysis"
  ON confidence_speaking_analysis FOR INSERT
  WITH CHECK (true); -- Service role can insert

CREATE POLICY "Users can view their analysis"
  ON confidence_speaking_analysis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM confidence_phone_calls
      WHERE confidence_phone_calls.id = confidence_speaking_analysis.call_id
      AND confidence_phone_calls.user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE confidence_phone_calls IS 'Phone call scenario attempts for confidence assessment';
COMMENT ON TABLE confidence_phone_turns IS 'Individual turn recordings with timing data';
COMMENT ON TABLE confidence_speaking_analysis IS 'Final D1-D5 analysis results with drills and feedback';


-- Add multi-select columns to comprehension_recordings table
-- This migration extends the table to support the new multi-select comprehension exercise format

ALTER TABLE public.comprehension_recordings
  ADD COLUMN IF NOT EXISTS selected_option_ids TEXT[], -- User selections
  ADD COLUMN IF NOT EXISTS correct_option_ids TEXT[], -- Answer key
  ADD COLUMN IF NOT EXISTS correct_selections TEXT[], -- What they got right
  ADD COLUMN IF NOT EXISTS missed_selections TEXT[], -- What they missed
  ADD COLUMN IF NOT EXISTS incorrect_selections TEXT[]; -- Wrong selections

-- Add comment for documentation
COMMENT ON COLUMN public.comprehension_recordings.selected_option_ids IS 'Array of option IDs selected by the user (multi-select format)';
COMMENT ON COLUMN public.comprehension_recordings.correct_option_ids IS 'Array of correct option IDs from answer key';
COMMENT ON COLUMN public.comprehension_recordings.correct_selections IS 'Array of correctly selected option IDs';
COMMENT ON COLUMN public.comprehension_recordings.missed_selections IS 'Array of correct options that were not selected';
COMMENT ON COLUMN public.comprehension_recordings.incorrect_selections IS 'Array of incorrectly selected option IDs';


-- Scoring Traces Table
-- Stores unified scoring traces for calibration and debugging

CREATE TABLE IF NOT EXISTS scoring_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL CHECK (module_type IN ('fluency', 'syntax', 'conversation', 'confidence', 'pronunciation', 'comprehension')),
  trace_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_scoring_traces_session ON scoring_traces(session_id);
CREATE INDEX idx_scoring_traces_module ON scoring_traces(module_type);
CREATE INDEX idx_scoring_traces_created ON scoring_traces(created_at DESC);

-- Index on JSONB fields for common queries
CREATE INDEX idx_scoring_traces_scenario_id ON scoring_traces((trace_data->'meta'->>'scenario_id'));
CREATE INDEX idx_scoring_traces_persona_id ON scoring_traces((trace_data->'meta'->>'persona_id'));

-- RLS Policies
ALTER TABLE scoring_traces ENABLE ROW LEVEL SECURITY;

-- Users can read their own traces
CREATE POLICY "Users can read own scoring traces"
  ON scoring_traces
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM assessment_sessions WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own traces
CREATE POLICY "Users can insert own scoring traces"
  ON scoring_traces
  FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM assessment_sessions WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to scoring traces"
  ON scoring_traces
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_scoring_traces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scoring_traces_updated_at
  BEFORE UPDATE ON scoring_traces
  FOR EACH ROW
  EXECUTE FUNCTION update_scoring_traces_updated_at();

-- Comments for documentation
COMMENT ON TABLE scoring_traces IS 'Unified scoring traces for all assessment modules, storing detailed turn-by-turn data, metrics, and debug information';
COMMENT ON COLUMN scoring_traces.trace_data IS 'JSONB containing the complete ScoringTrace object with turns, scores, repair events, and debug flags';
COMMENT ON COLUMN scoring_traces.module_type IS 'Primary module type for this trace (fluency, syntax, conversation, confidence, pronunciation, comprehension)';


-- Create comprehension_items table
CREATE TABLE IF NOT EXISTS public.comprehension_items (
  id TEXT PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'fr-FR',
  cefr_level TEXT NOT NULL,
  transcript_fr TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  estimated_duration_s NUMERIC NOT NULL,
  prompt JSONB NOT NULL,
  options JSONB NOT NULL,
  answer_key JSONB NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comprehension_items_cefr ON public.comprehension_items(cefr_level);
CREATE INDEX IF NOT EXISTS idx_comprehension_items_language ON public.comprehension_items(language);

-- Enable RLS
ALTER TABLE public.comprehension_items ENABLE ROW LEVEL SECURITY;

-- Public read access (items are reference data)
CREATE POLICY "Anyone can read comprehension items"
  ON public.comprehension_items
  FOR SELECT
  USING (true);

-- Only admins can modify (via service role or admin check)
CREATE POLICY "Admins can insert comprehension items"
  ON public.comprehension_items
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND is_admin_user(profiles.email)
  ));

CREATE POLICY "Admins can update comprehension items"
  ON public.comprehension_items
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND is_admin_user(profiles.email)
  ));

CREATE POLICY "Admins can delete comprehension items"
  ON public.comprehension_items
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND is_admin_user(profiles.email)
  ));

-- Add updated_at trigger
CREATE TRIGGER update_comprehension_items_updated_at
  BEFORE UPDATE ON public.comprehension_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Insert all 12 comprehension items
INSERT INTO public.comprehension_items (id, language, cefr_level, transcript_fr, word_count, estimated_duration_s, prompt, options, answer_key) VALUES
('lc_fr_a1_0001', 'fr-FR', 'A1', 'Il pleut fort. Marie cherche vite son parapluie, mais il est dans la voiture.', 14, 5.6,
  '{"fr": "Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.", "en": "What is going on? Select all statements that are true. There may be more than one."}'::jsonb,
  '[{"id": "o1", "fr": "Il pleut fort.", "en": "It is raining hard."}, {"id": "o2", "fr": "Marie cherche son parapluie.", "en": "Marie is looking for her umbrella."}, {"id": "o3", "fr": "Le parapluie est dans la voiture.", "en": "The umbrella is in the car."}, {"id": "o4", "fr": "Marie a oubliÃ© son parapluie au travail.", "en": "Marie forgot her umbrella at work."}, {"id": "o5", "fr": "Marie cherche ses clÃ©s.", "en": "Marie is looking for her keys."}, {"id": "o6", "fr": "Il fait trÃ¨s beau aujourd''hui.", "en": "The weather is very sunny today."}, {"id": "o7", "fr": "Le parapluie est cassÃ©.", "en": "The umbrella is broken."}, {"id": "o8", "fr": "Marie va Ã  la plage.", "en": "Marie is going to the beach."}]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3"]}'::jsonb),

('lc_fr_a1_0002', 'fr-FR', 'A1', 'Au cafÃ©, Paul commande un thÃ© sans sucre, attend deux minutes, puis demande l''addition et son ticket avant de partir.', 20, 8.0,
  '{"fr": "Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.", "en": "What is going on? Select all statements that are true. There may be more than one."}'::jsonb,
  '[{"id": "o1", "fr": "Paul commande un thÃ© sans sucre.", "en": "Paul orders a tea with no sugar."}, {"id": "o2", "fr": "Il attend deux minutes.", "en": "He waits two minutes."}, {"id": "o3", "fr": "Il demande l''addition et le ticket.", "en": "He asks for the bill and the receipt."}, {"id": "o4", "fr": "Paul commande un cafÃ© au lait.", "en": "Paul orders a coffee with milk."}, {"id": "o5", "fr": "Il demande la carte des desserts.", "en": "He asks for the dessert menu."}, {"id": "o6", "fr": "Il reste au cafÃ© pendant une heure.", "en": "He stays at the cafe for an hour."}, {"id": "o7", "fr": "Il part sans payer.", "en": "He leaves without paying."}, {"id": "o8", "fr": "Il demande seulement un verre d''eau.", "en": "He only asks for a glass of water."}]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3"]}'::jsonb),

('lc_fr_a2_0003', 'fr-FR', 'A2', 'Dans le bus, quelqu''un a oubliÃ© un sac bleu sous un siÃ¨ge. Le chauffeur l''annonce au micro, le met devant lui, et dit de le rÃ©cupÃ©rer au terminus.', 28, 11.2,
  '{"fr": "Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.", "en": "What is going on? Select all statements that are true. There may be more than one."}'::jsonb,
  '[{"id": "o1", "fr": "Quelqu''un a oubliÃ© un sac bleu.", "en": "Someone forgot a blue bag."}, {"id": "o2", "fr": "Le chauffeur l''annonce au micro.", "en": "The driver announces it over the speaker."}, {"id": "o3", "fr": "Le chauffeur garde le sac devant lui.", "en": "The driver keeps the bag at the front."}, {"id": "o4", "fr": "On peut rÃ©cupÃ©rer le sac au terminus.", "en": "You can pick up the bag at the end of the line."}, {"id": "o5", "fr": "Le sac est rouge.", "en": "The bag is red."}, {"id": "o6", "fr": "Le chauffeur jette le sac.", "en": "The driver throws the bag away."}, {"id": "o7", "fr": "Il faut aller au commissariat pour le rÃ©cupÃ©rer.", "en": "You must go to the police station to retrieve it."}, {"id": "o8", "fr": "Le bus s''arrÃªte tout de suite pour chercher le propriÃ©taire.", "en": "The bus stops immediately to find the owner."}]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb),

('lc_fr_a2_0004', 'fr-FR', 'A2', 'On se retrouve Ã  la station RÃ©publique Ã  18 h, prÃ¨s de la sortie 3. DÃ©solÃ©, mon bus est bloquÃ© dans les embouteillages, je serai dix minutes en retard. Ne pars pas.', 32, 12.8,
  '{"fr": "Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.", "en": "What is going on? Select all statements that are true. There may be more than one."}'::jsonb,
  '[{"id": "o1", "fr": "Le rendez-vous est Ã  la station RÃ©publique.", "en": "The meeting point is RÃ©publique station."}, {"id": "o2", "fr": "Le rendez-vous est Ã  18 h.", "en": "The meeting is at 6 pm."}, {"id": "o3", "fr": "La personne aura environ dix minutes de retard.", "en": "The person will be about ten minutes late."}, {"id": "o4", "fr": "Son bus est bloquÃ© dans les embouteillages.", "en": "Their bus is stuck in traffic."}, {"id": "o5", "fr": "Le rendez-vous est Ã  8 h.", "en": "The meeting is at 8 am."}, {"id": "o6", "fr": "Ils se retrouvent Ã  la station Bastille.", "en": "They are meeting at Bastille station."}, {"id": "o7", "fr": "La personne est dÃ©jÃ  arrivÃ©e.", "en": "The person has already arrived."}, {"id": "o8", "fr": "On lui dit de ne pas attendre.", "en": "They tell the other person not to wait."}]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb),

('lc_fr_a2_0005', 'fr-FR', 'A2', 'Une voisine crie dans la rue : son chat est coincÃ© dans un arbre depuis une heure. Elle veut appeler les pompiers, mais elle ne connaÃ®t pas le numÃ©ro et son tÃ©lÃ©phone est presque dÃ©chargÃ©. Elle demande Ã  un passant de l''aider.', 42, 16.8,
  '{"fr": "Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.", "en": "What is going on? Select all statements that are true. There may be more than one."}'::jsonb,
  '[{"id": "o1", "fr": "Un chat est coincÃ© dans un arbre.", "en": "A cat is stuck in a tree."}, {"id": "o2", "fr": "Elle veut appeler les pompiers.", "en": "She wants to call the fire department."}, {"id": "o3", "fr": "Elle ne connaÃ®t pas le numÃ©ro Ã  appeler.", "en": "She doesn''t know the number to call."}, {"id": "o4", "fr": "Son tÃ©lÃ©phone est presque dÃ©chargÃ©.", "en": "Her phone is almost out of battery."}, {"id": "o5", "fr": "Un chien est coincÃ© dans un arbre.", "en": "A dog is stuck in a tree."}, {"id": "o6", "fr": "Les pompiers sont dÃ©jÃ  en route.", "en": "The fire department is already on the way."}, {"id": "o7", "fr": "Elle veut appeler la police pour un vol.", "en": "She wants to call the police about a theft."}, {"id": "o8", "fr": "Elle cherche un taxi.", "en": "She is looking for a taxi."}]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb),

('lc_fr_a2_0006', 'fr-FR', 'A2', 'On dÃ©cale la rÃ©union de cet aprÃ¨s-midi Ã  demain matin, Ã  9 h, parce que le client est malade. J''envoie tout de suite un e-mail avec la nouvelle heure et le lien visio. Garde ton aprÃ¨s-midi libre.', 37, 14.8,
  '{"fr": "Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.", "en": "What is going on? Select all statements that are true. There may be more than one."}'::jsonb,
  '[{"id": "o1", "fr": "La rÃ©union est dÃ©placÃ©e Ã  demain matin, Ã  9 h.", "en": "The meeting is moved to tomorrow morning at 9."}, {"id": "o2", "fr": "Le client est malade.", "en": "The client is sick."}, {"id": "o3", "fr": "Un e-mail va confirmer la nouvelle heure.", "en": "An email will confirm the new time."}, {"id": "o4", "fr": "Le lien visio est envoyÃ© par e-mail.", "en": "The video-call link is sent by email."}, {"id": "o5", "fr": "La rÃ©union reste cet aprÃ¨s-midi.", "en": "The meeting stays this afternoon."}, {"id": "o6", "fr": "La rÃ©union est annulÃ©e dÃ©finitivement.", "en": "The meeting is canceled forever."}, {"id": "o7", "fr": "Le client est en vacances.", "en": "The client is on vacation."}, {"id": "o8", "fr": "La rÃ©union est dÃ©placÃ©e Ã  ce soir.", "en": "The meeting is moved to tonight."}]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb),

('lc_fr_b1_0007', 'fr-FR', 'B1', 'Annonce en gare : le train pour Lyon de 17 h 12 est annulÃ© Ã  cause d''un problÃ¨me technique. Un bus de remplacement part du quai 5 dans vingt minutes. Pour un remboursement, allez au guichet avec votre billet. Les autres trains restent Ã  l''heure.', 45, 18.0,
  '{"fr": "Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.", "en": "What is going on? Select all statements that are true. There may be more than one."}'::jsonb,
  '[{"id": "o1", "fr": "Le train pour Lyon de 17 h 12 est annulÃ©.", "en": "The 5:12 pm train to Lyon is canceled."}, {"id": "o2", "fr": "C''est Ã  cause d''un problÃ¨me technique.", "en": "It is due to a technical problem."}, {"id": "o3", "fr": "Un bus de remplacement part du quai 5.", "en": "A replacement bus leaves from platform 5."}, {"id": "o4", "fr": "On peut demander un remboursement au guichet.", "en": "You can request a refund at the ticket office."}, {"id": "o5", "fr": "Le train a seulement dix minutes de retard.", "en": "The train is only ten minutes late."}, {"id": "o6", "fr": "Le bus part du quai 2.", "en": "The bus leaves from platform 2."}, {"id": "o7", "fr": "Le remboursement se fait uniquement en ligne.", "en": "Refunds are online only."}, {"id": "o8", "fr": "Tous les trains sont annulÃ©s aujourd''hui.", "en": "All trains are canceled today."}]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb),

('lc_fr_b1_0008', 'fr-FR', 'B1', 'Dans la colocation, ils se disputent la facture d''Ã©lectricitÃ© : l''un dit qu''il ne cuisine jamais, l''autre laisse la lumiÃ¨re allumÃ©e. AprÃ¨s quelques minutes, ils se calment et dÃ©cident de suivre leur consommation avec une appli pendant un mois, Ã  partir d''aujourd''hui, puis de partager la facture selon l''usage rÃ©el.', 50, 20.0,
  '{"fr": "Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.", "en": "What is going on? Select all statements that are true. There may be more than one."}'::jsonb,
  '[{"id": "o1", "fr": "Ils se disputent la facture d''Ã©lectricitÃ©.", "en": "They argue about the electricity bill."}, {"id": "o2", "fr": "Ils dÃ©cident de suivre leur consommation avec une appli.", "en": "They decide to track their usage with an app."}, {"id": "o3", "fr": "Ils le font pendant un mois.", "en": "They do it for one month."}, {"id": "o4", "fr": "Ils partageront la facture selon l''usage rÃ©el.", "en": "They will split the bill based on actual usage."}, {"id": "o5", "fr": "Ils se disputent la facture d''eau.", "en": "They argue about the water bill."}, {"id": "o6", "fr": "Ils dÃ©cident de ne plus payer la facture.", "en": "They decide to stop paying the bill."}, {"id": "o7", "fr": "Ils partagent forcÃ©ment 50/50.", "en": "They will definitely split it 50/50."}, {"id": "o8", "fr": "Ils achÃ¨tent un nouveau frigo.", "en": "They buy a new fridge."}]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb),

('lc_fr_a2_0009', 'fr-FR', 'A2', 'Au restaurant, elle prÃ©cise qu''elle est allergique aux noix. Le serveur part vÃ©rifier en cuisine si la sauce contient des amandes. Il revient : il y en a. Elle change de plat et prend une salade sans sauce.', 38, 15.2,
  '{"fr": "Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.", "en": "What is going on? Select all statements that are true. There may be more than one."}'::jsonb,
  '[{"id": "o1", "fr": "Elle est allergique aux noix.", "en": "She is allergic to nuts."}, {"id": "o2", "fr": "Le serveur vÃ©rifie la sauce en cuisine.", "en": "The waiter checks the sauce in the kitchen."}, {"id": "o3", "fr": "La sauce contient des amandes.", "en": "The sauce contains almonds."}, {"id": "o4", "fr": "Elle choisit une salade sans sauce.", "en": "She chooses a salad with no sauce."}, {"id": "o5", "fr": "Elle est allergique au gluten.", "en": "She is allergic to gluten."}, {"id": "o6", "fr": "La sauce ne contient aucune amande.", "en": "The sauce contains no almonds."}, {"id": "o7", "fr": "Elle garde le mÃªme plat.", "en": "She keeps the same dish."}, {"id": "o8", "fr": "Elle commande un dessert aux noix.", "en": "She orders a dessert with nuts."}]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb),

('lc_fr_b1_0010', 'fr-FR', 'B1', 'Le recruteur propose un entretien lundi Ã  11 h pour un poste de chef de projet. Le candidat demande si c''est 100 % Ã  distance ; on lui rÃ©pond : hybride, trois jours au bureau. Il demande la fourchette de salaire. Ils fixent un second appel mercredi avec la RH.', 50, 20.0,
  '{"fr": "Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.", "en": "What is going on? Select all statements that are true. There may be more than one."}'::jsonb,
  '[{"id": "o1", "fr": "Un entretien est proposÃ© lundi Ã  11 h.", "en": "An interview is proposed for Monday at 11."}, {"id": "o2", "fr": "On lui rÃ©pond : hybride, trois jours au bureau.", "en": "They answer: hybrid, three days in the office."}, {"id": "o3", "fr": "Le candidat demande la fourchette de salaire.", "en": "The candidate asks for the salary range."}, {"id": "o4", "fr": "Ils fixent un second appel mercredi avec la RH.", "en": "They schedule a second call on Wednesday with HR."}, {"id": "o5", "fr": "On lui rÃ©pond : c''est totalement Ã  distance.", "en": "They answer: it is fully remote."}, {"id": "o6", "fr": "L''entretien est prÃ©vu dimanche matin.", "en": "The interview is set for Sunday morning."}, {"id": "o7", "fr": "Ils discutent d''un poste de serveur au restaurant.", "en": "They discuss a waiter job at a restaurant."}, {"id": "o8", "fr": "Le recruteur annule et ne rappelle pas.", "en": "The recruiter cancels and never calls back."}]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb),

('lc_fr_b2_0011', 'fr-FR', 'B2', 'Au magasin, LÃ©a revient avec un casque audio qui grÃ©sille. Elle veut Ãªtre remboursÃ©e, mais elle a perdu le ticket de caisse. Le vendeur propose un Ã©change ou un avoir. Elle insiste pour un remboursement sur sa carte, alors il appelle la responsable.', 43, 17.2,
  '{"fr": "Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.", "en": "What is going on? Select all statements that are true. There may be more than one."}'::jsonb,
  '[{"id": "o1", "fr": "Le casque audio grÃ©sille.", "en": "The headphones crackle."}, {"id": "o2", "fr": "LÃ©a a perdu le ticket de caisse.", "en": "LÃ©a lost the receipt."}, {"id": "o3", "fr": "Le vendeur propose un Ã©change ou un avoir.", "en": "The seller offers an exchange or store credit."}, {"id": "o4", "fr": "Le vendeur appelle la responsable.", "en": "The seller calls the manager."}, {"id": "o5", "fr": "LÃ©a a le ticket de caisse.", "en": "LÃ©a has the receipt."}, {"id": "o6", "fr": "Le casque fonctionne parfaitement.", "en": "The headphones work perfectly."}, {"id": "o7", "fr": "Le vendeur lui rend l''argent tout de suite, sans question.", "en": "The seller refunds her immediately, no questions asked."}, {"id": "o8", "fr": "Elle vient juste comparer des prix.", "en": "She only came to compare prices."}]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb),

('lc_fr_b2_0012', 'fr-FR', 'B2', 'Lors d''une rÃ©union de quartier, on propose de fermer la rue aux voitures le week-end. Certains commerÃ§ants sont pour, d''autres craignent de perdre des clients. La mairie propose un essai d''un mois et un vote ensuite. Un habitant rappelle qu''il faut garder un accÃ¨s pour les ambulances.', 47, 18.8,
  '{"fr": "Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.", "en": "What is going on? Select all statements that are true. There may be more than one."}'::jsonb,
  '[{"id": "o1", "fr": "On propose de fermer la rue aux voitures le week-end.", "en": "They propose closing the street to cars on weekends."}, {"id": "o2", "fr": "Certains commerÃ§ants sont pour, d''autres sont inquiets.", "en": "Some shop owners support it; others are worried."}, {"id": "o3", "fr": "La mairie propose un essai d''un mois, puis un vote.", "en": "City hall proposes a one-month trial, then a vote."}, {"id": "o4", "fr": "Il faut garder un accÃ¨s pour les ambulances.", "en": "They must keep access for ambulances."}, {"id": "o5", "fr": "La rue sera fermÃ©e tous les jours, toute l''annÃ©e.", "en": "The street will be closed every day all year."}, {"id": "o6", "fr": "Tout le monde est d''accord immÃ©diatement.", "en": "Everyone agrees immediately."}, {"id": "o7", "fr": "La mairie abandonne l''idÃ©e dÃ¨s maintenant.", "en": "City hall drops the idea right away."}, {"id": "o8", "fr": "On veut empÃªcher les ambulances de passer.", "en": "They want to block ambulances from passing."}]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  transcript_fr = EXCLUDED.transcript_fr,
  word_count = EXCLUDED.word_count,
  estimated_duration_s = EXCLUDED.estimated_duration_s,
  prompt = EXCLUDED.prompt,
  options = EXCLUDED.options,
  answer_key = EXCLUDED.answer_key,
  updated_at = now();
-- Allow public/anonymous uploads for comprehension-audio bucket (for script use)
CREATE POLICY "Allow uploads to comprehension-audio"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'comprehension-audio');
-- Comprehension items table
CREATE TABLE IF NOT EXISTS public.comprehension_items (
  id TEXT PRIMARY KEY, -- e.g., "lc_fr_a1_0001"
  language TEXT NOT NULL DEFAULT 'fr-FR',
  cefr_level TEXT NOT NULL CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  transcript_fr TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  estimated_duration_s NUMERIC NOT NULL,
  prompt_fr TEXT NOT NULL,
  prompt_en TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of {id, fr, en}
  answer_key JSONB NOT NULL, -- {correct_option_ids: string[]}
  audio_url TEXT, -- Public URL to WAV file in storage
  audio_storage_path TEXT, -- Storage path for the audio file
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for filtering by audio availability
CREATE INDEX IF NOT EXISTS idx_comprehension_items_has_audio 
ON public.comprehension_items(audio_url) 
WHERE audio_url IS NOT NULL;

-- Index for CEFR level filtering
CREATE INDEX IF NOT EXISTS idx_comprehension_items_cefr 
ON public.comprehension_items(cefr_level);

-- Enable RLS
ALTER TABLE public.comprehension_items ENABLE ROW LEVEL SECURITY;

-- Public read access (items are not user-specific)
CREATE POLICY "Anyone can read comprehension items" 
ON public.comprehension_items 
FOR SELECT 
USING (true);


-- Seed comprehension items from TypeScript file
INSERT INTO public.comprehension_items (
  id, language, cefr_level, transcript_fr, word_count, estimated_duration_s,
  prompt_fr, prompt_en, options, answer_key
) VALUES
(
  'lc_fr_a1_0001',
  'fr-FR',
  'A1',
  'Il pleut fort. Marie cherche vite son parapluie, mais il est dans la voiture.',
  14,
  5.6,
  'Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.',
  'What is going on? Select all statements that are true. There may be more than one.',
  '[
    {"id": "o1", "fr": "Il pleut fort.", "en": "It is raining hard."},
    {"id": "o2", "fr": "Marie cherche son parapluie.", "en": "Marie is looking for her umbrella."},
    {"id": "o3", "fr": "Le parapluie est dans la voiture.", "en": "The umbrella is in the car."},
    {"id": "o4", "fr": "Marie a oubliÃ© son parapluie au travail.", "en": "Marie forgot her umbrella at work."},
    {"id": "o5", "fr": "Marie cherche ses clÃ©s.", "en": "Marie is looking for her keys."},
    {"id": "o6", "fr": "Il fait trÃ¨s beau aujourd''hui.", "en": "The weather is very sunny today."},
    {"id": "o7", "fr": "Le parapluie est cassÃ©.", "en": "The umbrella is broken."},
    {"id": "o8", "fr": "Marie va Ã  la plage.", "en": "Marie is going to the beach."}
  ]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3"]}'::jsonb
),
(
  'lc_fr_a1_0002',
  'fr-FR',
  'A1',
  'Au cafÃ©, Paul commande un thÃ© sans sucre, attend deux minutes, puis demande l''addition et son ticket avant de partir.',
  20,
  8.0,
  'Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.',
  'What is going on? Select all statements that are true. There may be more than one.',
  '[
    {"id": "o1", "fr": "Paul commande un thÃ© sans sucre.", "en": "Paul orders a tea with no sugar."},
    {"id": "o2", "fr": "Il attend deux minutes.", "en": "He waits two minutes."},
    {"id": "o3", "fr": "Il demande l''addition et le ticket.", "en": "He asks for the bill and the receipt."},
    {"id": "o4", "fr": "Paul commande un cafÃ© au lait.", "en": "Paul orders a coffee with milk."},
    {"id": "o5", "fr": "Il demande la carte des desserts.", "en": "He asks for the dessert menu."},
    {"id": "o6", "fr": "Il reste au cafÃ© pendant une heure.", "en": "He stays at the cafe for an hour."},
    {"id": "o7", "fr": "Il part sans payer.", "en": "He leaves without paying."},
    {"id": "o8", "fr": "Il demande seulement un verre d''eau.", "en": "He only asks for a glass of water."}
  ]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3"]}'::jsonb
),
(
  'lc_fr_a2_0003',
  'fr-FR',
  'A2',
  'Dans le bus, quelqu''un a oubliÃ© un sac bleu sous un siÃ¨ge. Le chauffeur l''annonce au micro, le met devant lui, et dit de le rÃ©cupÃ©rer au terminus.',
  28,
  11.2,
  'Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.',
  'What is going on? Select all statements that are true. There may be more than one.',
  '[
    {"id": "o1", "fr": "Quelqu''un a oubliÃ© un sac bleu.", "en": "Someone forgot a blue bag."},
    {"id": "o2", "fr": "Le chauffeur l''annonce au micro.", "en": "The driver announces it over the speaker."},
    {"id": "o3", "fr": "Le chauffeur garde le sac devant lui.", "en": "The driver keeps the bag at the front."},
    {"id": "o4", "fr": "On peut rÃ©cupÃ©rer le sac au terminus.", "en": "You can pick up the bag at the end of the line."},
    {"id": "o5", "fr": "Le sac est rouge.", "en": "The bag is red."},
    {"id": "o6", "fr": "Le chauffeur jette le sac.", "en": "The driver throws the bag away."},
    {"id": "o7", "fr": "Il faut aller au commissariat pour le rÃ©cupÃ©rer.", "en": "You must go to the police station to retrieve it."},
    {"id": "o8", "fr": "Le bus s''arrÃªte tout de suite pour chercher le propriÃ©taire.", "en": "The bus stops immediately to find the owner."}
  ]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb
),
(
  'lc_fr_a2_0004',
  'fr-FR',
  'A2',
  'On se retrouve Ã  la station RÃ©publique Ã  18 h, prÃ¨s de la sortie 3. DÃ©solÃ©, mon bus est bloquÃ© dans les embouteillages, je serai dix minutes en retard. Ne pars pas.',
  32,
  12.8,
  'Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.',
  'What is going on? Select all statements that are true. There may be more than one.',
  '[
    {"id": "o1", "fr": "Le rendez-vous est Ã  la station RÃ©publique.", "en": "The meeting point is RÃ©publique station."},
    {"id": "o2", "fr": "Le rendez-vous est Ã  18 h.", "en": "The meeting is at 6 pm."},
    {"id": "o3", "fr": "La personne aura environ dix minutes de retard.", "en": "The person will be about ten minutes late."},
    {"id": "o4", "fr": "Son bus est bloquÃ© dans les embouteillages.", "en": "Their bus is stuck in traffic."},
    {"id": "o5", "fr": "Le rendez-vous est Ã  8 h.", "en": "The meeting is at 8 am."},
    {"id": "o6", "fr": "Ils se retrouvent Ã  la station Bastille.", "en": "They are meeting at Bastille station."},
    {"id": "o7", "fr": "La personne est dÃ©jÃ  arrivÃ©e.", "en": "The person has already arrived."},
    {"id": "o8", "fr": "On lui dit de ne pas attendre.", "en": "They tell the other person not to wait."}
  ]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb
),
(
  'lc_fr_a2_0005',
  'fr-FR',
  'A2',
  'Une voisine crie dans la rue : son chat est coincÃ© dans un arbre depuis une heure. Elle veut appeler les pompiers, mais elle ne connaÃ®t pas le numÃ©ro et son tÃ©lÃ©phone est presque dÃ©chargÃ©. Elle demande Ã  un passant de l''aider.',
  42,
  16.8,
  'Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.',
  'What is going on? Select all statements that are true. There may be more than one.',
  '[
    {"id": "o1", "fr": "Un chat est coincÃ© dans un arbre.", "en": "A cat is stuck in a tree."},
    {"id": "o2", "fr": "Elle veut appeler les pompiers.", "en": "She wants to call the fire department."},
    {"id": "o3", "fr": "Elle ne connaÃ®t pas le numÃ©ro Ã  appeler.", "en": "She doesn''t know the number to call."},
    {"id": "o4", "fr": "Son tÃ©lÃ©phone est presque dÃ©chargÃ©.", "en": "Her phone is almost out of battery."},
    {"id": "o5", "fr": "Un chien est coincÃ© dans un arbre.", "en": "A dog is stuck in a tree."},
    {"id": "o6", "fr": "Les pompiers sont dÃ©jÃ  en route.", "en": "The fire department is already on the way."},
    {"id": "o7", "fr": "Elle veut appeler la police pour un vol.", "en": "She wants to call the police about a theft."},
    {"id": "o8", "fr": "Elle cherche un taxi.", "en": "She is looking for a taxi."}
  ]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb
),
(
  'lc_fr_a2_0006',
  'fr-FR',
  'A2',
  'On dÃ©cale la rÃ©union de cet aprÃ¨s-midi Ã  demain matin, Ã  9 h, parce que le client est malade. J''envoie tout de suite un e-mail avec la nouvelle heure et le lien visio. Garde ton aprÃ¨s-midi libre.',
  37,
  14.8,
  'Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.',
  'What is going on? Select all statements that are true. There may be more than one.',
  '[
    {"id": "o1", "fr": "La rÃ©union est dÃ©placÃ©e Ã  demain matin, Ã  9 h.", "en": "The meeting is moved to tomorrow morning at 9."},
    {"id": "o2", "fr": "Le client est malade.", "en": "The client is sick."},
    {"id": "o3", "fr": "Un e-mail va confirmer la nouvelle heure.", "en": "An email will confirm the new time."},
    {"id": "o4", "fr": "Le lien visio est envoyÃ© par e-mail.", "en": "The video-call link is sent by email."},
    {"id": "o5", "fr": "La rÃ©union reste cet aprÃ¨s-midi.", "en": "The meeting stays this afternoon."},
    {"id": "o6", "fr": "La rÃ©union est annulÃ©e dÃ©finitivement.", "en": "The meeting is canceled forever."},
    {"id": "o7", "fr": "Le client est en vacances.", "en": "The client is on vacation."},
    {"id": "o8", "fr": "La rÃ©union est dÃ©placÃ©e Ã  ce soir.", "en": "The meeting is moved to tonight."}
  ]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb
),
(
  'lc_fr_b1_0007',
  'fr-FR',
  'B1',
  'Annonce en gare : le train pour Lyon de 17 h 12 est annulÃ© Ã  cause d''un problÃ¨me technique. Un bus de remplacement part du quai 5 dans vingt minutes. Pour un remboursement, allez au guichet avec votre billet. Les autres trains restent Ã  l''heure.',
  45,
  18.0,
  'Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.',
  'What is going on? Select all statements that are true. There may be more than one.',
  '[
    {"id": "o1", "fr": "Le train pour Lyon de 17 h 12 est annulÃ©.", "en": "The 5:12 pm train to Lyon is canceled."},
    {"id": "o2", "fr": "C''est Ã  cause d''un problÃ¨me technique.", "en": "It is due to a technical problem."},
    {"id": "o3", "fr": "Un bus de remplacement part du quai 5.", "en": "A replacement bus leaves from platform 5."},
    {"id": "o4", "fr": "On peut demander un remboursement au guichet.", "en": "You can request a refund at the ticket office."},
    {"id": "o5", "fr": "Le train a seulement dix minutes de retard.", "en": "The train is only ten minutes late."},
    {"id": "o6", "fr": "Le bus part du quai 2.", "en": "The bus leaves from platform 2."},
    {"id": "o7", "fr": "Le remboursement se fait uniquement en ligne.", "en": "Refunds are online only."},
    {"id": "o8", "fr": "Tous les trains sont annulÃ©s aujourd''hui.", "en": "All trains are canceled today."}
  ]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb
),
(
  'lc_fr_b1_0008',
  'fr-FR',
  'B1',
  'Dans la colocation, ils se disputent la facture d''Ã©lectricitÃ© : l''un dit qu''il ne cuisine jamais, l''autre laisse la lumiÃ¨re allumÃ©e. AprÃ¨s quelques minutes, ils se calment et dÃ©cident de suivre leur consommation avec une appli pendant un mois, Ã  partir d''aujourd''hui, puis de partager la facture selon l''usage rÃ©el.',
  50,
  20.0,
  'Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.',
  'What is going on? Select all statements that are true. There may be more than one.',
  '[
    {"id": "o1", "fr": "Ils se disputent la facture d''Ã©lectricitÃ©.", "en": "They argue about the electricity bill."},
    {"id": "o2", "fr": "Ils dÃ©cident de suivre leur consommation avec une appli.", "en": "They decide to track their usage with an app."},
    {"id": "o3", "fr": "Ils le font pendant un mois.", "en": "They do it for one month."},
    {"id": "o4", "fr": "Ils partageront la facture selon l''usage rÃ©el.", "en": "They will split the bill based on actual usage."},
    {"id": "o5", "fr": "Ils se disputent la facture d''eau.", "en": "They argue about the water bill."},
    {"id": "o6", "fr": "Ils dÃ©cident de ne plus payer la facture.", "en": "They decide to stop paying the bill."},
    {"id": "o7", "fr": "Ils partagent forcÃ©ment 50/50.", "en": "They will definitely split it 50/50."},
    {"id": "o8", "fr": "Ils achÃ¨tent un nouveau frigo.", "en": "They buy a new fridge."}
  ]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb
),
(
  'lc_fr_a2_0009',
  'fr-FR',
  'A2',
  'Au restaurant, elle prÃ©cise qu''elle est allergique aux noix. Le serveur part vÃ©rifier en cuisine si la sauce contient des amandes. Il revient : il y en a. Elle change de plat et prend une salade sans sauce.',
  38,
  15.2,
  'Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.',
  'What is going on? Select all statements that are true. There may be more than one.',
  '[
    {"id": "o1", "fr": "Elle est allergique aux noix.", "en": "She is allergic to nuts."},
    {"id": "o2", "fr": "Le serveur vÃ©rifie la sauce en cuisine.", "en": "The waiter checks the sauce in the kitchen."},
    {"id": "o3", "fr": "La sauce contient des amandes.", "en": "The sauce contains almonds."},
    {"id": "o4", "fr": "Elle choisit une salade sans sauce.", "en": "She chooses a salad with no sauce."},
    {"id": "o5", "fr": "Elle est allergique au gluten.", "en": "She is allergic to gluten."},
    {"id": "o6", "fr": "La sauce ne contient aucune amande.", "en": "The sauce contains no almonds."},
    {"id": "o7", "fr": "Elle garde le mÃªme plat.", "en": "She keeps the same dish."},
    {"id": "o8", "fr": "Elle commande un dessert aux noix.", "en": "She orders a dessert with nuts."}
  ]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb
),
(
  'lc_fr_b1_0010',
  'fr-FR',
  'B1',
  'Le recruteur propose un entretien lundi Ã  11 h pour un poste de chef de projet. Le candidat demande si c''est 100 % Ã  distance ; on lui rÃ©pond : hybride, trois jours au bureau. Il demande la fourchette de salaire. Ils fixent un second appel mercredi avec la RH.',
  50,
  20.0,
  'Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.',
  'What is going on? Select all statements that are true. There may be more than one.',
  '[
    {"id": "o1", "fr": "Un entretien est proposÃ© lundi Ã  11 h.", "en": "An interview is proposed for Monday at 11."},
    {"id": "o2", "fr": "On lui rÃ©pond : hybride, trois jours au bureau.", "en": "They answer: hybrid, three days in the office."},
    {"id": "o3", "fr": "Le candidat demande la fourchette de salaire.", "en": "The candidate asks for the salary range."},
    {"id": "o4", "fr": "Ils fixent un second appel mercredi avec la RH.", "en": "They schedule a second call on Wednesday with HR."},
    {"id": "o5", "fr": "On lui rÃ©pond : c''est totalement Ã  distance.", "en": "They answer: it is fully remote."},
    {"id": "o6", "fr": "L''entretien est prÃ©vu dimanche matin.", "en": "The interview is set for Sunday morning."},
    {"id": "o7", "fr": "Ils discutent d''un poste de serveur au restaurant.", "en": "They discuss a waiter job at a restaurant."},
    {"id": "o8", "fr": "Le recruteur annule et ne rappelle pas.", "en": "The recruiter cancels and never calls back."}
  ]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb
),
(
  'lc_fr_b2_0011',
  'fr-FR',
  'B2',
  'Au magasin, LÃ©a revient avec un casque audio qui grÃ©sille. Elle veut Ãªtre remboursÃ©e, mais elle a perdu le ticket de caisse. Le vendeur propose un Ã©change ou un avoir. Elle insiste pour un remboursement sur sa carte, alors il appelle la responsable.',
  43,
  17.2,
  'Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.',
  'What is going on? Select all statements that are true. There may be more than one.',
  '[
    {"id": "o1", "fr": "Le casque audio grÃ©sille.", "en": "The headphones crackle."},
    {"id": "o2", "fr": "LÃ©a a perdu le ticket de caisse.", "en": "LÃ©a lost the receipt."},
    {"id": "o3", "fr": "Le vendeur propose un Ã©change ou un avoir.", "en": "The seller offers an exchange or store credit."},
    {"id": "o4", "fr": "Le vendeur appelle la responsable.", "en": "The seller calls the manager."},
    {"id": "o5", "fr": "LÃ©a a le ticket de caisse.", "en": "LÃ©a has the receipt."},
    {"id": "o6", "fr": "Le casque fonctionne parfaitement.", "en": "The headphones work perfectly."},
    {"id": "o7", "fr": "Le vendeur lui rend l''argent tout de suite, sans question.", "en": "The seller refunds her immediately, no questions asked."},
    {"id": "o8", "fr": "Elle vient juste comparer des prix.", "en": "She only came to compare prices."}
  ]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb
),
(
  'lc_fr_b2_0012',
  'fr-FR',
  'B2',
  'Lors d''une rÃ©union de quartier, on propose de fermer la rue aux voitures le week-end. Certains commerÃ§ants sont pour, d''autres craignent de perdre des clients. La mairie propose un essai d''un mois et un vote ensuite. Un habitant rappelle qu''il faut garder un accÃ¨s pour les ambulances.',
  47,
  18.8,
  'Que se passe-t-il ? SÃ©lectionne toutes les affirmations vraies. Il peut y en avoir plusieurs.',
  'What is going on? Select all statements that are true. There may be more than one.',
  '[
    {"id": "o1", "fr": "On propose de fermer la rue aux voitures le week-end.", "en": "They propose closing the street to cars on weekends."},
    {"id": "o2", "fr": "Certains commerÃ§ants sont pour, d''autres sont inquiets.", "en": "Some shop owners support it; others are worried."},
    {"id": "o3", "fr": "La mairie propose un essai d''un mois, puis un vote.", "en": "City hall proposes a one-month trial, then a vote."},
    {"id": "o4", "fr": "Il faut garder un accÃ¨s pour les ambulances.", "en": "They must keep access for ambulances."},
    {"id": "o5", "fr": "La rue sera fermÃ©e tous les jours, toute l''annÃ©e.", "en": "The street will be closed every day all year."},
    {"id": "o6", "fr": "Tout le monde est d''accord immÃ©diatement.", "en": "Everyone agrees immediately."},
    {"id": "o7", "fr": "La mairie abandonne l''idÃ©e dÃ¨s maintenant.", "en": "City hall drops the idea right away."},
    {"id": "o8", "fr": "Ils parlent d''ouvrir une nouvelle autoroute.", "en": "They talk about building a new highway."}
  ]'::jsonb,
  '{"correct_option_ids": ["o1", "o2", "o3", "o4"]}'::jsonb
)
ON CONFLICT (id) DO NOTHING;


-- Create phrases-audio storage bucket
-- Note: This requires Supabase admin privileges
-- If this doesn't work, create the bucket manually via Supabase Dashboard

-- Create bucket (if using Supabase Management API or service role)
-- This SQL won't work directly - buckets must be created via Dashboard or Management API
-- Keeping this file as documentation

-- To create manually:
-- 1. Go to Supabase Dashboard â†’ Storage
-- 2. Click "New bucket"
-- 3. Name: phrases-audio
-- 4. Public: Yes
-- 5. File size limit: 10MB
-- 6. Allowed MIME types: audio/mpeg, audio/wav, audio/mp3

-- Storage policies for phrases-audio bucket
-- (Run these AFTER creating the bucket manually)

-- Allow public read access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'phrases-audio',
  'phrases-audio',
  true,
  10485760, -- 10MB
  ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3']
)
ON CONFLICT (id) DO NOTHING;

-- Public read policy
CREATE POLICY "Public read access for phrases-audio"
ON storage.objects
FOR SELECT
USING (bucket_id = 'phrases-audio');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload to phrases-audio"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'phrases-audio' AND
  auth.role() = 'authenticated'
);

-- Users can update their own files
CREATE POLICY "Users can update their own files in phrases-audio"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'phrases-audio' AND
  auth.role() = 'authenticated'
);

-- Users can delete their own files
CREATE POLICY "Users can delete their own files in phrases-audio"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'phrases-audio' AND
  auth.role() = 'authenticated'
);


-- Fix storage policies for comprehension-audio bucket
-- Run this in Supabase Dashboard SQL Editor

-- Drop existing policies if they exist (optional - will fail if they don't exist, that's ok)
DROP POLICY IF EXISTS "Public read access for comprehension-audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to comprehension-audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files in comprehension-audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files in comprehension-audio" ON storage.objects;

-- Public read access (anyone can read files)
CREATE POLICY "Public read access for comprehension-audio"
ON storage.objects
FOR SELECT
USING (bucket_id = 'comprehension-audio');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload to comprehension-audio"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'comprehension-audio' AND
  auth.role() = 'authenticated'
);

-- Authenticated users can update
CREATE POLICY "Authenticated users can update files in comprehension-audio"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'comprehension-audio' AND
  auth.role() = 'authenticated'
);

-- Authenticated users can delete
CREATE POLICY "Authenticated users can delete files in comprehension-audio"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'comprehension-audio' AND
  auth.role() = 'authenticated'
);


-- Update comprehension_items with static audio URLs
-- These files are stored in public/audio/comprehension/ and served as static assets

UPDATE public.comprehension_items
SET audio_url = '/audio/comprehension/' || id || '.mp3'
WHERE id IN (
  'lc_fr_a1_0001',
  'lc_fr_a1_0002',
  'lc_fr_a2_0003',
  'lc_fr_a2_0004',
  'lc_fr_a2_0005',
  'lc_fr_a2_0006',
  'lc_fr_a2_0009',
  'lc_fr_b1_0007',
  'lc_fr_b1_0008',
  'lc_fr_b1_0010',
  'lc_fr_b2_0011',
  'lc_fr_b2_0012'
);


-- Unified Voice Exam System
-- Stores 3-scenario voice assessments testing all 4 skills

CREATE TABLE IF NOT EXISTS unified_exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Scenarios used (3 scenarios per exam)
  scenario_1_id TEXT NOT NULL,
  scenario_2_id TEXT NOT NULL,
  scenario_3_id TEXT NOT NULL,
  
  -- Personas used (different persona per scenario)
  persona_1_id TEXT NOT NULL,
  persona_2_id TEXT NOT NULL,
  persona_3_id TEXT NOT NULL,
  
  -- Tiers (adaptive difficulty)
  tier_1 INTEGER NOT NULL CHECK (tier_1 IN (1, 2, 3)),
  tier_2 INTEGER NOT NULL CHECK (tier_2 IN (1, 2, 3)),
  tier_3 INTEGER NOT NULL CHECK (tier_3 IN (1, 2, 3)),
  
  -- Conversation data (full transcript from all 3 scenarios)
  conversation_transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Individual skill scores (0-100)
  fluency_score INTEGER CHECK (fluency_score >= 0 AND fluency_score <= 100),
  syntax_score INTEGER CHECK (syntax_score >= 0 AND syntax_score <= 100),
  conversation_score INTEGER CHECK (conversation_score >= 0 AND conversation_score <= 100),
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  
  -- Overall score (weighted combination)
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  proficiency_level TEXT CHECK (proficiency_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  
  -- Metadata
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Link to detailed scoring trace
  trace_id UUID REFERENCES scoring_traces(id),
  
  -- Retry management
  is_official BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_unified_exam_user ON unified_exam_sessions(user_id);
CREATE INDEX idx_unified_exam_session ON unified_exam_sessions(session_id);
CREATE INDEX idx_unified_exam_official ON unified_exam_sessions(user_id, is_official, completed_at DESC);
CREATE INDEX idx_unified_exam_created ON unified_exam_sessions(created_at DESC);

-- Index on proficiency level for analytics
CREATE INDEX idx_unified_exam_level ON unified_exam_sessions(proficiency_level);

-- RLS Policies
ALTER TABLE unified_exam_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own exam sessions
CREATE POLICY "Users can read own unified exam sessions"
  ON unified_exam_sessions
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own exam sessions
CREATE POLICY "Users can insert own unified exam sessions"
  ON unified_exam_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own exam sessions (for completing them)
CREATE POLICY "Users can update own unified exam sessions"
  ON unified_exam_sessions
  FOR UPDATE
  USING (user_id = auth.uid());

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to unified exam sessions"
  ON unified_exam_sessions
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_unified_exam_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER unified_exam_updated_at
  BEFORE UPDATE ON unified_exam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_unified_exam_updated_at();

-- ============================================================================
-- Retry Cooldown Logic
-- ============================================================================

-- Function to check if user can take official exam
CREATE OR REPLACE FUNCTION can_take_official_exam(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  last_official_exam TIMESTAMPTZ;
BEGIN
  -- Get most recent official exam completion date
  SELECT completed_at INTO last_official_exam
  FROM unified_exam_sessions
  WHERE user_id = p_user_id
    AND is_official = true
    AND completed_at IS NOT NULL
  ORDER BY completed_at DESC
  LIMIT 1;
  
  -- If no previous exam, can take
  IF last_official_exam IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if 14 days have passed
  RETURN (now() - last_official_exam) >= INTERVAL '14 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next available exam date
CREATE OR REPLACE FUNCTION get_next_exam_date(p_user_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  last_official_exam TIMESTAMPTZ;
BEGIN
  SELECT completed_at INTO last_official_exam
  FROM unified_exam_sessions
  WHERE user_id = p_user_id
    AND is_official = true
    AND completed_at IS NOT NULL
  ORDER BY completed_at DESC
  LIMIT 1;
  
  -- If no previous exam, can take now
  IF last_official_exam IS NULL THEN
    RETURN now();
  END IF;
  
  -- Return date 14 days after last exam
  RETURN last_official_exam + INTERVAL '14 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE unified_exam_sessions IS 'Unified voice-based assessment testing all 4 skills through 3 conversation scenarios';
COMMENT ON COLUMN unified_exam_sessions.is_official IS 'Official assessments limited to once per 14 days. Practice exams (is_official=false) are unlimited.';
COMMENT ON COLUMN unified_exam_sessions.conversation_transcript IS 'JSONB array of all turns from all 3 scenarios';
COMMENT ON COLUMN unified_exam_sessions.trace_id IS 'Reference to detailed scoring_traces record for calibration and debugging';

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION can_take_official_exam(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_exam_date(UUID) TO authenticated;


