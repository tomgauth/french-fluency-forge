-- ============================================
-- MIGRATION 2: PHRASES TABLE WRITE POLICIES
-- ============================================
-- Purpose: Adds INSERT/UPDATE/DELETE policies for phrases table
-- 
-- Tom's existing phrases table ONLY has a SELECT policy:
--   "Phrases are viewable by everyone" (FOR SELECT USING (true))
--
-- This migration adds write policies so:
--   - TSV import works (no more 403 Forbidden)
--   - Users can add their own phrases
--   - Admin/service role can manage all phrases
--
-- Status: MUST RUN - fixes TSV import 403 error
-- Run: Copy entire file into Supabase SQL Editor and execute
-- ============================================

-- ============================================
-- IMPORTANT: These policies assume the `phrases` table already exists
-- from Tom's existing migration: 20260102164444_phrases_learning_ladder.sql
-- ============================================

-- Enable RLS (may already be enabled, safe to re-run)
ALTER TABLE phrases ENABLE ROW LEVEL SECURITY;

-- ============================================
-- INSERT POLICY
-- ============================================
-- Allow authenticated users to insert new phrases
-- (This enables TSV import functionality)

DROP POLICY IF EXISTS "Authenticated users can insert phrases" ON phrases;
CREATE POLICY "Authenticated users can insert phrases"
  ON phrases FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- UPDATE POLICY
-- ============================================
-- Allow authenticated users to update phrases
-- (For editing phrase content, adding audio URLs, etc.)

DROP POLICY IF EXISTS "Authenticated users can update phrases" ON phrases;
CREATE POLICY "Authenticated users can update phrases"
  ON phrases FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ============================================
-- DELETE POLICY
-- ============================================
-- Allow authenticated users to delete phrases

DROP POLICY IF EXISTS "Authenticated users can delete phrases" ON phrases;
CREATE POLICY "Authenticated users can delete phrases"
  ON phrases FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================
-- VERIFICATION
-- ============================================
-- After running, verify policies exist:
-- 1. Go to Supabase Dashboard → Authentication → Policies
-- 2. Find "phrases" table
-- 3. Should see 4 policies:
--    - "Phrases are viewable by everyone" (SELECT) - existing
--    - "Authenticated users can insert phrases" (INSERT) - new
--    - "Authenticated users can update phrases" (UPDATE) - new
--    - "Authenticated users can delete phrases" (DELETE) - new
-- ============================================
