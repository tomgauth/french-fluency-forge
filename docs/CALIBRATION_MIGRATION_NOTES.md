# Calibration Console Migration Notes

**Date**: January 2026  
**Version**: Calibration Console v1.0

## Overview

This document outlines the major changes introduced by the Calibration Console enhancement, including breaking changes, new features, and migration guidelines.

---

## What Changed

### 1. Persona-Based Conversation System (BREAKING)

**Old System:**
- 3 simple conversation scenarios
- Generic "friendly agent" bot behavior
- Minimal behavioral customization

**New System:**
- **15 persona presets** with standardized parameters
- **9 conversation scenarios** across 3 tiers
- **Universal exam rules** ensuring fairness
- **Planned repair events** for consistent testing

**Breaking Changes:**
- Old conversation scenarios removed
- New `EnhancedScenarioConfig` type with additional fields:
  - `persona_id`: string
  - `tier`: 1 | 2 | 3
  - `planned_repair_events`: array
  - `required_slots`: array
  - `end_conditions`: array
- Conversation agent now requires `persona_id` in scenario config

**Migration Path:**
1. Update all scenario definitions to include `persona_id`
2. Add `tier` level to each scenario
3. Define `planned_repair_events` (minimum 2 per scenario)
4. Specify `required_slots` for slot coverage tracking

---

### 2. Unified Scoring Trace System (NEW)

**New Feature:**
- Complete turn-by-turn trace recording
- JSON export for calibration analysis
- Debug flags for automated diagnostics
- New database table: `scoring_traces`

**New Types:**
- `ScoringTrace`: Complete trace object
- `TurnTrace`: Per-turn data with metrics
- `RepairEvent`: Tracked repair events with resolution

**Database Schema:**
```sql
CREATE TABLE scoring_traces (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES assessment_sessions(id),
  module_type TEXT,
  trace_data JSONB,
  created_at TIMESTAMPTZ
);
```

**Usage:**
```typescript
import { initTrace, addTurn, exportTraceJSON } from '@/lib/scoring/traceBuilder';

const trace = initTrace(sessionId, scenarioId, personaId);
// ... add turns and scores ...
exportTraceJSON(trace);
```

---

### 3. Enhanced Fluency Scoring (ENHANCED)

**New Metrics:**
- Word-level timestamp processing (Whisper verbose_json)
- Detailed pause detection (>0.3s threshold)
- Pause list with timestamps
- Gross WPM calculation (optional)
- Debug flags:
  - `asr_word_timestamps_missing`
  - `filler_filter_removed_too_much`
  - `pause_inflation_noise`

**New Functions:**
```typescript
import { scoreFluencyFromTimestamps, WordTimestamp } from '@/components/assessment/fluency/fluencyScoring';

const score = scoreFluencyFromTimestamps(words, totalDuration);
// Returns FluencyScore with detailed metrics + debug_flags
```

**Backward Compatibility:**
- Existing `calculateFluencyScore(metrics)` still works
- New fields added with aliases for consistency

---

### 4. Evidence-Backed Syntax Scoring (NEW)

**New Features:**
- LLM returns tags with evidence snippets
- Deterministic weighted scoring (PC:25, FP:15, OP:25, Q:15, C:20)
- Coverage scores (0.0, 0.5, or 1.0 per target)
- Debug flags:
  - `asr_correction_suspicion_high`
  - `no_evidence_for_claim`
  - `drift_detected`

**New File:**
- `src/components/assessment/syntax/syntaxScoring.ts`

**Usage:**
```typescript
import { calculateSyntaxScore } from '@/components/assessment/syntax/syntaxScoring';

const score = calculateSyntaxScore(tags);
// Returns: { score, PC, FP, OP, Q, C, coverage }
```

---

### 5. Precise Conversation Scoring (ENHANCED)

**New Features:**
- Conversation move tagging (QUESTION, PROPOSAL, REPAIR_INIT, etc.)
- Repair pattern matching (French phrases)
- Detailed comprehension metrics:
  - `answers_prompt_rate`
  - `detail_tracking_hits`
  - `slot_coverage`
- Repair metrics:
  - `repair_events_total`
  - `repair_events_resolved`
  - `repair_initiations`
  - `repair_completions`
- Flow metrics:
  - `questions_count`
  - `proposals_count`
  - `closings_count`

**New Files:**
- `supabase/functions/conversation-agent/moveTagger.ts`
- `supabase/functions/conversation-agent/conversationScoring.ts`

**Score Changes:**
- Comprehension: 0-45 → **0-50**
- Repair: 0-30 (unchanged)
- Flow: 0-25 → **0-20**

---

### 6. Observable Confidence Scoring (NEW)

**New Features:**
- 5-part rubric with evidence:
  - Length/Development (0-25)
  - Assertiveness/Ownership (0-25)
  - Emotional Engagement (0-20)
  - Clarity/Control (0-15)
  - Confidence Language (0-15)
- Signal detection (ownership, boundary, engagement, structure)
- Debug flags:
  - `evidence_missing_for_confidence_signal`
  - `over_penalizing_softeners`
  - `questionnaire_not_completed`

**New Files:**
- `src/components/assessment/confidence/confidenceSignals.ts`
- `src/components/assessment/confidence/confidenceEvaluation.ts`

**Backward Compatibility:**
- Final score formula unchanged: 50% speaking + 50% self-assessment

---

### 7. Debug Playbook (NEW)

**New Feature:**
- Automated diagnostics for all debug flags
- Recommendations and quick fixes
- Severity levels (error, warning, info)

**New File:**
- `src/lib/scoring/debugPlaybook.ts`

**Usage:**
```typescript
import { getRecommendations } from '@/lib/scoring/debugPlaybook';

const recommendations = getRecommendations(trace.debug_flags);
// Returns array of DebugRecommendation objects
```

---

## Persona Library Reference

### Service/Support Roles
- **P01**: Friendly Support Agent (Tier 1)
- **P02**: Busy Agent (Tier 2)
- **P03**: Policy Gatekeeper (Tier 2-3)
- **P04**: Confused Agent (Tier 2, repair-heavy)
- **P05**: Supervisor Escalation (formal)
- **P06**: Upsell Sales Rep (distraction)

### Workplace Roles
- **P07**: Supportive Colleague (Tier 1)
- **P08**: Stressed Manager (Tier 3, pushback)
- **P09**: Skeptical Stakeholder (clarity test)

### Social Roles
- **P10**: Friendly Friend (Tier 1, warm)
- **P11**: Disappointed Friend (Tier 3, emotional friction)
- **P12**: Shy / Minimal Responder (leadership test)

### Administrative Roles
- **P13**: Bureaucrat (process-first)
- **P14**: Automated IVR (menu-like)
- **P15**: Passive Listener (universal leadership test)

---

## Universal Exam Rules

All personas follow these rules:

1. **R1 - No Teaching**: Never correct grammar mid-test
2. **R2 - Information Gating**: Don't volunteer all info; wait for questions. Give hint after 2 silent turns.
3. **R3 - Planned Friction**: ≥2 repair events per scenario, resolvable via clarification
4. **R4 - Stay On Task**: Gentle redirect once if user goes off-topic
5. **R5 - Explicit End**: End with confirmation + next steps when goal achieved

---

## Calibration Workflow

1. **Select Scenario + Persona**: Choose from 9 scenarios and appropriate persona for tier
2. **Run Session**: Let user complete conversation
3. **Review Trace**: Use LiveDataViewer (enhanced) or export trace JSON
4. **Analyze Metrics**:
   - WPM distribution and pause patterns
   - Syntax tag frequency and evidence
   - Repair event resolution rate
   - Confidence signal distribution
5. **Adjust Parameters**:
   - Filler lists (if over-filtering)
   - Repair patterns (if under/over-detecting)
   - Scenario slots (if unclear)
   - Persona parameters (if behavior off)
6. **Export & Compare**: Export multiple traces, compare across personas/tiers

---

## Database Migration

**Run Migration:**
```bash
# Apply the scoring_traces migration
psql -h [host] -U [user] -d [database] -f supabase/migrations/20260106000000_scoring_traces.sql
```

**Verify:**
```sql
SELECT COUNT(*) FROM scoring_traces;
-- Should return 0 (table exists but empty)
```

---

## Backward Compatibility Notes

### What Still Works
- Existing fluency, syntax, confidence, conversation modules
- Old module API (but will use default/fallback personas)
- LiveDataViewer (will show limited data until enhanced version used)
- All database tables (new table additive)

### What Breaks
- Direct conversation scenario imports (need to use new structure)
- Hardcoded persona assumptions (must specify persona_id)
- Scoring without trace initialization (recommended to always init trace)

---

## Testing Checklist

Before deploying to production:

- [ ] Test all 15 personas generate appropriate responses
- [ ] Verify universal rules trigger correctly (anti-stall hint, repair events)
- [ ] Check syntax tags return evidence snippets
- [ ] Verify confidence signals match correctly
- [ ] Test trace export/import roundtrip
- [ ] Verify database migration applies cleanly
- [ ] Check debug flags appear when appropriate
- [ ] Test scoring with missing data (graceful degradation)
- [ ] Compare scores old vs new system (should be similar for P01/baseline)
- [ ] Test LiveDataViewer displays all 4 module panels (if implemented)

---

## Troubleshooting

### "persona_id not found"
- Ensure scenario includes valid persona_id (P01-P15)
- Check persona library import

### "asr_word_timestamps_missing"
- Update Whisper API call to use `verbose_json`
- Add `timestamp_granularities: ["word"]`

### Scores significantly different from old system
- Expected for high-friction personas (P03, P08, P11)
- For baseline comparison, use P01, P07, or P10
- Review trace to understand score contributions

### Repair events not detected
- Check bot is introducing events at correct turns
- Verify repair patterns match French phrasing
- Review conversation transcript for actual repair attempts

---

## Priority of Truth

When conflicts arise, follow this order:

1. **Current production scoring code** (don't break existing tests)
2. **Versioned module specs** (06 Fluency, 08 Syntax, 09 Confidence, 10 Conversation)
3. **Calibration Console spec** (this enhancement)

If scoring differs significantly, debug with traces and adjust weights/thresholds, not definitions.

---

## Support & Questions

For implementation questions or issues:
1. Check debug flags and recommendations
2. Export trace JSON and review
3. Compare with baseline persona (P01)
4. Consult this migration doc

---

## Version History

- **v1.0** (Jan 2026): Initial Calibration Console release
  - 15 persona presets
  - Unified scoring traces
  - Enhanced metrics for all 4 modules
  - Debug playbook

