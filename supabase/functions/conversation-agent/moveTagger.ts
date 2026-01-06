/**
 * Conversation Move Tagger
 * LLM-based tagging of conversation moves for each user turn
 */

import type { ConversationMove, ConversationMoveTag } from '../../../src/components/assessment/conversation/types.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// ============================================================================
// Move Definitions
// ============================================================================

const MOVE_DEFINITIONS = {
  QUESTION: 'User asks a question to gather information or clarify',
  PROPOSAL: 'User proposes a solution, alternative, or course of action',
  CONFIRMATION: 'User confirms understanding or agreement',
  PARAPHRASE: 'User restates or summarizes what was said',
  SUMMARY: 'User provides a summary of the conversation or decision',
  REPAIR_INIT: 'User initiates repair (e.g., "Pardon?", "Je ne comprends pas")',
  REPAIR_EXEC: 'User executes repair by correcting or clarifying',
  CLOSING: 'User attempts to close or wrap up the conversation',
  OTHER: 'None of the above categories apply',
};

// ============================================================================
// Move Tagging
// ============================================================================

/**
 * Tag conversation moves in a user turn
 */
export async function tagConversationMoves(
  userTurn: string,
  conversationContext: string
): Promise<ConversationMoveTag[]> {
  console.log('Tagging conversation moves...');
  
  const systemPrompt = `You are a conversation analyst. Your task is to identify conversation moves in user utterances.

MOVE TYPES:
${Object.entries(MOVE_DEFINITIONS)
  .map(([move, def]) => `- ${move}: ${def}`)
  .join('\n')}

For each user turn, identify ALL applicable moves (a turn can have multiple moves).
Return evidence snippets for each move.`;

  const userPrompt = `Context:
${conversationContext}

User turn:
"${userTurn}"

Identify all conversation moves in this turn. Return JSON array:
[
  {
    "move": "MOVE_TYPE",
    "snippet": "exact phrase from turn"
  }
]

If no clear moves, return empty array.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'tag_conversation_moves',
              description: 'Tag conversation moves in user turn',
              parameters: {
                type: 'object',
                properties: {
                  moves: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        move: {
                          type: 'string',
                          enum: Object.keys(MOVE_DEFINITIONS),
                        },
                        snippet: { type: 'string' },
                      },
                      required: ['move', 'snippet'],
                    },
                  },
                },
                required: ['moves'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'tag_conversation_moves' } },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Move tagging error:', error);
      return [];
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.warn('No tool call in move tagging response');
      return [];
    }

    const args = JSON.parse(toolCall.function.arguments);
    console.log('Tagged moves:', args.moves.length);
    
    return args.moves;
  } catch (error) {
    console.error('Error tagging moves:', error);
    return [];
  }
}

// ============================================================================
// Batch Move Tagging
// ============================================================================

/**
 * Tag all user turns in a conversation
 */
export async function tagAllUserTurns(
  conversationHistory: Array<{ role: 'user' | 'agent'; content: string }>
): Promise<Record<number, ConversationMoveTag[]>> {
  console.log('Tagging all user turns...');
  
  const result: Record<number, ConversationMoveTag[]> = {};
  const userTurns = conversationHistory.filter(m => m.role === 'user');
  
  // Build context for each turn
  for (let i = 0; i < userTurns.length; i++) {
    const turnIndex = conversationHistory.findIndex(m => m === userTurns[i]);
    const context = conversationHistory
      .slice(Math.max(0, turnIndex - 2), turnIndex)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');
    
    const moves = await tagConversationMoves(userTurns[i].content, context);
    result[turnIndex] = moves;
    
    // Small delay to avoid rate limiting
    if (i < userTurns.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return result;
}

// ============================================================================
// Move Analysis
// ============================================================================

/**
 * Analyze move distribution
 */
export function analyzeMoveDistribution(
  allMoves: Record<number, ConversationMoveTag[]>
): Record<ConversationMove, number> {
  const distribution: Record<string, number> = {};
  
  Object.values(allMoves).forEach(turnMoves => {
    turnMoves.forEach(moveTag => {
      distribution[moveTag.move] = (distribution[moveTag.move] || 0) + 1;
    });
  });
  
  return distribution as Record<ConversationMove, number>;
}

/**
 * Check if user asked questions
 */
export function hasQuestions(allMoves: Record<number, ConversationMoveTag[]>): boolean {
  return Object.values(allMoves).some(turnMoves =>
    turnMoves.some(m => m.move === 'QUESTION')
  );
}

/**
 * Check if user proposed solutions
 */
export function hasProposals(allMoves: Record<number, ConversationMoveTag[]>): boolean {
  return Object.values(allMoves).some(turnMoves =>
    turnMoves.some(m => m.move === 'PROPOSAL')
  );
}

/**
 * Check if user attempted closing
 */
export function hasClosing(allMoves: Record<number, ConversationMoveTag[]>): boolean {
  return Object.values(allMoves).some(turnMoves =>
    turnMoves.some(m => m.move === 'CLOSING')
  );
}

/**
 * Count repair attempts
 */
export function countRepairAttempts(allMoves: Record<number, ConversationMoveTag[]>): number {
  let count = 0;
  Object.values(allMoves).forEach(turnMoves => {
    turnMoves.forEach(m => {
      if (m.move === 'REPAIR_INIT' || m.move === 'REPAIR_EXEC') {
        count++;
      }
    });
  });
  return count;
}

