-- ============================================
-- MIGRATION 3: PHRASES-AUDIO STORAGE BUCKET
-- ============================================
-- Purpose: Creates storage bucket for phrase audio files (ElevenLabs TTS)
-- Status: OPTIONAL - only needed if audio generation is used
-- 
-- This migration is SAFE TO RUN multiple times:
-- - Bucket creation uses ON CONFLICT DO NOTHING
-- - Policies use DROP IF EXISTS before CREATE
--
-- Run: Copy entire file into Supabase SQL Editor and execute
-- ============================================

-- Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'phrases-audio',
  'phrases-audio',
  true,
  10485760, -- 10MB max file size
  ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Allow anyone to READ audio files (public access)
DROP POLICY IF EXISTS "Public read access for phrases-audio" ON storage.objects;
CREATE POLICY "Public read access for phrases-audio"
ON storage.objects
FOR SELECT
USING (bucket_id = 'phrases-audio');

-- Allow authenticated users to UPLOAD audio files
DROP POLICY IF EXISTS "Authenticated users can upload to phrases-audio" ON storage.objects;
CREATE POLICY "Authenticated users can upload to phrases-audio"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'phrases-audio' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to UPDATE their audio files
DROP POLICY IF EXISTS "Authenticated users can update phrases-audio" ON storage.objects;
CREATE POLICY "Authenticated users can update phrases-audio"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'phrases-audio' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to DELETE their audio files
DROP POLICY IF EXISTS "Authenticated users can delete phrases-audio" ON storage.objects;
CREATE POLICY "Authenticated users can delete phrases-audio"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'phrases-audio' AND
  auth.role() = 'authenticated'
);

-- ============================================
-- VERIFICATION
-- ============================================
-- After running, verify:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Check that "phrases-audio" bucket exists
-- 3. Check that bucket is set to "Public"
-- ============================================
