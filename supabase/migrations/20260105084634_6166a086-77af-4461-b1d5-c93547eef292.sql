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