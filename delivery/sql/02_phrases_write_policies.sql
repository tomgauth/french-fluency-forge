-- ============================================
-- MIGRATION 2: PHRASES INSERT/UPDATE/DELETE POLICIES
-- ============================================
-- Purpose: Adds missing RLS write policies for phrases table
-- Status: NEW - Tom's repo has the phrases table but missing write policies
-- Without this: TSV import fails with 403 Forbidden
-- Run: Copy entire file into Supabase SQL Editor and execute
-- ============================================

-- Note: If you get "policy already exists" error, that's OK - skip this file.
-- The SELECT policy already exists from the original migration.

-- Allow authenticated users to INSERT phrases
CREATE POLICY "Authenticated users can insert phrases"
  ON public.phrases FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to UPDATE phrases
CREATE POLICY "Authenticated users can update phrases"
  ON public.phrases FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to DELETE phrases
CREATE POLICY "Authenticated users can delete phrases"
  ON public.phrases FOR DELETE
  USING (auth.role() = 'authenticated');
