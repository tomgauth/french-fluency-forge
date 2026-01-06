/**
 * Universal Exam Rules
 * Inlined for edge function deployment
 */

// ============================================================================
// Types
// ============================================================================

export interface UniversalRulesState {
  silent_turns_count: number;
  hint_given: boolean;
  off_topic_redirect_used: boolean;
  repair_events_introduced: string[];
}

// ============================================================================
// Rule Definitions
// ============================================================================

export const RULE_NO_TEACHING = `
Never correct the user's grammar or suggest improvements during the conversation.
Keep the conversation flowing naturally without acting as a teacher.
`;

export const RULE_INFORMATION_GATING = `
Do not volunteer all information at once. Wait for the user to ask questions.
If the user seems stuck and hasn't asked questions for 2 turns, provide ONE hint like:
"Vous pouvez me demander sur les horaires, les options, ou la politique."
`;

export const RULE_PLANNED_FRICTION = `
Introduce planned misunderstandings or ambiguities as specified in the scenario.
These should be resolvable when the user clarifies or asks follow-up questions.
`;

export const RULE_ON_TASK = `
If the user goes completely off-topic, gently redirect them ONCE:
"Pour vous aider, j'ai besoin de comprendre [X]. Qu'est-ce que vous voulez faire?"
If they continue off-topic, continue the conversation but note it in your response.
`;

export const RULE_EXPLICIT_END = `
When the goal is achieved (all required information exchanged, issue resolved),
end with confirmation and next steps:
"D'accord, alors on va faire [X]. C'est bon pour vous? Y a-t-il autre chose?"
`;

// ============================================================================
// Anti-Stall Logic
// ============================================================================

export function shouldGiveAntiStallHint(
  state: UniversalRulesState,
  recentUserTurns: string[]
): boolean {
  if (state.hint_given) return false;
  if (recentUserTurns.length < 2) return false;
  
  const hasQuestions = recentUserTurns.some(turn => 
    turn.includes('?') || 
    turn.match(/\b(comment|quand|où|pourquoi|qui|quel|quelle|combien)\b/i)
  );
  
  const avgLength = recentUserTurns.reduce((sum, turn) => sum + turn.length, 0) / recentUserTurns.length;
  
  return !hasQuestions && avgLength < 50;
}

export function generateAntiStallHint(slots: Record<string, string | null>): string {
  const slotNames = Object.keys(slots);
  
  if (slotNames.length === 0) {
    return "Vous pouvez me poser des questions si vous avez besoin de clarifications.";
  }
  
  const suggestions = slotNames.slice(0, 3).join(', ');
  return `N'hésitez pas à me demander sur ${suggestions}.`;
}

// ============================================================================
// Off-Topic Detection
// ============================================================================

export function isOffTopic(
  userTurn: string,
  scenarioGoal: string,
  scenarioContext: string
): boolean {
  const lowerTurn = userTurn.toLowerCase();
  const lowerGoal = scenarioGoal.toLowerCase();
  const lowerContext = scenarioContext.toLowerCase();
  
  const keyWords = [...lowerGoal.split(/\s+/), ...lowerContext.split(/\s+/)]
    .filter(word => word.length > 4);
  
  const hasKeyWords = keyWords.some(word => lowerTurn.includes(word));
  
  if (userTurn.length < 20) return false;
  
  return !hasKeyWords && userTurn.length > 40;
}

export function generateOffTopicRedirect(scenarioGoal: string): string {
  return `Je comprends, mais pour vous aider, j'ai besoin de comprendre votre situation concernant ${scenarioGoal.toLowerCase()}. Qu'est-ce que vous voulez faire exactement?`;
}

// ============================================================================
// End Condition Checking
// ============================================================================

export function shouldEndConversation(
  slots: Record<string, string | null>,
  requiredSlots: string[],
  turnCount: number,
  maxTurns: number
): boolean {
  if (turnCount >= maxTurns) return true;
  
  const allSlotsFilled = requiredSlots.every(slotKey => {
    const value = slots[slotKey];
    return value !== null && value !== undefined && value.trim() !== '';
  });
  
  return allSlotsFilled;
}

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
