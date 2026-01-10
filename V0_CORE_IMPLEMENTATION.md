# V0-CORE Implementation Summary

## Overview

This document summarizes the changes made to fix the V0-CORE requirements:
1. **PRIMARY**: Fix Section 4 analyze-skill Edge Function bug
2. **SECONDARY**: Persist Habits and Goals to database

## Changes Made

### 1. Section 4 Bug Fix (analyze-skill Edge Function)

**File**: `supabase/functions/analyze-skill/index.ts`

**Problem**: The Edge Function was returning 500 errors but **NOT updating the `skill_recordings` status to 'error'**, leaving records stuck in `status='processing'`.

**Fixes Applied**:

1. **Early OpenAI API Key Validation** (Lines 340-367)
   - Added check for `OPENAI_API_KEY` immediately after parsing request
   - If key is missing, updates `skill_recordings.status` to 'error' with error message
   - Returns 500 with clear error message

2. **Error Status Update in Catch Block** (Lines 490-520)
   - When any error occurs, the catch block now:
     - Parses the recording ID from the request
     - Updates `skill_recordings.status` to 'error'
     - Sets `error_message` with the actual error
     - Sets `completed_at` timestamp
   - Then returns the 500 error response

**Before**:
```typescript
} catch (error) {
  // Only returned 500, never updated DB status
  return new Response(JSON.stringify({ error }), { status: 500 });
}
```

**After**:
```typescript
} catch (error) {
  // Update recording status to 'error' in database
  await supabase.from('skill_recordings')
    .update({ status: 'error', error_message: errorMessage })
    .eq('id', recordingId);
  
  return new Response(JSON.stringify({ error }), { status: 500 });
}
```

### 2. Habits & Goals Database Persistence

#### New Migration File

**File**: `supabase/migrations/20260106_habits_goals.sql`

Created three new tables with full RLS policies:

1. **`habits`** table:
   - `id` (uuid, primary key)
   - `user_id` (uuid, references auth.users)
   - `name` (text)
   - `frequency` ('daily' | 'weekly')
   - `source` ('system' | 'personal')
   - `intensity` (1-6, nullable)
   - `created_at`, `updated_at` timestamps

2. **`habit_cells`** table:
   - `id` (uuid, primary key)
   - `habit_id` (uuid, references habits)
   - `user_id` (uuid, references auth.users)
   - `date` (date)
   - `status` ('done' | 'missed' | 'na' | 'future')
   - `intensity` (1-6, nullable)
   - Unique constraint on `(habit_id, date)`

3. **`goals`** table:
   - `id` (uuid, primary key)
   - `user_id` (uuid, references auth.users)
   - `name`, `description`, `acceptance_criteria` (text)
   - `deadline` (date)
   - `goal_type` ('skill' | 'volume' | 'freeform')
   - `locked` (boolean)
   - `dimension` (for skill goals)
   - `target_score`, `target_value` (for targets)
   - `created_at`, `updated_at` timestamps

**RLS Policies**: Each table has SELECT, INSERT, UPDATE, DELETE policies ensuring users can only access their own data.

#### TypeScript Types Update

**File**: `src/integrations/supabase/types.ts`

Added TypeScript types for the new tables so Supabase client works properly:
- `habits` table type
- `habit_cells` table type
- `goals` table type

#### Dashboard Hook Update

**File**: `src/features/dashboard/hooks/useDashboardData.ts`

**Changes**:

1. **Added database fetch for habits and goals**:
   - On load, fetches habits from `habits` table
   - Fetches habit cells from `habit_cells` table
   - Fetches goals from `goals` table
   - Falls back to mock data if tables don't exist yet

2. **Updated action methods to persist to database**:
   - `updateHabitCell()` - Uses upsert to create/update habit cells
   - `addHabit()` - Inserts new habit to database
   - `deleteHabit()` - Deletes habit (cascades to cells)
   - `addGoal()` - Inserts new goal to database
   - `updateGoal()` - Updates goal in database
   - `deleteGoal()` - Deletes goal from database

3. **Added new delete methods**:
   - `deleteHabit(habitId: string)`
   - `deleteGoal(goalId: string)`

## Deployment Instructions

### 1. Run the Database Migration

Go to your Supabase dashboard → SQL Editor → Run the contents of:
```
supabase/migrations/20260106_habits_goals.sql
```

### 2. Set Edge Function Secrets

In Supabase dashboard → Edge Functions → Secrets, ensure these are set:
- `OPENAI_API_KEY` - Your OpenAI API key
- `SUPABASE_URL` - (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` - (auto-set)

### 3. Deploy Edge Functions

If using Supabase CLI:
```bash
supabase functions deploy analyze-skill
```

Or push the code to GitHub and let Lovable/Supabase auto-deploy.

### 4. Verify the Fix

1. Go to Section 4 of the assessment
2. Record audio and submit
3. Check the `skill_recordings` table:
   - Status should be 'completed' (success) or 'error' (failure)
   - Should never stay stuck at 'processing'

### 5. Verify Habits/Goals Persistence

1. Go to Dashboard
2. Add a new habit
3. Mark some days as done
4. Refresh the page
5. Habits and completion status should persist

## Files Changed

1. `supabase/functions/analyze-skill/index.ts` - Bug fix
2. `supabase/migrations/20260106_habits_goals.sql` - New migration
3. `src/integrations/supabase/types.ts` - Added table types
4. `src/features/dashboard/hooks/useDashboardData.ts` - Database persistence

## QA Checklist

- [ ] Run the habits_goals migration in Supabase
- [ ] Verify Edge Functions have OPENAI_API_KEY secret set
- [ ] Test Section 4: Submit recording, verify skill_recordings status updates
- [ ] Test Habits: Add habit, mark days, refresh page, verify persistence
- [ ] Test Goals: Add goal, update goal, delete goal, verify persistence
- [ ] Check Results page shows scores correctly
- [ ] Take screenshots of database rows for PR
