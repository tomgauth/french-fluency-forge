/**
 * Confidence Evaluation - Observable-Based Rubric Scoring
 * Implements 5-part rubric with evidence
 */

import { detectAllSignals, countSignalsByType, getEvidenceForType, isOverMinimizing } from './confidenceSignals';
import type { ConfidenceScore } from '@/components/assessment/conversation/types';

// ============================================================================
// Rubric Scoring
// ============================================================================

/**
 * A) Length / Development (0-25)
 * Based on speech time and content units
 */
export function scoreLengthDevelopment(
  answerSeconds: number,
  contentUnits: number
): { score: number; band: string } {
  let score = 0;
  let band = '';
  
  // Scoring bands
  if (contentUnits >= 3 && answerSeconds >= 60) {
    score = 25;
    band = 'Multi-point development + closure';
  } else if (contentUnits >= 2 && answerSeconds >= 40) {
    score = 19;
    band = 'Some development, 2+ ideas';
  } else if (contentUnits >= 1 && answerSeconds >= 20) {
    score = 11;
    band = 'Some content, 1-2 ideas';
  } else {
    score = 5;
    band = 'Very short, minimal development';
  }
  
  return { score, band };
}

/**
 * B) Assertiveness / Ownership (0-25)
 * Based on ownership, boundary, and minimizing signals
 */
export function scoreAssertivenessOwnership(
  ownershipCount: number,
  boundaryCount: number,
  minimizingCount: number
): { score: number; explanation: string } {
  let score = 0;
  const parts: string[] = [];
  
  // Ownership signals (0-15)
  if (ownershipCount >= 3) {
    score += 15;
    parts.push('strong ownership');
  } else if (ownershipCount >= 2) {
    score += 12;
    parts.push('good ownership');
  } else if (ownershipCount >= 1) {
    score += 8;
    parts.push('some ownership');
  } else {
    score += 0;
    parts.push('no ownership');
  }
  
  // Boundary setting (0-5)
  if (boundaryCount >= 1) {
    score += 5;
    parts.push('sets boundaries');
  }
  
  // Minimizing penalty (0-5 reduction)
  if (minimizingCount > 2) {
    score = Math.max(0, score - 5);
    parts.push('frequent minimizing');
  }
  
  const explanation = parts.join(', ');
  return { score: Math.min(25, score), explanation };
}

/**
 * C) Emotional Engagement (0-20)
 * Based on feelings and empathy signals
 */
export function scoreEmotionalEngagement(
  engagementCount: number
): { score: number; level: string } {
  let score = 0;
  let level = '';
  
  if (engagementCount >= 3) {
    score = 20;
    level = 'High engagement';
  } else if (engagementCount >= 2) {
    score = 15;
    level = 'Good engagement';
  } else if (engagementCount >= 1) {
    score = 10;
    level = 'Some engagement';
  } else {
    score = 5;
    level = 'Minimal engagement';
  }
  
  return { score, level };
}

/**
 * D) Clarity / Control (0-15)
 * Based on structure and repair signals
 */
export function scoreClarityControl(
  structureCount: number,
  repairCount: number,
  hasClosing: boolean
): { score: number; components: string[] } {
  let score = 0;
  const components: string[] = [];
  
  // Structure signals (0-8)
  if (structureCount >= 3) {
    score += 8;
    components.push('clear structure');
  } else if (structureCount >= 2) {
    score += 6;
    components.push('some structure');
  } else if (structureCount >= 1) {
    score += 3;
    components.push('minimal structure');
  }
  
  // Repair/clarification (0-4)
  if (repairCount >= 1) {
    score += 4;
    components.push('self-repairs');
  }
  
  // Closing (0-3)
  if (hasClosing) {
    score += 3;
    components.push('clear closing');
  }
  
  return { score: Math.min(15, score), components };
}

/**
 * E) Confidence Language Signals (0-15)
 * Conservative interpretation
 */
export function scoreConfidenceLanguage(
  confidentCount: number,
  hedgingCount: number
): { score: number; note: string } {
  let score = 15; // Start at full
  let note = '';
  
  // Confident signals (positive)
  if (confidentCount >= 2) {
    note = 'Uses confident language';
  }
  
  // Hedging (light penalty only if excessive)
  // "je pense" is normal, so only penalize if > 3 hedges
  if (hedgingCount > 3) {
    score -= 5;
    note = 'Frequent hedging';
  } else if (hedgingCount > 1) {
    score -= 2;
    note = 'Some hedging (normal)';
  } else {
    note = note || 'Direct language';
  }
  
  return { score: Math.max(0, score), note };
}

// ============================================================================
// Complete Confidence Evaluation
// ============================================================================

/**
 * Evaluate confidence from speaking sample
 */
export function evaluateConfidenceSpeaking(
  transcript: string,
  duration: number
): {
  speaking: number;
  rubric: {
    length_development: number;
    assertiveness_ownership: number;
    emotional_engagement: number;
    clarity_control: number;
    confidence_language: number;
  };
  signal_counts: {
    ownership_count: number;
    boundary_count: number;
    minimizing_count: number;
    engagement_count: number;
    structure_count: number;
  };
  evidence: Record<string, string[]>;
  debug_flags: string[];
} {
  const debug_flags: string[] = [];
  
  // Split into turns (simple approach - by sentences)
  const turns = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Detect signals
  const allSignals = detectAllSignals(turns);
  const signalCounts = countSignalsByType(allSignals);
  
  // Extract counts
  const ownership_count = signalCounts['ownership'] || 0;
  const boundary_count = signalCounts['boundary'] || 0;
  const minimizing_count = signalCounts['minimizing'] || 0;
  const engagement_count = signalCounts['engagement'] || 0;
  const structure_count = signalCounts['structure'] || 0;
  const repair_count = signalCounts['repair'] || 0;
  const confident_count = signalCounts['confidence_language'] || 0;
  
  // Estimate content units (rough heuristic)
  const contentUnits = Math.max(1, Math.floor(turns.length / 3));
  
  // Check for closing indicators
  const hasClosing = /\b(en résumé|pour résumer|voilà|donc)\b/i.test(transcript);
  
  // Score each rubric item
  const lengthDev = scoreLengthDevelopment(duration, contentUnits);
  const assertiveness = scoreAssertivenessOwnership(ownership_count, boundary_count, minimizing_count);
  const engagement = scoreEmotionalEngagement(engagement_count);
  const clarity = scoreClarityControl(structure_count, repair_count, hasClosing);
  const confidenceLang = scoreConfidenceLanguage(confident_count, signalCounts['confidence_language'] || 0);
  
  // Debug flags
  if (isOverMinimizing(signalCounts)) {
    debug_flags.push('over_penalizing_softeners');
  }
  
  if (ownership_count === 0 && minimizing_count > 0) {
    debug_flags.push('evidence_missing_for_confidence_signal');
  }
  
  // Calculate speaking score (sum of rubric items)
  const speaking = lengthDev.score + assertiveness.score + engagement.score + clarity.score + confidenceLang.score;
  
  // Collect evidence
  const evidence = {
    ownership: getEvidenceForType(allSignals, 'ownership', 3),
    boundary: getEvidenceForType(allSignals, 'boundary', 3),
    engagement: getEvidenceForType(allSignals, 'engagement', 3),
    structure: getEvidenceForType(allSignals, 'structure', 3),
  };
  
  return {
    speaking: Math.round(speaking),
    rubric: {
      length_development: lengthDev.score,
      assertiveness_ownership: assertiveness.score,
      emotional_engagement: engagement.score,
      clarity_control: clarity.score,
      confidence_language: confidenceLang.score,
    },
    signal_counts: {
      ownership_count,
      boundary_count,
      minimizing_count,
      engagement_count,
      structure_count,
    },
    evidence,
    debug_flags,
  };
}

/**
 * Calculate final confidence score (50% speaking + 50% self-assessment)
 */
export function calculateFinalConfidenceScore(
  speakingScore: number,
  selfAssessmentScore: number
): ConfidenceScore {
  const final = (speakingScore * 0.5) + (selfAssessmentScore * 0.5);
  
  return {
    speaking: Math.round(speakingScore),
    self: Math.round(selfAssessmentScore),
    final: Math.round(final),
  };
}

/**
 * Complete confidence evaluation with all components
 */
export function evaluateConfidenceComplete(
  transcript: string,
  duration: number,
  selfAssessmentScore: number
): ConfidenceScore & {
  rubric: {
    length_development: number;
    assertiveness_ownership: number;
    emotional_engagement: number;
    clarity_control: number;
    confidence_language: number;
  };
  signal_counts: {
    ownership_count: number;
    boundary_count: number;
    minimizing_count: number;
    engagement_count: number;
    structure_count: number;
  };
} {
  const evaluation = evaluateConfidenceSpeaking(transcript, duration);
  const finalScore = calculateFinalConfidenceScore(evaluation.speaking, selfAssessmentScore);
  
  return {
    ...finalScore,
    rubric: evaluation.rubric,
    signal_counts: evaluation.signal_counts,
  };
}

