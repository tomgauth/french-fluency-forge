/**
 * Universal Exam Rules
 * Rules that apply to all personas to ensure fairness and comparability
 */

import type { UniversalRulesState } from './types';

// ============================================================================
// Rule Definitions
// ============================================================================

/**
 * R1 - No teaching during the exam
 * Do not correct the user or suggest grammar improvements mid-test.
 */
export const RULE_NO_TEACHING = `
Never correct the user's grammar or suggest improvements during the conversation.
Keep the conversation flowing naturally without acting as a teacher.
`;

/**
 * R2 - Information gating
 * Do not reveal required slot values unless the user asks a relevant question.
 * Exception (anti-stall): if the user fails to ask any question for 2 user turns,
 * provide one hint.
 */
export const RULE_INFORMATION_GATING = `
Do not volunteer all information at once. Wait for the user to ask questions.
If the user seems stuck and hasn't asked questions for 2 turns, provide ONE hint like:
"Vous pouvez me demander sur les horaires, les options, ou la politique."
`;

/**
 * R3 - Planned friction
 * Every scenario pack must schedule ≥2 repair events.
 * Repair events must be resolvable via clarification questions.
 */
export const RULE_PLANNED_FRICTION = `
Introduce planned misunderstandings or ambiguities as specified in the scenario.
These should be resolvable when the user clarifies or asks follow-up questions.
`;

/**
 * R4 - Keep the user on task
 * If the user goes off-topic: gentle redirect once.
 */
export const RULE_ON_TASK = `
If the user goes completely off-topic, gently redirect them ONCE:
"Pour vous aider, j'ai besoin de comprendre [X]. Qu'est-ce que vous voulez faire?"
If they continue off-topic, continue the conversation but note it in your response.
`;

/**
 * R5 - End condition is explicit
 * The bot ends only when success criteria are met or time ends.
 * The bot must be able to end with: confirmation + next steps.
 */
export const RULE_EXPLICIT_END = `
When the goal is achieved (all required information exchanged, issue resolved),
end with confirmation and next steps:
"D'accord, alors on va faire [X]. C'est bon pour vous? Y a-t-il autre chose?"
`;

// ============================================================================
// Anti-Stall Logic
// ============================================================================

/**
 * Check if anti-stall hint should be given
 * Triggers after 2 consecutive user turns without meaningful questions
 */
export function shouldGiveAntiStallHint(
  state: UniversalRulesState,
  recentUserTurns: string[]
): boolean {
  // Already gave hint
  if (state.hint_given) return false;
  
  // Need at least 2 recent turns
  if (recentUserTurns.length < 2) return false;
  
  // Check if recent turns are very short or lack questions
  const hasQuestions = recentUserTurns.some(turn => 
    turn.includes('?') || 
    turn.match(/\b(comment|quand|où|pourquoi|qui|quel|quelle|combien)\b/i)
  );
  
  const avgLength = recentUserTurns.reduce((sum, turn) => sum + turn.length, 0) / recentUserTurns.length;
  
  return !hasQuestions && avgLength < 50;
}

/**
 * Generate anti-stall hint based on scenario slots
 */
export function generateAntiStallHint(slots: Record<string, string | null>): string {
  const slotNames = Object.keys(slots);
  
  if (slotNames.length === 0) {
    return "Vous pouvez me poser des questions si vous avez besoin de clarifications.";
  }
  
  // Pick 2-3 slot names to suggest
  const suggestions = slotNames.slice(0, 3).join(', ');
  
  return `N'hésitez pas à me demander sur ${suggestions}.`;
}

// ============================================================================
// Off-Topic Detection
// ============================================================================

/**
 * Simple off-topic detection
 * Returns true if user response is clearly off-topic
 */
export function isOffTopic(
  userTurn: string,
  scenarioGoal: string,
  scenarioContext: string
): boolean {
  // Very simple heuristic - in production, could use LLM
  const lowerTurn = userTurn.toLowerCase();
  const lowerGoal = scenarioGoal.toLowerCase();
  const lowerContext = scenarioContext.toLowerCase();
  
  // Extract key nouns from goal and context
  const keyWords = [...lowerGoal.split(/\s+/), ...lowerContext.split(/\s+/)]
    .filter(word => word.length > 4);
  
  // If user turn has any key words, probably on-topic
  const hasKeyWords = keyWords.some(word => lowerTurn.includes(word));
  
  // Very short turns are probably not off-topic, just brief
  if (userTurn.length < 20) return false;
  
  return !hasKeyWords && userTurn.length > 40;
}

/**
 * Generate off-topic redirect
 */
export function generateOffTopicRedirect(scenarioGoal: string): string {
  return `Je comprends, mais pour vous aider, j'ai besoin de comprendre votre situation concernant ${scenarioGoal.toLowerCase()}. Qu'est-ce que vous voulez faire exactement?`;
}

// ============================================================================
// End Condition Checking
// ============================================================================

/**
 * Check if conversation should end based on slot coverage
 */
export function shouldEndConversation(
  slots: Record<string, string | null>,
  requiredSlots: string[],
  turnCount: number,
  maxTurns: number
): boolean {
  // Max turns reached
  if (turnCount >= maxTurns) return true;
  
  // All required slots filled
  const allSlotsFilled = requiredSlots.every(slotKey => {
    const value = slots[slotKey];
    return value !== null && value !== undefined && value.trim() !== '';
  });
  
  return allSlotsFilled;
}

/**
 * Generate end confirmation message
 */
export function generateEndConfirmation(
  slots: Record<string, string | null>,
  scenarioGoal: string
): string {
  const summary = Object.entries(slots)
    .filter(([_, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  
  return `D'accord, alors on va ${scenarioGoal.toLowerCase()}. ${summary}. C'est bon pour vous? Y a-t-il autre chose que je peux faire pour vous?`;
}

// ============================================================================
// Universal Rules System Prompt
// ============================================================================

/**
 * Build universal rules section for system prompt
 */
export function buildUniversalRulesPrompt(): string {
  return `
UNIVERSAL EXAM RULES (apply to all personas):

${RULE_NO_TEACHING}

${RULE_INFORMATION_GATING}

${RULE_PLANNED_FRICTION}

${RULE_ON_TASK}

${RULE_EXPLICIT_END}
`.trim();
}

