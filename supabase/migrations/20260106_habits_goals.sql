-- Habits and Goals Persistence Migration
-- Created for V0-CORE job requirement

-- ============================================
-- HABITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly')),
  source text NOT NULL DEFAULT 'personal' CHECK (source IN ('system', 'personal')),
  intensity integer CHECK (intensity IS NULL OR (intensity >= 1 AND intensity <= 6)),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);

-- RLS Policies for habits
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

-- Users can only see their own habits
DROP POLICY IF EXISTS "Users can view own habits" ON habits;
CREATE POLICY "Users can view own habits"
  ON habits FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own habits
DROP POLICY IF EXISTS "Users can create own habits" ON habits;
CREATE POLICY "Users can create own habits"
  ON habits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own habits
DROP POLICY IF EXISTS "Users can update own habits" ON habits;
CREATE POLICY "Users can update own habits"
  ON habits FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own habits
DROP POLICY IF EXISTS "Users can delete own habits" ON habits;
CREATE POLICY "Users can delete own habits"
  ON habits FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================
-- HABIT CELLS TABLE (daily completion records)
-- ============================================
CREATE TABLE IF NOT EXISTS habit_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'na' CHECK (status IN ('done', 'missed', 'na', 'future')),
  intensity integer CHECK (intensity IS NULL OR (intensity >= 1 AND intensity <= 6)),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  
  -- Unique constraint: one cell per habit per date
  UNIQUE(habit_id, date)
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_habit_cells_habit_id ON habit_cells(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_cells_user_id ON habit_cells(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_cells_date ON habit_cells(date);

-- RLS Policies for habit_cells
ALTER TABLE habit_cells ENABLE ROW LEVEL SECURITY;

-- Users can only see their own habit cells
DROP POLICY IF EXISTS "Users can view own habit cells" ON habit_cells;
CREATE POLICY "Users can view own habit cells"
  ON habit_cells FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own habit cells
DROP POLICY IF EXISTS "Users can create own habit cells" ON habit_cells;
CREATE POLICY "Users can create own habit cells"
  ON habit_cells FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own habit cells
DROP POLICY IF EXISTS "Users can update own habit cells" ON habit_cells;
CREATE POLICY "Users can update own habit cells"
  ON habit_cells FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own habit cells
DROP POLICY IF EXISTS "Users can delete own habit cells" ON habit_cells;
CREATE POLICY "Users can delete own habit cells"
  ON habit_cells FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================
-- GOALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  acceptance_criteria text,
  deadline date,
  goal_type text NOT NULL CHECK (goal_type IN ('skill', 'volume', 'freeform')),
  locked boolean NOT NULL DEFAULT false,
  
  -- For skill goals (e.g., "Reach 80 in pronunciation")
  dimension text CHECK (dimension IS NULL OR dimension IN (
    'pronunciation', 'fluency', 'confidence', 'syntax', 'conversation', 'comprehension'
  )),
  target_score integer CHECK (target_score IS NULL OR (target_score >= 0 AND target_score <= 100)),
  
  -- For volume goals (e.g., "Learn 100 phrases")
  metric text,
  target_value integer,
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);

-- RLS Policies for goals
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Users can only see their own goals
DROP POLICY IF EXISTS "Users can view own goals" ON goals;
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own goals
DROP POLICY IF EXISTS "Users can create own goals" ON goals;
CREATE POLICY "Users can create own goals"
  ON goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own goals
DROP POLICY IF EXISTS "Users can update own goals" ON goals;
CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own goals
DROP POLICY IF EXISTS "Users can delete own goals" ON goals;
CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for habits
DROP TRIGGER IF EXISTS update_habits_updated_at ON habits;
CREATE TRIGGER update_habits_updated_at
  BEFORE UPDATE ON habits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for habit_cells
DROP TRIGGER IF EXISTS update_habit_cells_updated_at ON habit_cells;
CREATE TRIGGER update_habit_cells_updated_at
  BEFORE UPDATE ON habit_cells
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for goals
DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
