/**
 * Unified Exam Scoring Algorithm
 * Aggregates all 3 scenarios to produce weighted overall score
 */

import { scoreFluencyFromTimestamps, calculateFluencyScore, type FluencyMetrics, type WordTimestamp } from '@/components/assessment/fluency/fluencyScoring';
import { calculateSyntaxScore } from '@/components/assessment/syntax/syntaxScoring';
import type { SyntaxTag } from '@/components/assessment/conversation/types';
import { evaluateConfidenceComplete } from '@/components/assessment/confidence/confidenceEvaluation';
import type { UnifiedScore, ScenarioExecution, ConversationTurn } from '@/components/assessment/unifiedExam/types';
import type { ScoringTrace, TurnTrace } from '@/components/assessment/conversation/types';
import { initTrace, addTurn, addFluencyScore, addSyntaxScore, addConversationScore, addConfidenceScore } from './traceBuilder';

// ============================================================================
// Score Weights
// ============================================================================

const SCORE_WEIGHTS = {
  fluency: 0.25,      // 25%
  syntax: 0.25,       // 25%
  conversation: 0.30, // 30%
  confidence: 0.20,   // 20%
};

// ============================================================================
// Aggregate Scoring
// ============================================================================

/**
 * Score all 3 scenarios and produce unified score
 */
export async function scoreUnifiedExam(
  scenarios: ScenarioExecution[],
  confidenceQuizScore: number,
  sessionId: string
): Promise<{
  unifiedScore: UnifiedScore;
  trace: ScoringTrace;
}> {
  if (scenarios.length !== 3) {
    throw new Error('Expected exactly 3 scenarios');
  }
  
  // Initialize trace
  let trace = initTrace(
    sessionId,
    `unified_${scenarios.map(s => s.scenarioId).join('_')}`,
    scenarios.map(s => s.personaId).join('_'),
    {
      A: scenarios[0].tier,
      B: scenarios[1].tier,
      C: scenarios[2].tier,
    }
  );
  
  // ============================================================================
  // 1. Aggregate Fluency Across All Scenarios
  // ============================================================================
  
  const fluencyScore = await aggregateFluency(scenarios, trace);
  trace = addFluencyScore(trace, fluencyScore);
  
  // ============================================================================
  // 2. Aggregate Syntax Across All Scenarios
  // ============================================================================
  
  const syntaxScore = await aggregateSyntax(scenarios, trace);
  trace = addSyntaxScore(trace, syntaxScore);
  
  // ============================================================================
  // 3. Aggregate Conversation Across All Scenarios
  // ============================================================================
  
  const conversationScore = await aggregateConversation(scenarios, trace);
  trace = addConversationScore(trace, conversationScore);
  
  // ============================================================================
  // 4. Use Confidence Quiz Score
  // ============================================================================
  
  const confidenceScore = {
    speaking: 0, // Not measured separately in unified exam
    self: confidenceQuizScore,
    final: confidenceQuizScore, // 100% from quiz in this case
  };
  trace = addConfidenceScore(trace, confidenceScore);
  
  // ============================================================================
  // 5. Calculate Weighted Overall Score
  // ============================================================================
  
  const overall = 
    (fluencyScore.score * SCORE_WEIGHTS.fluency) +
    (syntaxScore.score * SCORE_WEIGHTS.syntax) +
    (conversationScore.score * SCORE_WEIGHTS.conversation) +
    (confidenceScore.final * SCORE_WEIGHTS.confidence);
  
  const proficiencyLevel = determineProficiencyLevel(overall);
  
  const unifiedScore: UnifiedScore = {
    overall: Math.round(overall),
    proficiencyLevel,
    breakdown: {
      fluency: fluencyScore.score,
      syntax: syntaxScore.score,
      conversation: conversationScore.score,
      confidence: confidenceScore.final,
    },
    details: {
      fluencyMetrics: {
        avgWpm: fluencyScore.metrics?.articulation_wpm || 0,
        pauseControl: fluencyScore.pause,
      },
      syntaxCoverage: {
        PC: (syntaxScore.coverage?.PC.coverage_score || 0) > 0,
        FP: (syntaxScore.coverage?.FP.coverage_score || 0) > 0,
        OP: (syntaxScore.coverage?.OP.coverage_score || 0) > 0,
        Q: (syntaxScore.coverage?.Q.coverage_score || 0) > 0,
        C: (syntaxScore.coverage?.C.coverage_score || 0) > 0,
      },
      conversationMetrics: {
        comprehension: conversationScore.comprehension,
        repair: conversationScore.repair,
        flow: conversationScore.flow,
      },
    },
  };
  
  return {
    unifiedScore,
    trace,
  };
}

// ============================================================================
// Module-Specific Aggregation
// ============================================================================

/**
 * Aggregate fluency from all user turns across scenarios
 */
async function aggregateFluency(
  scenarios: ScenarioExecution[],
  trace: ScoringTrace
): Promise<any> {
  // Collect all user turns with audio
  const allUserTurns = scenarios.flatMap(s => 
    s.conversationHistory.filter(t => t.speaker === 'user')
  );
  
  // For now, use simple metrics
  // In production, would use word timestamps from Whisper
  const totalWords = allUserTurns.reduce((sum, turn) => 
    sum + turn.transcript.split(/\s+/).length, 0
  );
  
  const totalTime = allUserTurns.length * 10; // Assume ~10s per turn
  const wpm = totalWords / (totalTime / 60);
  
  // Use existing fluency scoring
  const metrics: FluencyMetrics = {
    wordCount: totalWords,
    word_count_non_filler: totalWords,
    totalWordCount: totalWords,
    fillerCount: 0,
    fillerRatio: 0,
    speakingTime: totalTime,
    speaking_time_sec: totalTime,
    articulationWpm: wpm,
    articulation_wpm: wpm,
    pauseCount: 0,
    pause_count: 0,
    longPauseCount: 0,
    long_pause_count: 0,
    maxPause: 0,
    max_pause_sec: 0,
    pauseRatio: 0,
    pause_ratio: 0,
    totalPauseDuration: 0,
    pause_total_sec: 0,
  };
  
  return calculateFluencyScore(metrics);
}

/**
 * Aggregate syntax tags from all scenarios
 */
async function aggregateSyntax(
  scenarios: ScenarioExecution[],
  trace: ScoringTrace
): Promise<any> {
  // Collect all user turns
  const allUserTranscripts = scenarios.flatMap(s => 
    s.conversationHistory
      .filter(t => t.speaker === 'user')
      .map(t => t.transcript)
  ).join(' ');
  
  // For now, return placeholder
  // In production, would call LLM to extract syntax tags
  const tags: SyntaxTag[] = [];
  
  return calculateSyntaxScore(tags);
}

/**
 * Aggregate conversation metrics from all scenarios
 */
async function aggregateConversation(
  scenarios: ScenarioExecution[],
  trace: ScoringTrace
): Promise<any> {
  // Combine all conversation history
  const allHistory = scenarios.flatMap(s => 
    s.conversationHistory.map(t => ({
      role: t.speaker === 'user' ? 'user' : ('agent' as const),
      content: t.transcript,
    }))
  );
  
  // For now, return placeholder
  // In production, would use scoreConversationPrecise
  return {
    score: 75,
    comprehension: 40,
    repair: 22,
    flow: 13,
  };
}

// ============================================================================
// Proficiency Level Determination
// ============================================================================

/**
 * Map overall score to CEFR level
 */
export function determineProficiencyLevel(overallScore: number): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' {
  if (overallScore >= 90) return 'C2';
  if (overallScore >= 80) return 'C1';
  if (overallScore >= 70) return 'B2';
  if (overallScore >= 60) return 'B1';
  if (overallScore >= 40) return 'A2';
  return 'A1';
}

// ============================================================================
// Score Validation
// ============================================================================

/**
 * Validate unified score is reasonable
 */
export function validateUnifiedScore(score: UnifiedScore): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Check breakdown sums correctly (weighted)
  const calculatedOverall = 
    (score.breakdown.fluency * SCORE_WEIGHTS.fluency) +
    (score.breakdown.syntax * SCORE_WEIGHTS.syntax) +
    (score.breakdown.conversation * SCORE_WEIGHTS.conversation) +
    (score.breakdown.confidence * SCORE_WEIGHTS.confidence);
  
  if (Math.abs(calculatedOverall - score.overall) > 2) {
    warnings.push(`Overall score mismatch: expected ${calculatedOverall.toFixed(0)}, got ${score.overall}`);
  }
  
  // Check scores are in valid range
  if (score.overall < 0 || score.overall > 100) {
    warnings.push('Overall score out of range');
  }
  
  Object.entries(score.breakdown).forEach(([skill, value]) => {
    if (value < 0 || value > 100) {
      warnings.push(`${skill} score out of range: ${value}`);
    }
  });
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}

