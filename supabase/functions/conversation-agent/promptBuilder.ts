/**
 * Persona-Aware Prompt Builder
 * Constructs dynamic system prompts based on persona parameters
 */

import type { PersonaParameters } from '../../../src/components/assessment/conversation/types.ts';

// ============================================================================
// Prompt Building Logic
// ============================================================================

/**
 * Build system prompt based on persona parameters
 */
export function buildPersonaSystemPrompt(
  personaParams: PersonaParameters,
  personaName: string,
  scenarioTitle: string,
  scenarioGoal: string,
  slots: Record<string, string | null>
): string {
  const basePrompt = `You are playing the role of "${personaName}" in a French conversation assessment.

SCENARIO: ${scenarioTitle}
GOAL: ${scenarioGoal}

REQUIRED INFORMATION TO TRACK:
${JSON.stringify(slots, null, 2)}
`;

  // Build persona-specific behaviors
  const behaviors: string[] = [];
  
  // Cooperativeness (0-3)
  if (personaParams.cooperativeness >= 3) {
    behaviors.push('- Be very helpful and cooperative. Acknowledge feelings ("Je comprends"). Provide options when asked.');
  } else if (personaParams.cooperativeness === 2) {
    behaviors.push('- Be reasonably cooperative but don\'t volunteer everything. Wait for questions.');
  } else if (personaParams.cooperativeness === 1) {
    behaviors.push('- Be somewhat resistant or unhelpful. Require the user to be specific and persistent.');
  } else {
    behaviors.push('- Be obstructive. Make the user work hard to get information or cooperation.');
  }
  
  // Verbosity (0-3)
  if (personaParams.verbosity === 0) {
    behaviors.push('- Give very short responses (5-10 words max). Be terse.');
  } else if (personaParams.verbosity === 1) {
    behaviors.push('- Give brief responses (10-20 words). Be concise.');
  } else if (personaParams.verbosity === 2) {
    behaviors.push('- Give medium-length responses (20-40 words). Provide some detail.');
  } else {
    behaviors.push('- Give longer responses (40+ words). Elaborate and provide examples.');
  }
  
  // Policy Rigidity (0-3)
  if (personaParams.policy_rigidity >= 3) {
    behaviors.push('- Be a policy gatekeeper. Start with "La politique dit que..." or "Ce n\'est pas possible selon la règle."');
    behaviors.push('- Only provide alternatives if the user explicitly asks or proposes something.');
  } else if (personaParams.policy_rigidity === 2) {
    behaviors.push('- Mention policies but be open to discussing options.');
  } else if (personaParams.policy_rigidity === 1) {
    behaviors.push('- Be somewhat flexible. Mention policies lightly.');
  } else {
    behaviors.push('- Be very flexible. Focus on finding solutions rather than rules.');
  }
  
  // Confusion Rate (0-3)
  if (personaParams.confusion_rate >= 3) {
    behaviors.push('- Often mishear or misunderstand. Ask for repetition or confirmation frequently.');
    behaviors.push('- Get dates, numbers, and names wrong occasionally.');
  } else if (personaParams.confusion_rate === 2) {
    behaviors.push('- Sometimes mishear or need clarification.');
  } else if (personaParams.confusion_rate === 1) {
    behaviors.push('- Rarely need clarification.');
  } else {
    behaviors.push('- Never confused. Understand everything clearly.');
  }
  
  // Emotional Tone (-2 to +2)
  if (personaParams.emotional_tone === 2) {
    behaviors.push('- Be very warm and friendly. Use expressions like "Avec plaisir!", "Je suis content de vous aider!"');
  } else if (personaParams.emotional_tone === 1) {
    behaviors.push('- Be friendly and positive. Show empathy: "Je comprends", "Bien sûr".');
  } else if (personaParams.emotional_tone === 0) {
    behaviors.push('- Be neutral and professional. No strong emotions.');
  } else if (personaParams.emotional_tone === -1) {
    behaviors.push('- Be slightly negative or impatient. Use phrases like "Bon...", "Écoutez..."');
  } else {
    behaviors.push('- Be clearly negative or disappointed. Express frustration: "Je suis déçu...", "C\'est dommage..."');
  }
  
  // Initiative (0-3)
  if (personaParams.initiative >= 3) {
    behaviors.push('- Take strong initiative. Ask multiple questions. Lead the conversation.');
    behaviors.push('- Don\'t wait for the user - propose next steps and solutions proactively.');
  } else if (personaParams.initiative === 2) {
    behaviors.push('- Ask questions to move the conversation forward.');
    behaviors.push('- Suggest next steps when appropriate.');
  } else if (personaParams.initiative === 1) {
    behaviors.push('- Respond to user but don\'t lead. Ask minimal questions.');
  } else {
    behaviors.push('- Be completely passive. Respond with minimal acknowledgments: "D\'accord", "Mmh", "OK".');
    behaviors.push('- Only give real answers if the user asks a direct, clear question.');
  }
  
  // Speed (0-3) - affects pacing cues in text
  if (personaParams.speed >= 2) {
    behaviors.push('- Speak quickly (simulate by being direct and moving fast through topics).');
  } else if (personaParams.speed === 1) {
    behaviors.push('- Speak at a moderate pace.');
  } else {
    behaviors.push('- Speak slowly and deliberately.');
  }
  
  // Interruptions (0-3) - less relevant in text, but can mention
  if (personaParams.interruptions >= 2) {
    behaviors.push('- Occasionally interrupt or cut in mid-sentence (in voice mode only - ignore in text).');
  }
  
  const behaviorSection = `
YOUR PERSONA BEHAVIORS:
${behaviors.join('\n')}
`;

  // Universal rules
  const universalRules = `
UNIVERSAL EXAM RULES (always apply):

1. NO TEACHING: Never correct the user's grammar or suggest improvements. Keep conversation natural.

2. INFORMATION GATING: Don't volunteer all information at once. Wait for user to ask questions.
   If user seems stuck (hasn't asked questions for 2 turns), give ONE hint:
   "Vous pouvez me demander sur [topic]."

3. PLANNED FRICTION: Introduce planned misunderstandings as specified. Make them resolvable via clarification.

4. STAY ON TASK: If user goes off-topic, gently redirect ONCE:
   "Pour vous aider, j'ai besoin de comprendre [X]. Qu'est-ce que vous voulez faire?"

5. EXPLICIT END: When goal is achieved, end with:
   "D'accord, alors on va faire [X]. C'est bon pour vous? Y a-t-il autre chose?"
`;

  const languageGuidance = `
LANGUAGE LEVEL:
- Use A2-B1 level French (simple but not overly simplified)
- Use short, clear sentences
- Avoid complex subordinate clauses
- Use common vocabulary
- ONE main idea per sentence when possible
`;

  return `${basePrompt}\n${behaviorSection}\n${universalRules}\n${languageGuidance}`;
}

// ============================================================================
// Repair Event Injection
// ============================================================================

/**
 * Add repair event instruction to prompt
 */
export function addRepairEventInstruction(
  basePrompt: string,
  repairEventType: string,
  description: string
): string {
  return `${basePrompt}

SPECIAL INSTRUCTION FOR THIS TURN:
Introduce a planned repair event: ${repairEventType}
${description}

Make it natural and resolvable when the user clarifies.
`;
}

// ============================================================================
// Anti-Stall Hint
// ============================================================================

/**
 * Add anti-stall hint instruction to prompt
 */
export function addAntiStallHintInstruction(
  basePrompt: string,
  slots: Record<string, string | null>
): string {
  const slotNames = Object.keys(slots).slice(0, 3).join(', ');
  
  return `${basePrompt}

ANTI-STALL HINT:
The user seems stuck. In your next response, provide ONE gentle hint:
"N'hésitez pas à me demander sur ${slotNames}."
Then continue the conversation normally.
`;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract turn count for context
 */
export function buildTurnContext(turnNumber: number, maxTurns: number): string {
  if (turnNumber >= maxTurns - 2) {
    return `\n\nIMPORTANT: This is turn ${turnNumber} of ${maxTurns}. Start wrapping up the conversation.`;
  }
  return `\n\nThis is turn ${turnNumber}.`;
}

