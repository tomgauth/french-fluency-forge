# Supabase Setup Guide for French Fluency Forge

## Quick Start

### 1. Create a Supabase Project

1. Go to https://supabase.com and create a new project
2. Note your project URL and keys from Settings → API:
   - **Project URL:** `https://[your-project-id].supabase.co`
   - **anon/public key:** `eyJ...` (VITE_SUPABASE_PUBLISHABLE_KEY)
   - **service_role key:** `eyJ...` (for Edge Functions)

### 2. Run Database Migrations

Go to **SQL Editor** in your Supabase dashboard and run the migrations in order.

**Option A:** Run the combined file `COMBINED_MIGRATIONS.sql` (recommended)

**Option B:** Run individual migration files from `supabase/migrations/` in filename order

### 3. Create Storage Buckets

In **Storage** section of Supabase dashboard, create:

1. **comprehension-audio** (public)
2. **phrases-audio** (public)

### 4. Set Edge Function Secrets

Go to **Edge Functions → Secrets** and add:

```
AZURE_SPEECH_KEY=your_azure_key
AZURE_SPEECH_REGION=eastus
OPENAI_API_KEY=sk-...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 5. Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy all functions
supabase functions deploy
```

### 6. Update Frontend Environment

Create `.env.local` in project root:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
```

### 7. Run the App

```bash
npm install
npm run dev
```

---

## Environment Variables Summary

### Frontend (.env.local)
```
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

### Edge Functions (Supabase Secrets)
```
OPENAI_API_KEY=sk-...
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=eastus
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Tables Created by Migrations

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends auth.users) |
| `assessment_sessions` | Assessment session tracking |
| `fluency_recordings` | Fluency analysis recordings |
| `skill_recordings` | Syntax/Conversation/Confidence recordings |
| `comprehension_recordings` | Comprehension recordings |
| `comprehension_items` | Comprehension prompt items |
| `app_accounts` | Access control |
| `credit_wallets` | Credit system |
| `sales_leads` | Sales CRM |
| `sales_calls` | Sales calls |
| `unified_exam_sessions` | Voice exam sessions |

---

## Edge Functions

| Function | Purpose |
|----------|---------|
| `analyze-fluency` | WPM and pause analysis |
| `analyze-skill` | Syntax/Conversation/Confidence scoring |
| `analyze-pronunciation` | Pronunciation analysis |
| `analyze-comprehension` | Comprehension scoring |
| `french-tts` | Text-to-speech |
| `transcribe-pronunciation` | Pronunciation transcription |
| `conversation-agent` | AI conversation partner |
| `systemeio-webhook` | Payment webhooks |

---

## Known Issues to Fix

### PRIMARY: Section 4 Edge Function Bug
- `analyze-skill` returns non-2xx status
- Leaves `skill_recordings` stuck at `status='processing'`
- Check logs: Supabase Dashboard → Edge Functions → Logs

### SECONDARY: Habits/Goals Persistence
- Currently stored in React state only
- Need Postgres tables for habits, goals, habit_cells
- Need CRUD operations in `useDashboardData.ts`

