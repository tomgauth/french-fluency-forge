# SQL Migrations for Tom

These SQL files need to be run on Tom's Supabase project.

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
| `03_phrases_audio_bucket.sql` | Creates phrases-audio storage bucket | **CHECK FIRST** - May already exist |

## Notes

### 01_habits_goals.sql
- Creates 3 new tables: `habits`, `habit_cells`, `goals`
- Includes RLS (Row Level Security) policies
- Safe to run - uses `CREATE TABLE IF NOT EXISTS`

### 02_phrases_write_policies.sql
- Tom's existing `phrases` table only has SELECT policy
- Without this, TSV import fails with 403 Forbidden
- If you get "policy already exists" error, it's safe to skip

### 03_phrases_audio_bucket.sql
- **Check first:** Go to Storage and see if `phrases-audio` bucket exists
- If it exists, skip this file
- If it doesn't exist, run this to create it

## Verification

After running migrations, verify:

1. **Tables exist:** Go to Table Editor and check for:
   - `habits`
   - `habit_cells`  
   - `goals`

2. **Policies exist:** Go to Authentication → Policies and check:
   - `phrases` table has INSERT, UPDATE, DELETE policies
   - `habits`, `habit_cells`, `goals` have full CRUD policies

3. **Storage bucket:** Go to Storage and check for `phrases-audio` bucket
