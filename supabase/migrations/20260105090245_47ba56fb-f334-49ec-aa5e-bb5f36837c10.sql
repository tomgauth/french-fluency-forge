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