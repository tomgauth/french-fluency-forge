# SQL Migrations for Tom

These SQL files need to be run on Tom's Supabase project.

## ⚠️ SAFE TO RUN MULTIPLE TIMES

All migrations are **idempotent** - they use:
- `CREATE TABLE IF NOT EXISTS`
- `DROP POLICY IF EXISTS` before `CREATE POLICY`
- `ON CONFLICT (id) DO NOTHING` for bucket creation

## How to Run

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New query"**
3. Copy/paste the contents of each file
4. Click **"Run"**
5. Verify "Success" message appears

## Execution Order

Run these files **in numerical order**:

| File | Description | Status |
|------|-------------|--------|
| `01_habits_goals.sql` | Creates habits, habit_cells, goals tables | **MUST RUN** - NEW tables |
| `02_phrases_write_policies.sql` | Adds INSERT/UPDATE/DELETE policies for phrases | **MUST RUN** - Fixes TSV import 403 error |
| `03_phrases_audio_bucket.sql` | Creates phrases-audio storage bucket | **OPTIONAL** - Only if using audio |

## Notes

### 01_habits_goals.sql
- Creates 3 new tables: `habits`, `habit_cells`, `goals`
- Includes RLS (Row Level Security) policies
- Safe to run multiple times

### 02_phrases_write_policies.sql
- Tom's existing `phrases` table only has SELECT policy
- This adds INSERT/UPDATE/DELETE policies
- Without this, TSV import fails with 403 Forbidden
- Safe to run multiple times (uses DROP IF EXISTS)

### 03_phrases_audio_bucket.sql
- Creates storage bucket for ElevenLabs TTS audio files
- Safe to run multiple times (uses ON CONFLICT DO NOTHING)

## Verification

After running migrations, verify:

1. **Tables exist:** Go to Table Editor and check for:
   - `habits`
   - `habit_cells`  
   - `goals`

2. **Policies exist:** Go to Authentication → Policies and check:
   - `phrases` table has INSERT, UPDATE, DELETE policies (4 total with existing SELECT)
   - `habits`, `habit_cells`, `goals` have full CRUD policies

3. **Storage bucket:** Go to Storage and check for `phrases-audio` bucket
