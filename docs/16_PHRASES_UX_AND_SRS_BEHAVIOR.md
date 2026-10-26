# Phrases Feature - UX Behavior & SRS Algorithm Documentation

**Purpose:** This document explains the current behavior of the Phrases (SRS) feature for AI agents planning next steps (v1, v1.5, v2).

**Status:** v0 (UI-first, mock data, local state only)  
**Last Updated:** January 2, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [User Experience Flows](#user-experience-flows)
3. [SRS Algorithm Behavior](#srs-algorithm-behavior)
4. [Data Flow & State Management](#data-flow--state-management)
5. [Current Limitations (v0)](#current-limitations-v0)
6. [Next Steps Planning](#next-steps-planning)

---

## Overview

The Phrases feature is an Anki-like spaced repetition system for learning French phrases. It teaches **syntactic chunks** (not isolated words) to help members speak naturally.

### Key Principles

- **Fast daily sessions** (2-8 minutes)
- **Honest ratings** drive spacing
- **Low friction** - no deck micromanagement
- **Two cognitive skills:**
  - **Recall** (production): See English → say French
  - **Recognition** (comprehension): Hear French → understand meaning

### Current Implementation (v0)

- ✅ UI-first: All pages functional
- ✅ Mock data: 40 phrases across 3 packs
- ✅ Local state: React hooks + localStorage
- ✅ Mock scheduler: Simple interval-based logic
- ❌ No database: All data in browser localStorage
- ❌ No real audio: Mock audio buttons
- ❌ No speech feedback: Mock STT UI only

---

## User Experience Flows

### Flow 1: First-Time User (Empty State)

```
1. User navigates to /phrases (from dashboard sidebar)
   → Sees landing page with empty state
   → Message: "No phrases assigned yet"
   → CTA: "Add a starter pack"

2. User clicks "Add a starter pack"
   → System seeds 10 phrases from "Small talk starter" pack
   → All phrases set to status: "active", scheduler_state: "new"
   → Saved to localStorage
   → Page refreshes, shows stats

3. User sees landing page with stats:
   - Due: 0 (no reviews yet)
   - New: 10
   - Total: 10
   → Primary CTA: "Start a session"
```

**Key Behavior:**
- Empty state shows when `stats.total === 0`
- Seed pack adds 10 phrases, all marked as "new"
- Phrases are immediately available for review

---

### Flow 2: Starting a Session

```
1. User clicks "Start a session" on landing page
   → Navigates to /phrases/session

2. Session hook builds queue:
   - Gets all cards with status: "active"
   - Filters due cards (due_at <= now)
   - Gets new cards (scheduler_state === "new")
   - Limits: new_per_day (default: 20), reviews_per_day (default: 100)
   - Interleaves: 2 reviews, 1 new (if available)

3. Session state initialized:
   - queue: [card1, card2, card3, ...]
   - currentIndex: 0
   - isRevealed: false
   - startTime: Date.now()
   - completed: 0
   - total: queue.length

4. First card displayed:
   - Shows PhraseCard component
   - Mode badge (Recall/Recognition)
   - Prompt (English for recall, audio button for recognition)
   - Optional speech icon (if enabled in settings)
```

**Key Behavior:**
- Queue is built on session start (not pre-computed)
- Queue includes due reviews + new cards (up to limits)
- Session state is ephemeral (not saved until rating)
- If no cards available, redirects to landing with toast

---

### Flow 3: Reviewing a Card (Happy Path)

```
1. Card shown:
   - User sees prompt (English or audio button)
   - startTime recorded
   - User thinks/speaks

2. User clicks "Reveal answer":
   - isRevealed: true
   - revealTime: Date.now()
   - RevealPanel slides up (Framer Motion)
   - Shows: French text, translation (if recognition), tags, difficulty
   - If show_time_to_recall enabled: displays "Revealed after: 4.2s"

3. User rates the card:
   - 4 buttons: Again / Hard / Good / Easy
   - Each shows interval preview on hover: "in 3 days"
   - User clicks rating (e.g., "Good")

4. Rating processed:
   - calculateNextReview() called with card + rating
   - Card state updated:
     * scheduler_state: "new" → "learning" → "review"
     * due_at: new timestamp
     * interval_days: calculated
     * ease_factor: updated
     * reviews: incremented
   - Card saved to localStorage
   - Review log created (with timing data)
   - Toast shown: "Next review: in 3 days"

5. Next card:
   - currentIndex incremented
   - isRevealed: false
   - startTime: Date.now()
   - completed: incremented
   - Card animates out (Framer Motion)
   - Next card animates in
```

**Key Behavior:**
- Time-to-reveal is tracked (startTime → revealTime)
- Rating immediately updates card state
- Card persists to localStorage after rating
- Review log is append-only (for analytics)
- Progress bar updates (completed / total)

---

### Flow 4: Card Actions During Session

```
User clicks actions menu (⋯) on card:

1. "Add note":
   - Dialog opens
   - User types note (e.g., "Remember to use 'tu' with friends")
   - Saved to card.note
   - Card updated in localStorage

2. "Flag issue":
   - Dialog opens with dropdown:
     * Incorrect translation
     * Typo
     * Audio issue
     * Difficulty mismatch
     * Too easy / Too hard
     * Other
   - Optional details textarea
   - Saved to card.flag_reason
   - Toast: "Issue flagged - Thanks for reporting!"

3. "Bury (until tomorrow)":
   - Confirmation dialog
   - Card status: "active" → "buried", paused_reason = "buried", paused_at = now
   - Card removed from queue
   - Next card shown immediately
   - Toast: "Phrase buried - Hidden until tomorrow"
   - Automatic un-bury: whenever the member's cards are loaded (session or
     library) or a session starts, every buried card whose paused_at is on a
     previous local day goes back to "active" (paused_reason/paused_at cleared)
     and the change is persisted. Buried cards with no paused_at (legacy) are
     un-buried too. Logic lives in `utils/bury.ts`; nothing runs server-side.

4. "Suspend":
   - Confirmation dialog
   - Card status: "active" → "suspended"
   - Card removed from queue
   - Next card shown immediately
   - Toast: "Phrase suspended - Hidden indefinitely"

5. "Remove from my set":
   - Confirmation dialog
   - Card status: "active" → "removed"
   - Card removed from queue
   - Next card shown immediately
   - Toast: "Phrase removed - Removed from your set"
```

**Key Behavior:**
- Actions update card immediately
- Bury/suspend/remove remove card from current queue
- All changes persist to localStorage
- Actions don't affect review logs

---

### Flow 5: Session Completion

```
1. User rates last card in queue
   → currentIndex >= queue.length

2. Session complete screen shown:
   - Checkmark icon (green)
   - "Session complete!" heading
   - "You reviewed X phrases. Great work!"
   - Two buttons:
     * "View library" → /phrases/library
     * "Back to phrases" → /phrases

3. Session state cleared:
   - sessionState set to null
   - User can start new session from landing page
```

**Key Behavior:**
- Completion screen is separate component
- Session state is ephemeral (not saved)
- Cards remain in localStorage with updated states
- User can start new session immediately

---

### Flow 6: Library Browsing

```
1. User navigates to /phrases/library
   → Library hook loads all cards from localStorage
   → Enriches with phrase data (from mockPhrasesData)

2. Filters available:
   - Search: Text search across prompt_en, canonical_fr, transcript_fr, translation_en
   - Mode: All / Recall / Recognition
   - Status: All / Active / Buried / Suspended / Removed
   - Due filter: All / Overdue / Today / Future

3. Table displays:
   - Phrase (French + English)
   - Mode badge
   - Tags (first 2, +N if more)
   - Status badge
   - Due badge (Overdue/Today/in Nd/Tomorrow)
   - Reviews count
   - Actions menu (⋯)

4. Row actions:
   - Same as session actions (bury, suspend, remove, flag)
   - Plus: "Reactivate" (if status !== "active")
   - Changes persist immediately
```

**Key Behavior:**
- Filters are client-side (no server)
- Table updates reactively as filters change
- Stats summary at top (total, due, new, learning, suspended, buried)
- All actions update localStorage immediately

---

### Flow 7: Settings Management

```
1. User navigates to /phrases/settings
   → Settings hook loads from localStorage
   → Defaults if not found:
     * new_per_day: 20
     * reviews_per_day: 100
     * target_retention: 0.90
     * speech_feedback_enabled: false
     * auto_assess_enabled: false
     * recognition_shadow_default: false
     * show_time_to_recall: true

2. User adjusts sliders/toggles:
   - Changes save immediately to localStorage
   - Validation: new_per_day (0-50), reviews_per_day (0-200), retention (0.75-0.95)
   - Toast on save: "Settings saved"

3. Settings affect:
   - new_per_day: Limits new cards in session queue
   - reviews_per_day: Limits due reviews in session queue
   - target_retention: Used by scheduler (v0: not fully implemented)
   - speech_feedback_enabled: Shows/hides mic icon in session
   - auto_assess_enabled: Suggests ratings (v0: mock only)
   - recognition_shadow_default: Default for recognition mode
   - show_time_to_recall: Shows/hides timing in RevealPanel
```

**Key Behavior:**
- Settings persist per user (localStorage key includes userId)
- Changes apply immediately (no "Save" button needed)
- Settings affect next session (not current one)
- Reset button restores defaults

---

### Flow 8: Coach View (Mock)

```
1. Admin navigates to /phrases/coach
   → Shows v0 preview notice

2. Member selector:
   - Dropdown with 3 mock members
   - Each has mock stats and settings

3. Viewing member:
   - Stats card: due, new, learning, known recall/recognition
   - Settings form: Same as user settings, but for selected member
   - Pack assignment: 3 packs with "Assign" buttons

4. Actions:
   - Edit member settings (saves locally, shows toast)
   - Assign pack (shows toast, doesn't actually assign)
   - All changes are mock (don't persist)
```

**Key Behavior:**
- Completely UI-only for v0
- No real member data
- No real pack assignment
- Preview of what v1 will do

---

## SRS Algorithm Behavior

### Current Implementation (Mock v0)

The scheduler uses **simple interval-based logic** (not real FSRS). This is a placeholder for v1.

### Algorithm Rules

#### Initial State (New Card)

```typescript
{
  scheduler_state: "new",
  interval_days: 0,
  ease_factor: 2.5,
  repetitions: 0,
  due_at: now (immediately available)
}
```

#### Rating: "Again"

```typescript
// Reset to learning
interval_days: 1
ease_factor: max(1.3, current_ease - 0.2)
scheduler_state: "learning" (or "relearning" if was reviewed)
lapses: incremented
reviews: incremented
due_at: now + 1 day
```

**Behavior:**
- Card is reset to beginning
- Ease factor decreases (harder to remember)
- Due in 1 day

#### Rating: "Hard"

```typescript
// First review
if (interval_days === 0) {
  interval_days: 1
  scheduler_state: "learning"
} else {
  // Subsequent reviews
  interval_days: current_interval * 1.2
  ease_factor: current_ease - 0.15
  scheduler_state: interval >= 21 ? "review" : "learning"
}
reviews: incremented
due_at: now + interval_days
```

**Behavior:**
- First review: 1 day
- Subsequent: 1.2x multiplier (slower growth)
- Ease factor decreases slightly

#### Rating: "Good" (Default)

```typescript
// First review
if (interval_days === 0) {
  interval_days: 3
  scheduler_state: "learning"
} else {
  // Subsequent reviews
  interval_days: current_interval * 2.5
  ease_factor: current_ease (no change)
  scheduler_state: interval >= 21 ? "review" : "learning"
}
reviews: incremented
due_at: now + interval_days
```

**Behavior:**
- First review: 3 days
- Subsequent: 2.5x multiplier (standard growth)
- Ease factor stays same
- Example progression: 3d → 7d → 17d → 42d → 105d

#### Rating: "Easy"

```typescript
// First review
if (interval_days === 0) {
  interval_days: 7
  scheduler_state: "learning"
} else {
  // Subsequent reviews
  interval_days: current_interval * 3.0
  ease_factor: current_ease + 0.15
  scheduler_state: interval >= 21 ? "review" : "learning"
}
reviews: incremented
due_at: now + interval_days
```

**Behavior:**
- First review: 7 days
- Subsequent: 3.0x multiplier (faster growth)
- Ease factor increases (easier to remember)
- Example progression: 7d → 21d → 63d → 189d

### State Transitions

```
"new" → (first rating) → "learning" → (interval >= 21 days) → "review"
                                    ↓
                              (rating: "again") → "relearning"
```

**"Known" Threshold:**
- Card is considered "known" when:
  - `scheduler_state === "review"`
  - `interval_days >= 21`
- Used for stats: "known_recall", "known_recognition"

### Queue Building Logic

```typescript
function buildSessionQueue(cards, newPerDay, reviewsPerDay) {
  // 1. Get due cards (due_at <= now, status === "active")
  const dueCards = getDueCards(cards).slice(0, reviewsPerDay);
  
  // 2. Get new cards (state === "new", status === "active")
  const newCards = getNewCards(cards, newPerDay);
  
  // 3. Interleave: 2 reviews, 1 new (if available)
  const queue = [];
  let dueIndex = 0;
  let newIndex = 0;
  
  while (dueIndex < dueCards.length || newIndex < newCards.length) {
    // Add 2 due cards
    if (dueIndex < dueCards.length) queue.push(dueCards[dueIndex++]);
    if (dueIndex < dueCards.length) queue.push(dueCards[dueIndex++]);
    
    // Add 1 new card
    if (newIndex < newCards.length) queue.push(newCards[newIndex++]);
  }
  
  return queue;
}
```

**Behavior:**
- Prioritizes due reviews (don't want to forget)
- Mixes in new cards (2:1 ratio)
- Respects daily limits
- Sorts due cards by due_at (oldest first)

---

## Data Flow & State Management

### Data Storage (localStorage)

**Keys:**
- `solv_phrases_cards_${userId}` - Array of MemberPhraseCard
- `solv_phrases_settings_${userId}` - PhraseSettings object
- `solv_phrases_logs_${userId}` - Array of PhraseReviewLog

**Card Structure:**
```typescript
{
  id: "card-uuid",
  member_id: "user-id",
  phrase_id: "phrase-001",
  status: "active" | "buried" | "suspended" | "removed",
  scheduler: {
    algorithm: "sm2", // v0 uses simple SM-2-like logic
    state: "new" | "learning" | "review" | "relearning",
    due_at: "2026-01-05T10:00:00Z",
    interval_days: 3,
    ease_factor: 2.5,
    repetitions: 1
  },
  lapses: 0,
  reviews: 1,
  note: "optional note",
  flag_reason: "optional flag",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z"
}
```

### State Management Hooks

**usePhrasesSession:**
- Manages session state (queue, currentIndex, isRevealed)
- Handles ratings (updates card, saves to localStorage)
- Handles actions (bury, suspend, remove, flag, note)
- Creates review logs
- Calculates time estimates

**usePhrasesLibrary:**
- Loads all cards from localStorage
- Filters by search, mode, status, due date
- Calculates stats (total, due, new, learning, etc.)
- Handles bulk actions

**usePhrasesSettings:**
- Loads settings from localStorage
- Provides defaults if not found
- Validates on update
- Persists immediately

### Data Flow Diagram

```
User Action → Hook → Update State → Save to localStorage → UI Updates

Example: Rating a card
1. User clicks "Good"
2. usePhrasesSession.rateCard() called
3. calculateNextReview() updates card state
4. Card saved to localStorage
5. Review log created and saved
6. Session state updated (next card)
7. UI re-renders with new card
```

---

## Current Limitations (v0)

### What Works ✅

- All UI pages functional
- Session flow complete (reveal, rate, next)
- Library browsing and filtering
- Settings management
- Card actions (bury, suspend, remove, flag, note)
- Stats calculation
- localStorage persistence
- Mock scheduler (simple intervals)

### What Doesn't Work ❌

**Database:**
- No Supabase integration
- All data in browser localStorage only
- No multi-device sync
- Data lost if localStorage cleared

**Audio:**
- Audio buttons are disabled
- No real TTS (text-to-speech)
- No audio playback
- Recognition mode shows "Audio coming in v1" badge

**Speech Feedback:**
- Mic button shows mock UI only
- No real STT (speech-to-text)
- Mock transcript with 95% similarity
- No real token matching
- "Mock (v0)" badge shown

**Scheduler:**
- Simple interval logic (not FSRS)
- No target retention implementation
- No short-term learning steps
- No card difficulty optimization
- No user-specific adaptation

**Content:**
- Only 40 hard-coded phrases
- No pack assignment system
- No coach assignment (DB writes)
- No phrase creation/editing

**Analytics:**
- Review logs stored locally only
- No server-side analytics
- No progress tracking across devices
- No streak calculation

**Multi-user:**
- Coach view is completely mock
- No real member data
- No pack assignment persistence
- No coach permissions

---

## Next Steps Planning

### v1: Database + Real Scheduler

**Priority: HIGH**

**Database Schema:**
- `phrases` table (canonical phrase content)
- `phrase_packs` table (curated sets)
- `member_phrase_cards` table (per-member card state)
- `member_phrase_settings` table (per-member settings)
- `phrase_review_logs` table (append-only logs)
- `member_phrase_packs` table (assignments)

**Migration Tasks:**
1. Create Supabase migration with all tables
2. Add RLS policies (members see own data, coaches see assigned members)
3. Seed initial phrases and packs
4. Migrate localStorage data to Supabase (one-time script)

**Scheduler Upgrade:**
1. Install `ts-fsrs` library (TypeScript FSRS implementation)
2. Replace `schedulerMock.ts` with real FSRS
3. Implement target retention (from settings)
4. Add short-term learning steps (optional)
5. Store FSRS state (stability, difficulty) in card

**API Integration:**
1. Create React Query hooks for:
   - `usePhrasesCards()` - Load cards from Supabase
   - `usePhrasesSettings()` - Load/save settings
   - `usePhrasesSession()` - Build queue from DB
   - `usePhrasesLibrary()` - Filter cards from DB
2. Replace localStorage calls with Supabase queries
3. Add optimistic updates
4. Handle offline/online sync

**Testing:**
- Test with real Supabase data
- Verify RLS policies work
- Test multi-user scenarios
- Test coach assignments

---

### v1.5: Speech Feedback

**Priority: MEDIUM**

**Audio Playback:**
1. Generate TTS audio for recognition phrases
   - Use existing `french-tts` Edge Function
   - Store audio in Supabase Storage
   - Update phrases with `audio_url`
2. Implement audio player component
   - Use HTML5 Audio API
   - Handle iOS Safari restrictions (user gesture required)
   - Add playback controls (play, pause, replay)

**Speech Recognition:**
1. Implement browser Speech Recognition (Web Speech API)
   - Fallback to Edge Function if not available
   - Use existing `transcribe-pronunciation` or create `transcribe-phrase`
2. Create grading logic
   - Tokenize French text
   - Compare user transcript to acceptable answers
   - Calculate similarity score
   - Highlight matched/missing tokens
3. Update SpeechFeedbackPanel
   - Show real transcript
   - Show token diff (green = matched, red = missing)
   - Show similarity percentage

**Auto-Assess (Beta):**
1. Create `suggest-rating` Edge Function
   - Input: similarity, response_time_ms, mode
   - Output: suggested_rating, reason
2. Update RatingButtons
   - Show suggested rating (highlighted)
   - Allow override
   - Save auto_assessed flag in log

**Testing:**
- Test on iOS Safari (audio restrictions)
- Test on Android Chrome
- Test with various accents
- Test token matching accuracy

---

### v2: Content System + Coach Tools

**Priority: LOW**

**Phrase Packs:**
1. Seed packs by goal/conversation
   - Small talk (done)
   - Work + logistics (done)
   - Emotional reactions (done)
   - Add more: Travel, Restaurant, Shopping, etc.
2. Pack assignment UI
   - Coach can assign packs to members
   - Members see assigned packs
   - Auto-create cards when pack assigned

**Coach Tools:**
1. Real member selector
   - Query Supabase for coached members
   - Use `is_coach_for_member()` helper
2. Member stats dashboard
   - Due today, streak, known phrases
   - Review history charts
   - Progress over time
3. Pack management
   - Create custom packs
   - Edit pack contents
   - Assign/unassign packs

**Phrase Management:**
1. Create/edit phrases (admin only)
2. Tag management
3. Difficulty adjustment
4. Acceptable answers editing

**Analytics:**
1. Server-side review log analysis
2. Retention curves
3. Difficulty tracking
4. Member progress reports

---

## Key Decisions for Next AI Agent

### When Implementing v1:

1. **Migration Strategy:**
   - Create migration script to move localStorage → Supabase
   - Run on first v1 deployment
   - Handle users who already have data

2. **FSRS Library Choice:**
   - Use `ts-fsrs` (pure TypeScript, easy to integrate)
   - Or `fsrs-rs-nodejs` (faster, but native bindings)
   - Recommendation: Start with `ts-fsrs`

3. **RLS Policy Design:**
   - Members: SELECT/UPDATE own cards, INSERT own logs
   - Coaches: SELECT cards for assigned members, UPDATE settings
   - Admins: Full access

4. **Queue Building:**
   - Build queue server-side (Edge Function)?
   - Or client-side (React Query)?
   - Recommendation: Client-side for now (simpler)

5. **Offline Support:**
   - v1: Online only (Supabase requires connection)
   - v2: Add offline queue, sync when online

### When Implementing v1.5:

1. **Audio Storage:**
   - Supabase Storage bucket: `phrase-audio`
   - Generate on-demand or pre-generate?
   - Recommendation: Pre-generate for all phrases

2. **STT Fallback:**
   - Browser Speech API → Edge Function → Error
   - Handle gracefully (show "Speech not available")

3. **Grading Accuracy:**
   - Start simple (exact match, then fuzzy)
   - Add accent normalization
   - Handle multiple acceptable answers

### When Implementing v2:

1. **Pack System:**
   - Packs are collections of phrase_ids
   - Assignment creates cards for all phrases in pack
   - Handle duplicates (don't create duplicate cards)

2. **Coach Permissions:**
   - Need `coach_members` table or similar
   - Or use existing `app_accounts` table
   - Implement `is_coach_for_member()` helper

---

## Testing Checklist for Next Agent

When implementing v1:

- [ ] Supabase tables created with correct schema
- [ ] RLS policies tested (member can't see other member's cards)
- [ ] Migration script works (localStorage → Supabase)
- [ ] FSRS library integrated correctly
- [ ] Queue building works with real data
- [ ] Settings persist to database
- [ ] Review logs saved to database
- [ ] Coach view loads real member data
- [ ] Multi-device sync works (test on 2 browsers)

When implementing v1.5:

- [ ] Audio playback works on iOS Safari
- [ ] Audio playback works on Android Chrome
- [ ] STT works with browser Speech API
- [ ] STT fallback to Edge Function works
- [ ] Token matching is accurate
- [ ] Auto-assess suggestions are reasonable
- [ ] Speech feedback UI is responsive

---

## Summary

**Current State (v0):**
- Fully functional UI with mock data
- Simple interval-based scheduler
- localStorage persistence
- All user flows working

**Next Steps:**
1. **v1:** Add Supabase + real FSRS scheduler
2. **v1.5:** Add real audio + speech feedback
3. **v2:** Add content system + coach tools

**Key Files to Modify:**
- `src/features/phrases/hooks/*.ts` - Replace localStorage with Supabase
- `src/features/phrases/data/schedulerMock.ts` - Replace with FSRS
- `supabase/migrations/` - Add new migration
- `src/features/phrases/components/PhraseCard.tsx` - Add real audio player
- `src/features/phrases/components/SpeechFeedbackPanel.tsx` - Add real STT

**Estimated Effort:**
- v1: 2-3 days (database + scheduler)
- v1.5: 2-3 days (audio + STT)
- v2: 3-5 days (content system + coach tools)

---

**This document should be updated as features are implemented.**

