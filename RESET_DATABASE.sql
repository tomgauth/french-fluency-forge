-- FRENCH FLUENCY FORGE - DATABASE RESET SCRIPT
-- ⚠️ WARNING: This will DELETE ALL DATA! Only use on test/dev databases!
-- Run this BEFORE running COMBINED_MIGRATIONS.sql if you get "already exists" errors

-- ============================================================================
-- DROP ALL CUSTOM TYPES
-- ============================================================================
DROP TYPE IF EXISTS public.call_stage CASCADE;
DROP TYPE IF EXISTS public.call_outcome CASCADE;
DROP TYPE IF EXISTS public.gender_type CASCADE;
DROP TYPE IF EXISTS public.age_band_type CASCADE;
DROP TYPE IF EXISTS public.track_type CASCADE;
DROP TYPE IF EXISTS public.session_status CASCADE;

-- ============================================================================
-- DROP ALL TABLES (in reverse dependency order)
-- ============================================================================
DROP TABLE IF EXISTS public.unified_exam_sessions CASCADE;
DROP TABLE IF EXISTS public.comprehension_items CASCADE;
DROP TABLE IF EXISTS public.scoring_traces CASCADE;
DROP TABLE IF EXISTS public.speaking_assessment_items CASCADE;
DROP TABLE IF EXISTS public.speaking_assessment_sessions CASCADE;
DROP TABLE IF EXISTS public.confidence_phone_calls CASCADE;
DROP TABLE IF EXISTS public.user_phoneme_stats CASCADE;
DROP TABLE IF EXISTS public.phrases_learning_ladder CASCADE;
DROP TABLE IF EXISTS public.sales_playbook CASCADE;
DROP TABLE IF EXISTS public.sales_calls CASCADE;
DROP TABLE IF EXISTS public.sales_leads CASCADE;
DROP TABLE IF EXISTS public.systemeio_product_map CASCADE;
DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.credit_wallets CASCADE;
DROP TABLE IF EXISTS public.app_accounts CASCADE;
DROP TABLE IF EXISTS public.systemeio_webhook_events CASCADE;
DROP TABLE IF EXISTS public.comprehension_recordings CASCADE;
DROP TABLE IF EXISTS public.confidence_questionnaire_responses CASCADE;
DROP TABLE IF EXISTS public.skill_recordings CASCADE;
DROP TABLE IF EXISTS public.archetype_feedback CASCADE;
DROP TABLE IF EXISTS public.fluency_events CASCADE;
DROP TABLE IF EXISTS public.fluency_recordings CASCADE;
DROP TABLE IF EXISTS public.consent_records CASCADE;
DROP TABLE IF EXISTS public.assessment_sessions CASCADE;
DROP TABLE IF EXISTS public.purchases CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================================
-- DROP FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_user(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_speaking_assessment_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_unified_exam_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.can_take_official_exam(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_next_exam_date(UUID) CASCADE;

-- ============================================================================
-- DROP STORAGE POLICIES (if they exist)
-- ============================================================================
DROP POLICY IF EXISTS "Public read access for comprehension-audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to comprehension-audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files in comprehension-audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files in comprehension-audio" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads to comprehension-audio" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for phrases-audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to phrases-audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files in phrases-audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files in phrases-audio" ON storage.objects;

-- ============================================================================
-- DONE! Now you can run COMBINED_MIGRATIONS.sql
-- ============================================================================
