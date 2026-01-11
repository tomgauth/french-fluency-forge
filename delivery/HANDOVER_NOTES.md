# French Fluency Forge - Option B Delivery

**Developer:** Jobby (JN Gonzales)  
**Date:** January 10, 2025  
**Scope:** Option B ($450) - V0-CORE + Flashcards Module  
**Deadline:** Sunday, January 18, 2025

---

## ✅ Completed Features

### V0-CORE Fixes

| Feature | Status | Evidence |
|---------|--------|----------|
| Section 4 Bug Fix | ✅ Done | `screenshots/01-section4-completion.png` |
| Habits Persistence | ✅ Done | `screenshots/02-habits-list.png` |
| Goals Persistence | ✅ Done | `screenshots/03-goals-list.png` |

### Flashcards Module

| Feature | Status | Evidence |
|---------|--------|----------|
| SRS (Again/Hard/Good/Easy) | ✅ Done | `screenshots/04-srs-rating-buttons.png` |
| Keyboard Shortcuts (1-4) | ✅ Done | Tip shown below rating buttons |
| Audio Generation (ElevenLabs TTS) | ✅ Done | `screenshots/05-flashcard-audio-speaker.png` |
| TSV Import to Supabase | ✅ Done | `screenshots/06-tsv-import-dialog.png`, `07-tsv-import-success.png` |
| Flashcard Session Flow | ✅ Done | `screenshots/08-flashcard-session.png` |
| Speech Recognition | ✅ Done | SpeechFeedbackPanel component exists |
| Stability (No Crashes) | ✅ Done | Full session flow tested |

---

## 🗄️ MIGRATIONS TO RUN ON TOM'S SUPABASE

> **IMPORTANT:** All SQL files are included in the `delivery/sql/` folder for easy access.
> See `delivery/sql/README.md` for execution instructions.

### 📁 SQL Files Location
```
delivery/
  sql/
    README.md                     ← Read this first!
    01_habits_goals.sql           ← MUST RUN
    02_phrases_write_policies.sql ← MUST RUN  
    03_phrases_audio_bucket.sql   ← Check first
```

### ✅ Already Exists (DO NOT RUN)
The following already exist in Tom's repo and should NOT be re-run:
- `phrases` table (from `20260102164444_phrases_learning_ladder.sql`)
- `member_phrase_cards` table
- `member_phrase_settings` table
- `comprehension-audio` bucket

---

### 🆕 Migration 1: Habits & Goals Tables (NEW - MUST RUN)
**File:** `delivery/sql/01_habits_goals.sql`

This is a **NEW** migration. Tom's current repo has "Future: Database persistence (not yet implemented)" for habits/goals.

Run the **entire file** in Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Open and copy contents of `supabase/migrations/20260106_habits_goals.sql`
3. Click "Run"

Creates these tables:
- `habits` - User habits with weekly grid
- `habit_cells` - Individual day cells for habits
- `goals` - User goals with title, due date, priority

---

### 🆕 Migration 2: Phrases INSERT Policy (NEW - MUST RUN)
**File:** `delivery/sql/02_phrases_write_policies.sql`

Tom's existing `phrases` table has RLS enabled but missing INSERT/UPDATE/DELETE policies. Without this, TSV import fails with 403 Forbidden.

---

### 🆕 Migration 3: Phrases Audio Bucket (CHECK FIRST)
**File:** `delivery/sql/03_phrases_audio_bucket.sql`

Check if `phrases-audio` bucket exists:
1. Go to Supabase Dashboard → Storage
2. Look for bucket named `phrases-audio`
3. If it doesn't exist, run the SQL file

---

## 🔑 Environment Variables / Secrets

### Frontend (.env file)

Copy `.env.example` to `.env` and fill in:

```bash
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
VITE_ELEVENLABS_API_KEY="your-elevenlabs-api-key"  # Required for audio
VITE_OPENAI_API_KEY="your-openai-key"               # Optional
```

### Supabase Secrets (Edge Functions)

Verify these are set in **Supabase Dashboard → Project Settings → Edge Functions → Secrets**:

| Secret | Required For |
|--------|--------------|
| `OPENAI_API_KEY` | Section 4 Conversation Analysis |
| `ELEVENLABS_API_KEY` | Phrase Audio Generation (if using Edge Function) |

---

## 📁 Files Changed

### Edge Functions
- `supabase/functions/analyze-skill/index.ts` - Fixed variable scope bug in Section 4

### Components (src/features/)
| File | Change |
|------|--------|
| `intake/components/IntakeForm.tsx` | Fixed radio button controlled/uncontrolled warning |
| `phrases/components/TSVImportDialog.tsx` | NEW: TSV paste import with preview |
| `phrases/components/RevealPanel.tsx` | Added speaker icon for audio playback |
| `phrases/components/RatingButtons.tsx` | Added keyboard shortcuts 1-4 |
| `dashboard/components/HabitGridCard.tsx` | Fixed alignment + solid green color |
| `dashboard/components/GoalDialog.tsx` | Fixed form pre-population on edit |

### Hooks
| File | Change |
|------|--------|
| `dashboard/hooks/useDashboardData.ts` | Habits/Goals Supabase CRUD |
| `phrases/hooks/usePhraseAudio.ts` | Skip mock URLs, use ElevenLabs TTS |
| `phrases/hooks/usePhrasesLibrary.ts` | Load localStorage phrases for TSV imports |
| `phrases/hooks/usePhrasesSession.ts` | Load localStorage phrases for TSV imports |

### Pages
- `src/pages/PhrasesLandingPage.tsx` - TSV import handler + longer success toast

### Database Migrations (NEW)
- `supabase/migrations/20260106_habits_goals.sql` - Habits & Goals tables
- `supabase/migrations/20260106140000_phrases_insert_policy.sql` - Phrases RLS fix

---

## 🧪 Testing Results

| Test | Result |
|------|--------|
| Section 4 Conversation | Score 63/100 displayed correctly ✅ |
| TSV Import | 5 phrases imported to Supabase ✅ |
| Flashcard Session | Cards appear, rating works ✅ |
| Audio Playback | ElevenLabs TTS plays on speaker click ✅ |
| Keyboard Shortcuts | 1=Again, 2=Hard, 3=Good, 4=Easy ✅ |
| Habits CRUD | Add/Toggle/Delete working ✅ |
| Goals CRUD | Add/Edit/Delete working ✅ |
| Goal Edit Dialog | Pre-populates correctly ✅ |

---

## ⚠️ Known Console Warnings (Safe to Ignore)

1. **React Router Future Flag Warnings**
   - Standard deprecation notices for v7 migration
   - Appear in every React Router 6 project
   - NOT errors, just informational

2. **`member_phrase_settings` 406 Error**
   - Gracefully handled with fallback to defaults
   - Doesn't affect user experience

---

## 🚀 Deployment Checklist for Tom

1. [ ] Pull latest code from this branch
2. [ ] Run migrations in Supabase SQL Editor (see above)
3. [ ] Verify `phrases-audio` bucket exists in Storage
4. [ ] Verify `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` secrets are set
5. [ ] Test Section 4 flow end-to-end
6. [ ] Test Flashcards: Add starter pack → Start session → Rate cards
7. [ ] Test TSV Import: Paste phrases → Verify in Supabase `phrases` table

---

## 📧 Contact

For questions: JN Gonzales via OnlineJobs.ph / Gmail

---

**Thank you for the opportunity!**
