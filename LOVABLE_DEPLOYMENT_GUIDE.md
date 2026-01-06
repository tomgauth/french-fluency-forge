# Lovable Deployment Guide - Calibration Console

**Issue**: Lovable doesn't automatically sync Supabase edge functions  
**Solution**: Two-step deployment process

---

## Step 1: Push to Git (Make Lovable Aware)

```bash
cd /Users/tomgauthier/Code/App\ SOLV/french-fluency-forge

# Stage all changes
git add -A

# Commit
git commit -m "feat: Add Calibration Console with 15 persona presets

- Add persona library and universal rules
- Enhance scoring for all modules
- Add unified trace system
- Create enhanced live data viewer
- Add debug playbook

See CALIBRATION_CONSOLE_IMPLEMENTATION_SUMMARY.md for details"

# Push to main
git push origin main
```

After this, **Lovable will sync** and show the changes in their editor.

---

## Step 2: Deploy Supabase Components Manually

Since Lovable doesn't deploy edge functions, you need to deploy them directly:

### A. Apply Database Migration

```bash
# Option 1: Via Supabase CLI (recommended)
supabase db push

# Option 2: Via Supabase Dashboard
# 1. Go to https://supabase.com/dashboard
# 2. Select your project
# 3. Go to SQL Editor
# 4. Copy contents of: supabase/migrations/20260106000000_scoring_traces.sql
# 5. Run the SQL
```

### B. Deploy Edge Functions

```bash
# Deploy the conversation-agent function
supabase functions deploy conversation-agent

# Verify deployment
supabase functions list
```

### C. Test the Deployment

```bash
# Test the edge function
curl -X POST \
  'https://[your-project-ref].supabase.co/functions/v1/conversation-agent' \
  -H 'Authorization: Bearer [your-anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{"action":"test"}'
```

---

## Step 3: Verify in Lovable

1. Open Lovable dashboard
2. Click "Pull from Git" or wait for auto-sync
3. You should now see:
   - New files in file tree
   - Modified files marked
   - Changes in code editor

---

## Alternative: Create Lovable Migration Prompt

If you want Lovable to handle everything, you can create a prompt for their AI:

**Prompt for Lovable AI:**

```
I have implemented a Calibration Console enhancement with the following changes:

NEW FILES TO ADD:
1. src/components/assessment/conversation/types.ts
2. src/components/assessment/conversation/personaLibrary.ts  
3. src/components/assessment/conversation/universalRules.ts
4. src/components/assessment/conversation/repairEventLibrary.ts
5. src/lib/scoring/traceBuilder.ts
6. src/lib/scoring/traceExporter.ts
7. src/lib/scoring/debugPlaybook.ts
8. src/components/EnhancedLiveDataViewer.tsx
9. src/components/assessment/confidence/confidenceSignals.ts
10. src/components/assessment/confidence/confidenceEvaluation.ts
11. src/components/assessment/syntax/syntaxScoring.ts

SUPABASE EDGE FUNCTIONS TO UPDATE:
- supabase/functions/conversation-agent/index.ts (major refactor)
- supabase/functions/conversation-agent/promptBuilder.ts (new)
- supabase/functions/conversation-agent/moveTagger.ts (new)
- supabase/functions/conversation-agent/conversationScoring.ts (new)

DATABASE MIGRATION TO RUN:
- supabase/migrations/20260106000000_scoring_traces.sql

FILES TO MODIFY:
- src/components/assessment/conversation/conversationScenarios.ts
- src/components/assessment/fluency/fluencyScoring.ts
- docs/06_ASSESSMENT_MODULES.md

Please:
1. Pull these changes from git if they exist
2. Or recreate them based on the specification in CALIBRATION_CONSOLE_IMPLEMENTATION_SUMMARY.md
3. Deploy the edge functions to Supabase
4. Run the database migration

All file contents are in the git repository at commit [insert-commit-hash].
```

---

## What You Should See After Deployment

### In Lovable Editor:
- ✅ All new TypeScript files visible in file tree
- ✅ Modified files showing changes
- ✅ No TypeScript errors
- ✅ Hot reload working

### In Your App:
- ✅ Conversation module uses new persona system
- ✅ EnhancedLiveDataViewer appears for admins
- ✅ Export trace button works
- ✅ 4 tabs: Fluency, Syntax, Conversation, Confidence, Debug

### In Supabase Dashboard:
- ✅ `scoring_traces` table exists
- ✅ conversation-agent function deployed
- ✅ Function logs show persona initialization

---

## Troubleshooting

### "Files not showing in Lovable"
→ Run `git push origin main` then click "Pull from Git" in Lovable

### "Edge function errors"
→ Deploy manually: `supabase functions deploy conversation-agent`

### "Table doesn't exist"
→ Run migration: `supabase db push` or paste SQL in dashboard

### "TypeScript import errors"
→ Lovable may need to rebuild: refresh page or click "Rebuild"

---

## Quick Test Script

```bash
# 1. Verify files exist locally
ls -la src/components/assessment/conversation/types.ts
ls -la src/lib/scoring/traceBuilder.ts

# 2. Check git status
git status

# 3. Push to git
git add -A && git commit -m "feat: Calibration Console" && git push

# 4. Deploy Supabase
supabase db push
supabase functions deploy conversation-agent

# 5. Open Lovable and refresh
echo "✅ Ready! Open Lovable and click 'Pull from Git'"
```

---

## Important Notes

1. **Lovable syncs FROM git**, not TO git
2. Edge functions must be deployed via Supabase CLI or dashboard
3. Database migrations must be applied manually
4. After git push, Lovable should auto-sync within 1-2 minutes

---

## Need Help?

If Lovable still doesn't show files:
1. Check git remote: `git remote -v`
2. Verify Lovable is connected to correct repo
3. Force sync: Click "Pull from Git" button in Lovable
4. Last resort: Re-clone repo in Lovable

