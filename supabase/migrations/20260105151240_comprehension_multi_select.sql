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

