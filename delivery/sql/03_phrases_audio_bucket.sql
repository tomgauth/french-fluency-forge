-- ============================================
-- MIGRATION 3: PHRASES-AUDIO STORAGE BUCKET
-- ============================================
-- Purpose: Creates storage bucket for phrase audio files (ElevenLabs TTS)
-- Status: CHECK FIRST - may already exist in Tom's Supabase
-- 
-- Before running this SQL:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Check if "phrases-audio" bucket exists
-- 3. If it exists: SKIP this file
-- 4. If it doesn't exist: Run this SQL
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

-- Allow anyone to READ audio files (public access)
CREATE POLICY "Public read access for phrases-audio"
ON storage.objects
FOR SELECT
USING (bucket_id = 'phrases-audio');

-- Allow authenticated users to UPLOAD audio files
CREATE POLICY "Authenticated users can upload to phrases-audio"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'phrases-audio' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to UPDATE their audio files
CREATE POLICY "Authenticated users can update phrases-audio"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'phrases-audio' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to DELETE their audio files
CREATE POLICY "Authenticated users can delete phrases-audio"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'phrases-audio' AND
  auth.role() = 'authenticated'
);
