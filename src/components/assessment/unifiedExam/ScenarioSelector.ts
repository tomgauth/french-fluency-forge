/**
 * Scenario Selector with Tier-Based Adaptive Progression
 * Selects scenarios based on user performance
 */

import { conversationScenarios } from '../conversation/conversationScenarios';
import type { ScenarioSelection, AdaptiveProgression } from './types';
import type { ConversationScenario } from '../conversation/conversationScenarios';

// ============================================================================
// Scenario Selection Logic
// ============================================================================

/**
 * Select scenario 1 (always Tier 1)
 */
export function selectScenario1(): ScenarioSelection {
  const tier1Scenarios = conversationScenarios.filter(s => s.tier === 1);
  const scenario = tier1Scenarios[Math.floor(Math.random() * tier1Scenarios.length)];
  
  return mapScenarioToSelection(scenario);
}

/**
 * Select scenario 2 based on scenario 1 performance
 */
export function selectScenario2(scenario1Score: number): ScenarioSelection {
  // If score > 70, go to Tier 2; otherwise stay at Tier 1
  const targetTier = scenario1Score > 70 ? 2 : 1;
  
  const scenarios = conversationScenarios.filter(s => s.tier === targetTier);
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  
  return mapScenarioToSelection(scenario);
}

/**
 * Select scenario 3 based on scenario 2 performance
 */
export function selectScenario3(scenario2Score: number): ScenarioSelection {
  // If score > 75, go to Tier 3; otherwise Tier 2
  const targetTier = scenario2Score > 75 ? 3 : 2;
  
  const scenarios = conversationScenarios.filter(s => s.tier === targetTier);
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  
  return mapScenarioToSelection(scenario);
}

/**
 * Map ConversationScenario to ScenarioSelection
 */
function mapScenarioToSelection(scenario: ConversationScenario): ScenarioSelection {
  return {
    scenarioId: scenario.id,
    personaId: scenario.persona_id,
    tier: scenario.tier,
    title: scenario.title,
    context: scenario.context || '',
  };
}

// ============================================================================
// Adaptive Progression Logic
// ============================================================================

/**
 * Calculate adaptive progression based on performance
 */
export function calculateAdaptiveProgression(
  scenario1Score: number,
  scenario2Score: number
): AdaptiveProgression {
  // Tier 2 selection
  const recommendedTier2 = scenario1Score > 70 ? 2 : 1;
  
  // Tier 3 selection
  let recommendedTier3: 1 | 2 | 3;
  if (scenario2Score > 75) {
    recommendedTier3 = 3;
  } else if (scenario2Score > 60) {
    recommendedTier3 = 2;
  } else {
    recommendedTier3 = 1;
  }
  
  return {
    scenario1Score,
    scenario2Score,
    recommendedTier2,
    recommendedTier3,
  };
}

// ============================================================================
// Quick Scoring for Adaptive Difficulty
// ============================================================================

/**
 * Quick score calculation for tier selection
 * Returns approximate score 0-100 based on conversation so far
 */
export async function calculateQuickScore(
  conversationHistory: Array<{ speaker: 'user' | 'bot'; content: string }>,
  scenarioGoal: string
): Promise<number> {
  // Simple heuristic-based quick score
  // In production, could call simplified scoring API
  
  const userTurns = conversationHistory.filter(t => t.speaker === 'user');
  
  if (userTurns.length === 0) return 50; // Default mid-range
  
  // Calculate metrics
  const avgLength = userTurns.reduce((sum, t) => sum + t.content.length, 0) / userTurns.length;
  const totalWords = userTurns.reduce((sum, t) => sum + t.content.split(/\s+/).length, 0);
  const hasQuestions = userTurns.some(t => t.content.includes('?'));
  const hasConnectors = userTurns.some(t => 
    /\b(parce que|donc|mais|alors|ensuite|d'abord)\b/i.test(t.content)
  );
  
  // Quick score estimation
  let score = 50; // Base
  
  // Length factor (engagement)
  if (avgLength > 50) score += 10;
  if (avgLength > 100) score += 10;
  
  // Word count (fluency)
  if (totalWords > 30) score += 5;
  if (totalWords > 60) score += 10;
  
  // Questions (conversation skill)
  if (hasQuestions) score += 10;
  
  // Connectors (syntax)
  if (hasConnectors) score += 10;
  
  return Math.min(100, Math.max(30, score));
}

// ============================================================================
// Scenario Pool Management
// ============================================================================

/**
 * Get available scenarios for a tier
 */
export function getScenariosByTier(tier: 1 | 2 | 3): ConversationScenario[] {
  return conversationScenarios.filter(s => s.tier === tier);
}

/**
 * Ensure diversity across 3 scenarios
 * Returns 3 scenarios with different contexts/personas
 */
export function selectThreeScenarios(
  tier1: 1,
  tier2: 1 | 2 | 3,
  tier3: 1 | 2 | 3
): [ConversationScenario, ConversationScenario, ConversationScenario] {
  const scenarios1 = getScenariosByTier(tier1);
  const scenarios2 = getScenariosByTier(tier2);
  const scenarios3 = getScenariosByTier(tier3);
  
  // Pick one from each tier, ensuring different personas
  const scenario1 = scenarios1[Math.floor(Math.random() * scenarios1.length)];
  
  // Filter out same persona for scenario 2
  const availableScenarios2 = scenarios2.filter(s => s.persona_id !== scenario1.persona_id);
  const scenario2 = availableScenarios2.length > 0
    ? availableScenarios2[Math.floor(Math.random() * availableScenarios2.length)]
    : scenarios2[Math.floor(Math.random() * scenarios2.length)];
  
  // Filter out same personas for scenario 3
  const availableScenarios3 = scenarios3.filter(s => 
    s.persona_id !== scenario1.persona_id && s.persona_id !== scenario2.persona_id
  );
  const scenario3 = availableScenarios3.length > 0
    ? availableScenarios3[Math.floor(Math.random() * availableScenarios3.length)]
    : scenarios3[Math.floor(Math.random() * scenarios3.length)];
  
  return [scenario1, scenario2, scenario3];
}

// ============================================================================
// Transition Messages
// ============================================================================

/**
 * Get transition message between scenarios
 */
export function getTransitionMessage(scenarioNumber: 2 | 3): {
  title: string;
  subtitle: string;
} {
  if (scenarioNumber === 2) {
    return {
      title: 'Great Start!',
      subtitle: 'Next: A different situation',
    };
  } else {
    return {
      title: 'Almost Done!',
      subtitle: 'Last scenario',
    };
  }
}

// ============================================================================
// Time Management
// ============================================================================

/**
 * Calculate recommended max turns per scenario
 * Target: ~2 minutes per scenario
 * Assuming ~15 seconds per turn = 8 turns max
 */
export function getMaxTurnsForScenario(scenarioNumber: number): number {
  return 8; // Same for all scenarios
}

/**
 * Check if scenario should end based on time/turns
 */
export function shouldEndScenario(
  turnCount: number,
  elapsedSeconds: number,
  maxTurns: number = 8,
  maxSeconds: number = 150 // 2.5 minutes
): boolean {
  return turnCount >= maxTurns || elapsedSeconds >= maxSeconds;
}

