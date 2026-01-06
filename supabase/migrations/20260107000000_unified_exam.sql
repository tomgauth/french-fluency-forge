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

