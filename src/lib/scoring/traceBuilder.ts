/**
 * Scoring Trace Builder
 * Utilities to build and manage unified scoring traces
 */

import type {
  ScoringTrace,
  TurnTrace,
  RepairEvent,
  FluencyScore,
  SyntaxScore,
  ConversationScore,
  ConfidenceScore,
  MODULE_VERSIONS,
} from '@/components/assessment/conversation/types';

// ============================================================================
// Trace Initialization
// ============================================================================

/**
 * Initialize a new scoring trace
 */
export function initTrace(
  sessionId: string,
  scenarioId: string,
  personaId: string,
  tiers?: { A?: number; B?: number; C?: number },
  versions?: Partial<typeof MODULE_VERSIONS>
): ScoringTrace {
  const defaultVersions = {
    fluency: '06.1',
    syntax: '08.1',
    confidence: '09.1',
    conversation: '10.1',
  };
  
  return {
    meta: {
      session_id: sessionId,
      scenario_id: scenarioId,
      persona_id: personaId,
      tiers: tiers || {},
      versions: { ...defaultVersions, ...versions },
      created_at: new Date().toISOString(),
    },
    turns: [],
    repair_events: [],
    scores: {},
    debug_flags: [],
  };
}

// ============================================================================
// Turn Management
// ============================================================================

/**
 * Add a turn to the trace
 */
export function addTurn(
  trace: ScoringTrace,
  turnData: TurnTrace
): ScoringTrace {
  return {
    ...trace,
    turns: [...trace.turns, turnData],
  };
}

/**
 * Update an existing turn (e.g., add metrics after processing)
 */
export function updateTurn(
  trace: ScoringTrace,
  turnNumber: number,
  updates: Partial<TurnTrace>
): ScoringTrace {
  const turns = trace.turns.map(turn =>
    turn.turn === turnNumber ? { ...turn, ...updates } : turn
  );
  
  return {
    ...trace,
    turns,
  };
}

/**
 * Get turn by number
 */
export function getTurn(trace: ScoringTrace, turnNumber: number): TurnTrace | undefined {
  return trace.turns.find(t => t.turn === turnNumber);
}

/**
 * Get all user turns
 */
export function getUserTurns(trace: ScoringTrace): TurnTrace[] {
  return trace.turns.filter(t => t.speaker === 'user');
}

/**
 * Get all agent turns
 */
export function getAgentTurns(trace: ScoringTrace): TurnTrace[] {
  return trace.turns.filter(t => t.speaker === 'agent');
}

// ============================================================================
// Repair Event Management
// ============================================================================

/**
 * Add a repair event to the trace
 */
export function addRepairEvent(
  trace: ScoringTrace,
  event: RepairEvent
): ScoringTrace {
  return {
    ...trace,
    repair_events: [...trace.repair_events, event],
  };
}

/**
 * Mark repair event as resolved
 */
export function resolveRepairEvent(
  trace: ScoringTrace,
  eventId: string,
  resolvedTurn: number,
  evidence?: string
): ScoringTrace {
  const repair_events = trace.repair_events.map(event =>
    event.event_id === eventId
      ? {
          ...event,
          resolved_turn: resolvedTurn,
          resolution_evidence_snippet: evidence,
        }
      : event
  );
  
  return {
    ...trace,
    repair_events,
  };
}

/**
 * Get unresolved repair events
 */
export function getUnresolvedRepairEvents(trace: ScoringTrace): RepairEvent[] {
  return trace.repair_events.filter(e => e.resolved_turn === null);
}

// ============================================================================
// Score Management
// ============================================================================

/**
 * Add fluency score to trace
 */
export function addFluencyScore(
  trace: ScoringTrace,
  score: FluencyScore
): ScoringTrace {
  return {
    ...trace,
    scores: {
      ...trace.scores,
      fluency: score,
    },
  };
}

/**
 * Add syntax score to trace
 */
export function addSyntaxScore(
  trace: ScoringTrace,
  score: SyntaxScore
): ScoringTrace {
  return {
    ...trace,
    scores: {
      ...trace.scores,
      syntax: score,
    },
  };
}

/**
 * Add conversation score to trace
 */
export function addConversationScore(
  trace: ScoringTrace,
  score: ConversationScore
): ScoringTrace {
  return {
    ...trace,
    scores: {
      ...trace.scores,
      conversation: score,
    },
  };
}

/**
 * Add confidence score to trace
 */
export function addConfidenceScore(
  trace: ScoringTrace,
  score: ConfidenceScore
): ScoringTrace {
  return {
    ...trace,
    scores: {
      ...trace.scores,
      confidence: score,
    },
  };
}

// ============================================================================
// Debug Flags Management
// ============================================================================

/**
 * Add a debug flag
 */
export function addDebugFlag(
  trace: ScoringTrace,
  flag: string
): ScoringTrace {
  // Avoid duplicates
  if (trace.debug_flags.includes(flag)) {
    return trace;
  }
  
  return {
    ...trace,
    debug_flags: [...trace.debug_flags, flag],
  };
}

/**
 * Add multiple debug flags
 */
export function addDebugFlags(
  trace: ScoringTrace,
  flags: string[]
): ScoringTrace {
  const uniqueFlags = [...new Set([...trace.debug_flags, ...flags])];
  
  return {
    ...trace,
    debug_flags: uniqueFlags,
  };
}

// ============================================================================
// Trace Analysis
// ============================================================================

/**
 * Get trace summary statistics
 */
export function getTraceSummary(trace: ScoringTrace) {
  return {
    total_turns: trace.turns.length,
    user_turns: getUserTurns(trace).length,
    agent_turns: getAgentTurns(trace).length,
    repair_events_total: trace.repair_events.length,
    repair_events_resolved: trace.repair_events.filter(e => e.resolved_turn !== null).length,
    debug_flags_count: trace.debug_flags.length,
    has_fluency_score: !!trace.scores.fluency,
    has_syntax_score: !!trace.scores.syntax,
    has_conversation_score: !!trace.scores.conversation,
    has_confidence_score: !!trace.scores.confidence,
  };
}

/**
 * Validate trace completeness
 */
export function validateTrace(trace: ScoringTrace): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required metadata
  if (!trace.meta.session_id) errors.push('Missing session_id');
  if (!trace.meta.scenario_id) errors.push('Missing scenario_id');
  if (!trace.meta.persona_id) errors.push('Missing persona_id');
  
  // Check turns
  if (trace.turns.length === 0) {
    warnings.push('No turns recorded');
  }
  
  // Check for turn number gaps
  const turnNumbers = trace.turns.map(t => t.turn).sort((a, b) => a - b);
  for (let i = 1; i < turnNumbers.length; i++) {
    if (turnNumbers[i] !== turnNumbers[i - 1] + 1) {
      warnings.push(`Gap in turn numbers: ${turnNumbers[i - 1]} to ${turnNumbers[i]}`);
    }
  }
  
  // Check repair events
  const unresolvedEvents = getUnresolvedRepairEvents(trace);
  if (unresolvedEvents.length > 0) {
    warnings.push(`${unresolvedEvents.length} repair events unresolved`);
  }
  
  // Check scores
  if (Object.keys(trace.scores).length === 0) {
    warnings.push('No scores recorded');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Trace Finalization
// ============================================================================

/**
 * Finalize trace (perform validation and return complete JSON)
 */
export function finalizeTrace(trace: ScoringTrace): {
  trace: ScoringTrace;
  validation: ReturnType<typeof validateTrace>;
  summary: ReturnType<typeof getTraceSummary>;
} {
  const validation = validateTrace(trace);
  const summary = getTraceSummary(trace);
  
  return {
    trace,
    validation,
    summary,
  };
}

// ============================================================================
// Trace Serialization
// ============================================================================

/**
 * Convert trace to JSON string
 */
export function traceToJSON(trace: ScoringTrace, pretty: boolean = true): string {
  return JSON.stringify(trace, null, pretty ? 2 : 0);
}

/**
 * Parse JSON string to trace
 */
export function traceFromJSON(json: string): ScoringTrace {
  return JSON.parse(json);
}

// ============================================================================
// Trace Comparison (useful for calibration)
// ============================================================================

/**
 * Compare two traces (for calibration analysis)
 */
export function compareTraces(trace1: ScoringTrace, trace2: ScoringTrace) {
  return {
    same_scenario: trace1.meta.scenario_id === trace2.meta.scenario_id,
    same_persona: trace1.meta.persona_id === trace2.meta.persona_id,
    turn_count_diff: trace1.turns.length - trace2.turns.length,
    score_diff: {
      fluency: trace1.scores.fluency && trace2.scores.fluency
        ? trace1.scores.fluency.score - trace2.scores.fluency.score
        : null,
      syntax: trace1.scores.syntax && trace2.scores.syntax
        ? trace1.scores.syntax.score - trace2.scores.syntax.score
        : null,
      conversation: trace1.scores.conversation && trace2.scores.conversation
        ? trace1.scores.conversation.score - trace2.scores.conversation.score
        : null,
      confidence: trace1.scores.confidence && trace2.scores.confidence
        ? trace1.scores.confidence.final - trace2.scores.confidence.final
        : null,
    },
    debug_flags_unique_to_trace1: trace1.debug_flags.filter(
      f => !trace2.debug_flags.includes(f)
    ),
    debug_flags_unique_to_trace2: trace2.debug_flags.filter(
      f => !trace1.debug_flags.includes(f)
    ),
  };
}

