/**
 * Comprehensive type system for Calibration Console
 * Persona-based conversation assessment with precise scoring traces
 */

// ============================================================================
// Persona System Types
// ============================================================================

/** Persona parameters (0-3 scale, except emotional_tone which is -2 to +2) */
export interface PersonaParameters {
  cooperativeness: 0 | 1 | 2 | 3;
  verbosity: 0 | 1 | 2 | 3;
  policy_rigidity: 0 | 1 | 2 | 3;
  confusion_rate: 0 | 1 | 2 | 3;
  emotional_tone: -2 | -1 | 0 | 1 | 2;
  initiative: 0 | 1 | 2 | 3;
  speed: 0 | 1 | 2 | 3;
  interruptions: 0 | 1 | 2 | 3;
}

export type PersonaCategory = 'service' | 'workplace' | 'social' | 'admin';

/** Complete persona preset definition */
export interface PersonaPreset {
  id: string; // e.g., "P01", "P03"
  name: string;
  category: PersonaCategory;
  parameters: PersonaParameters;
  behavior_notes: string;
  best_for: string;
}

// ============================================================================
// Repair Event System
// ============================================================================

export type RepairEventType = 'E1' | 'E2' | 'E3' | 'E4' | 'E5';

export interface RepairEvent {
  event_id: RepairEventType;
  event_type: string; // Human-readable: "Misheard number/date", etc.
  introduced_turn: number;
  resolved_turn: number | null;
  resolution_evidence_snippet?: string;
}

/** Planned repair event for scenario */
export interface PlannedRepairEvent {
  event_id: RepairEventType;
  trigger_turn: number; // When to introduce
  description: string;
}

// ============================================================================
// Conversation Turn Types
// ============================================================================

export type ConversationMove = 
  | 'QUESTION'
  | 'PROPOSAL'
  | 'CONFIRMATION'
  | 'PARAPHRASE'
  | 'SUMMARY'
  | 'REPAIR_INIT'
  | 'REPAIR_EXEC'
  | 'CLOSING'
  | 'OTHER';

export interface ConversationMoveTag {
  move: ConversationMove;
  snippet: string;
}

// ============================================================================
// Scoring Trace Types
// ============================================================================

/** Fluency metrics for a user turn */
export interface FluencyMetrics {
  word_count_non_filler: number;
  speaking_time_sec: number;
  articulation_wpm: number;
  gross_wpm?: number;
  pause_count: number;
  pause_total_sec: number;
  pause_ratio: number;
  long_pause_count: number; // > 1.2s
  max_pause_sec: number;
  pause_list?: Array<{ start: number; duration: number }>;
}

/** Syntax target IDs with weights */
export type SyntaxTargetId = 'PC' | 'FP' | 'OP' | 'Q' | 'C';

export interface SyntaxTag {
  target_id: SyntaxTargetId;
  snippet: string;
  turn?: number;
  quality: 'clear' | 'maybe' | 'incorrect';
}

export interface SyntaxCoverage {
  count: number;
  coverage_score: number; // 0.0 to 1.0
}

/** Confidence signal types */
export type ConfidenceSignalType = 
  | 'ownership'
  | 'boundary'
  | 'minimizing'
  | 'engagement'
  | 'structure'
  | 'repair'
  | 'confidence_language';

export interface ConfidenceSignal {
  type: ConfidenceSignalType;
  snippet: string;
  turn?: number;
}

/** Turn-level trace data */
export interface TurnTrace {
  turn: number;
  speaker: 'user' | 'agent';
  transcript: string;
  audio_ref?: string;
  timestamp?: string;
  
  // Fluency (if user turn with audio)
  fluency_metrics?: FluencyMetrics;
  
  // Syntax tags
  syntax_tags?: SyntaxTag[];
  
  // Conversation moves
  conversation_moves?: ConversationMoveTag[];
  
  // Confidence signals
  confidence_signals?: ConfidenceSignal[];
  
  // Agent metadata
  agent_metadata?: {
    word_count: number;
    question_asked: boolean;
    repair_event_introduced?: RepairEventType;
    hint_given?: boolean;
  };
}

// ============================================================================
// Score Breakdown Types
// ============================================================================

export interface FluencyScore {
  score: number; // 0-100
  speed: number; // 0-60
  pause: number; // 0-40
  speed_band?: string; // e.g., "120-140 WPM"
  pause_explanation?: string;
}

export interface SyntaxScore {
  score: number; // 0-100
  PC: number; // 0-25
  FP: number; // 0-15
  OP: number; // 0-25
  Q: number; // 0-15
  C: number; // 0-20
  coverage?: Record<SyntaxTargetId, SyntaxCoverage>;
}

export interface ConversationScore {
  score: number; // 0-100
  comprehension: number; // 0-50
  repair: number; // 0-30
  flow: number; // 0-20
  
  // Debug metrics
  comprehension_metrics?: {
    answers_prompt_rate: number;
    detail_tracking_hits: number;
    slot_coverage: number;
  };
  repair_metrics?: {
    repair_events_total: number;
    repair_events_resolved: number;
    repair_initiations: number;
    repair_completions: number;
  };
  flow_metrics?: {
    questions_count: number;
    proposals_count: number;
    closings_count: number;
    passive_lead_success?: boolean;
  };
}

export interface ConfidenceScore {
  speaking: number; // 0-100
  self: number; // 0-100
  final: number; // 0-100 (50% speaking + 50% self)
  
  // Rubric breakdown
  rubric?: {
    length_development: number; // 0-25
    assertiveness_ownership: number; // 0-25
    emotional_engagement: number; // 0-20
    clarity_control: number; // 0-15
    confidence_language: number; // 0-15
  };
  
  // Signal counts for debugging
  signal_counts?: {
    ownership_count: number;
    boundary_count: number;
    minimizing_count: number;
    engagement_count: number;
    structure_count: number;
  };
}

// ============================================================================
// Unified Scoring Trace
// ============================================================================

export interface ScoringTrace {
  meta: {
    session_id: string;
    scenario_id: string;
    persona_id: string;
    tiers?: { A?: number; B?: number; C?: number };
    versions: {
      fluency: string;
      syntax: string;
      confidence: string;
      conversation: string;
    };
    created_at: string;
  };
  
  turns: TurnTrace[];
  repair_events: RepairEvent[];
  
  scores: {
    fluency?: FluencyScore;
    syntax?: SyntaxScore;
    conversation?: ConversationScore;
    confidence?: ConfidenceScore;
  };
  
  debug_flags: string[];
}

// ============================================================================
// Enhanced Scenario Types
// ============================================================================

export interface EnhancedScenarioConfig {
  id: string;
  title: string;
  goal: string;
  slots: Record<string, string | null>;
  persona_id: string;
  tier: 1 | 2 | 3;
  planned_repair_events: PlannedRepairEvent[];
  end_conditions: string[];
  context?: string; // Additional context for the agent
}

// ============================================================================
// Agent Response Types
// ============================================================================

export interface AgentTurnResponse {
  agentResponse: string;
  repair_event_introduced?: RepairEventType;
  hint_given?: boolean;
  turn_metadata: {
    agent_word_count: number;
    question_asked: boolean;
  };
}

// ============================================================================
// Universal Rules State
// ============================================================================

export interface UniversalRulesState {
  silent_turns_count: number; // Track consecutive silent/short user turns
  hint_given: boolean;
  off_topic_redirect_used: boolean;
  repair_events_introduced: RepairEventType[];
}

// ============================================================================
// Module Versions (for trace versioning)
// ============================================================================

export const MODULE_VERSIONS = {
  fluency: '06.1',
  syntax: '08.1',
  confidence: '09.1',
  conversation: '10.1',
} as const;

