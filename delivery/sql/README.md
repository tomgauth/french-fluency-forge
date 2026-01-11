# SQL Migrations - Delivery Package

Hey Tom! Here are the database migrations you need to run to enable the new features I built.

## 🎯 What You Need to Run

Run these 3 files **in order**. Just copy-paste each one into Supabase SQL Editor and click "Run":

| # | File | What it does |
|---|------|--------------|
| 1 | `01_habits_goals.sql` | Creates `habits`, `habit_cells`, `goals` tables |
| 2 | `02_phrases_write_policies.sql` | Fixes TSV import (adds INSERT/UPDATE/DELETE to phrases) |
| 3 | `03_phrases_audio_bucket.sql` | Creates storage bucket for audio files |

## ✅ Safe to Run

All migrations are **idempotent** - meaning:
- You can run them multiple times without breaking anything
- They use `CREATE TABLE IF NOT EXISTS` and `DROP POLICY IF EXISTS`
- No need to worry about duplicates

## 🔧 How to Run

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New query"**
3. Copy the entire contents of `01_habits_goals.sql`
4. Click **"Run"** → should say "Success"
5. Repeat for `02_phrases_write_policies.sql`
6. Repeat for `03_phrases_audio_bucket.sql`

## 📋 After Running

Verify everything worked:

1. **Check Tables:** Go to Table Editor and confirm you see:
   - `habits`
   - `habit_cells`
   - `goals`

2. **Check Policies:** Go to Authentication → Policies → find `phrases` table. You should now see 4 policies:
   - "Phrases are viewable by everyone" (existing)
   - "Authenticated users can insert phrases" (new)
   - "Authenticated users can update phrases" (new)
   - "Authenticated users can delete phrases" (new)

3. **Check Storage:** Go to Storage and confirm `phrases-audio` bucket exists

## ❓ If You Hit Issues

- **"policy already exists"** → That's fine, skip that file
- **"table already exists"** → That's fine, the IF NOT EXISTS handles it
- **Other errors** → Send me the error message and I'll help debug

---

## 📁 File Descriptions

### 01_habits_goals.sql
Creates the tables for the Habits Tracker and Goals features:
- `habits` - User's daily/weekly habits
- `habit_cells` - Individual habit completion records
- `goals` - User's learning goals (skill targets, volume goals, etc.)

All include proper RLS policies so users only see their own data.

### 02_phrases_write_policies.sql
Your existing `phrases` table only has a SELECT policy. This adds:
- INSERT policy (so TSV import works)
- UPDATE policy (so users can edit phrases)
- DELETE policy (so users can remove phrases)

**This fixes the 403 error when importing TSV files!**

### 03_phrases_audio_bucket.sql
Creates a public storage bucket for phrase audio files (ElevenLabs TTS).

---

## 🧪 Testing Note (Ignore This)

There's also a `00_toms_baseline.sql` file in this folder - **ignore it**. That was just for my testing to simulate your existing database on a fresh Supabase project. You don't need to run it since you already have the `phrases` table.

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
