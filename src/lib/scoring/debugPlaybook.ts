/**
 * Debug Playbook - Automated Diagnostics
 * Provides recommendations based on debug flags
 */

// ============================================================================
// Debug Flag Definitions
// ============================================================================

export interface DebugRecommendation {
  flag: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  checks: string[];
  recommendations: string[];
}

// ============================================================================
// Fluency Debug Flags
// ============================================================================

export const FLUENCY_DEBUG_PLAYBOOK: Record<string, DebugRecommendation> = {
  asr_word_timestamps_missing: {
    flag: 'asr_word_timestamps_missing',
    severity: 'error',
    title: 'Word Timestamps Missing',
    description: 'Whisper API did not return word-level timestamps, preventing accurate pause detection',
    checks: [
      'Check Whisper API call uses verbose_json format',
      'Verify timestamp_granularities includes "word"',
      'Check API response structure',
    ],
    recommendations: [
      'Update transcription call to use verbose_json',
      'Add timestamp_granularities: ["word"] parameter',
      'Fall back to simple WPM calculation if timestamps unavailable',
    ],
  },
  
  filler_filter_removed_too_much: {
    flag: 'filler_filter_removed_too_much',
    severity: 'warning',
    title: 'Excessive Filler Removal',
    description: 'Filler filter removed >30% of words, may indicate over-aggressive filtering',
    checks: [
      'Review filler word list',
      'Check word count before/after filtering',
      'Inspect ASR transcript for false positives',
    ],
    recommendations: [
      'Review and refine filler list',
      'Consider contextual filler detection',
      'Show filler ratio in debug view',
    ],
  },
  
  pause_inflation_noise: {
    flag: 'pause_inflation_noise',
    severity: 'warning',
    title: 'Pause Inflation from Noise',
    description: 'VAD may be detecting background noise as speech, inflating pause detection',
    checks: [
      'Compare VAD segments vs word timestamp gaps',
      'Inspect audio for background noise/clipping',
      'Check VAD threshold settings',
    ],
    recommendations: [
      'Use word timestamp gaps as primary pause source',
      'Implement noise gate in audio processing',
      'Suggest quieter recording environment to user',
    ],
  },
};

// ============================================================================
// Syntax Debug Flags
// ============================================================================

export const SYNTAX_DEBUG_PLAYBOOK: Record<string, DebugRecommendation> = {
  asr_correction_suspicion_high: {
    flag: 'asr_correction_suspicion_high',
    severity: 'warning',
    title: 'ASR Auto-Correction Suspected',
    description: 'Advanced grammatical forms appear in very short transcript, may be ASR auto-correction',
    checks: [
      'Inspect raw ASR transcript',
      'Compare with audio if available',
      'Check for isolated advanced forms without context',
    ],
    recommendations: [
      'Flag for manual review',
      'Consider confidence scoring adjustment',
      'Use median-of-3 scoring for validation',
    ],
  },
  
  no_evidence_for_claim: {
    flag: 'no_evidence_for_claim',
    severity: 'error',
    title: 'Missing Evidence Snippets',
    description: 'LLM returned tags without evidence snippets',
    checks: [
      'Verify LLM prompt requires snippets',
      'Check function schema enforces snippet field',
      'Inspect LLM output structure',
    ],
    recommendations: [
      'Update prompt: "Must provide exact phrase from transcript"',
      'Make snippet field required in function schema',
      'Reject tags without evidence',
    ],
  },
  
  drift_detected: {
    flag: 'drift_detected',
    severity: 'warning',
    title: 'Scoring Drift Detected',
    description: 'Median-of-3 scoring shows significant variance',
    checks: [
      'Inspect individual scores',
      'Check for prompt non-determinism',
      'Review temperature settings',
    ],
    recommendations: [
      'Lower temperature (0.3 or less)',
      'Add more constraints to prompt',
      'Use function calling for structured output',
    ],
  },
};

// ============================================================================
// Conversation Debug Flags
// ============================================================================

export const CONVERSATION_DEBUG_PLAYBOOK: Record<string, DebugRecommendation> = {
  off_topic_suspicion: {
    flag: 'off_topic_suspicion',
    severity: 'warning',
    title: 'Off-Topic Suspicion',
    description: 'User responses may be off-topic',
    checks: [
      'Review conversation transcript',
      'Check scenario goal alignment',
      'Verify off-topic detection isn\'t too aggressive',
    ],
    recommendations: [
      'Be conservative with off-topic detection',
      'Allow tangential but related responses',
      'Note in scoring but don\'t over-penalize',
    ],
  },
  
  repair_event_unresolved: {
    flag: 'repair_event_unresolved',
    severity: 'info',
    title: 'Unresolved Repair Events',
    description: 'Some planned repair events were not resolved',
    checks: [
      'Identify which events remain unresolved',
      'Check resolution detection logic',
      'Review user turns for repair attempts',
    ],
    recommendations: [
      'Show which events in repair table',
      'Highlight in conversation transcript',
      'Consider time constraints (may not be user fault)',
    ],
  },
  
  bot_event_log_missing: {
    flag: 'bot_event_log_missing',
    severity: 'error',
    title: 'Bot Event Log Missing',
    description: 'Cannot score repair accurately without bot event log',
    checks: [
      'Verify bot logs repair event introductions',
      'Check event log passed to scorer',
      'Inspect conversation state',
    ],
    recommendations: [
      'Ensure bot tracks all repair events introduced',
      'Pass repair events to scoring function',
      'Fall back to pattern-based detection only',
    ],
  },
};

// ============================================================================
// Confidence Debug Flags
// ============================================================================

export const CONFIDENCE_DEBUG_PLAYBOOK: Record<string, DebugRecommendation> = {
  evidence_missing_for_confidence_signal: {
    flag: 'evidence_missing_for_confidence_signal',
    severity: 'warning',
    title: 'Confidence Signal Evidence Missing',
    description: 'Confidence language detected but no ownership signals found',
    checks: [
      'Review signal detection patterns',
      'Check for cultural/contextual differences',
      'Verify ownership signals list is comprehensive',
    ],
    recommendations: [
      'Expand ownership signal patterns',
      'Consider indirect ownership expressions',
      'Show actual phrases detected for validation',
    ],
  },
  
  over_penalizing_softeners: {
    flag: 'over_penalizing_softeners',
    severity: 'warning',
    title: 'Over-Penalizing Polite Hedges',
    description: 'Polite hedges (je pense, etc.) flagged too harshly',
    checks: [
      'Review hedging signal list',
      'Check penalty thresholds',
      'Consider French politeness norms',
    ],
    recommendations: [
      'Distinguish "je pense" (normal) from excessive hedging',
      'Only penalize if >3 hedges in short response',
      'Balance politeness vs confidence scoring',
    ],
  },
  
  questionnaire_not_completed: {
    flag: 'questionnaire_not_completed',
    severity: 'error',
    title: 'Questionnaire Incomplete',
    description: 'Self-assessment questionnaire not completed, final score invalid',
    checks: [
      'Verify questionnaire completion',
      'Check self-assessment score exists',
      'Review module flow',
    ],
    recommendations: [
      'Block scoring until questionnaire complete',
      'Show questionnaire completion status',
      'Use speaking score only as fallback',
    ],
  },
};

// ============================================================================
// Playbook Aggregation
// ============================================================================

export const FULL_DEBUG_PLAYBOOK: Record<string, DebugRecommendation> = {
  ...FLUENCY_DEBUG_PLAYBOOK,
  ...SYNTAX_DEBUG_PLAYBOOK,
  ...CONVERSATION_DEBUG_PLAYBOOK,
  ...CONFIDENCE_DEBUG_PLAYBOOK,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get recommendations for a debug flag
 */
export function getRecommendation(flag: string): DebugRecommendation | null {
  return FULL_DEBUG_PLAYBOOK[flag] || null;
}

/**
 * Get all recommendations for a list of flags
 */
export function getRecommendations(flags: string[]): DebugRecommendation[] {
  return flags.map(flag => getRecommendation(flag)).filter(Boolean) as DebugRecommendation[];
}

/**
 * Group recommendations by severity
 */
export function groupBySeverity(recommendations: DebugRecommendation[]): {
  errors: DebugRecommendation[];
  warnings: DebugRecommendation[];
  info: DebugRecommendation[];
} {
  return {
    errors: recommendations.filter(r => r.severity === 'error'),
    warnings: recommendations.filter(r => r.severity === 'warning'),
    info: recommendations.filter(r => r.severity === 'info'),
  };
}

/**
 * Format recommendations as text
 */
export function formatRecommendations(flags: string[]): string {
  if (flags.length === 0) {
    return 'No debug flags detected. All systems nominal.';
  }
  
  const recommendations = getRecommendations(flags);
  const grouped = groupBySeverity(recommendations);
  
  const sections: string[] = [];
  
  if (grouped.errors.length > 0) {
    sections.push('ERRORS:\n' + grouped.errors.map(r => 
      `  • ${r.title}\n    ${r.description}`
    ).join('\n\n'));
  }
  
  if (grouped.warnings.length > 0) {
    sections.push('WARNINGS:\n' + grouped.warnings.map(r => 
      `  • ${r.title}\n    ${r.description}`
    ).join('\n\n'));
  }
  
  if (grouped.info.length > 0) {
    sections.push('INFO:\n' + grouped.info.map(r => 
      `  • ${r.title}\n    ${r.description}`
    ).join('\n\n'));
  }
  
  return sections.join('\n\n');
}

/**
 * Get quick fix suggestions
 */
export function getQuickFixes(flag: string): string[] {
  const recommendation = getRecommendation(flag);
  return recommendation?.recommendations || [];
}

/**
 * Check if flag is critical (blocks scoring)
 */
export function isCritical(flag: string): boolean {
  const recommendation = getRecommendation(flag);
  return recommendation?.severity === 'error';
}

/**
 * Get all known debug flags (for autocomplete/docs)
 */
export function getAllKnownFlags(): string[] {
  return Object.keys(FULL_DEBUG_PLAYBOOK);
}

