/**
 * Enhanced Conversation Scoring
 * Precise 3-part scoring with evidence and metrics
 */

import { tagAllUserTurns, analyzeMoveDistribution, hasQuestions, hasProposals, hasClosing, countRepairAttempts } from './moveTagger.ts';
import { matchRepairPatterns } from '../../../src/components/assessment/conversation/repairEventLibrary.ts';
import type { ConversationScore } from '../../../src/components/assessment/conversation/types.ts';

interface ConversationMessage {
  role: 'user' | 'agent';
  content: string;
}

interface ScoringContext {
  goal: string;
  slots: Record<string, string | null>;
  required_slots?: string[];
  repair_events?: Array<{
    event_id: string;
    introduced_turn: number;
    resolved_turn: number | null;
  }>;
}

// ============================================================================
// Scoring Logic
// ============================================================================

/**
 * Score conversation with detailed metrics
 */
export async function scoreConversationPrecise(
  conversationHistory: ConversationMessage[],
  context: ScoringContext
): Promise<ConversationScore> {
  console.log('Scoring conversation (precise)...');
  
  // Tag all user turns
  const allMoves = await tagAllUserTurns(conversationHistory);
  const moveDistribution = analyzeMoveDistribution(allMoves);
  
  // Extract user turns for pattern matching
  const userTurns = conversationHistory
    .filter(m => m.role === 'user')
    .map(m => m.content);
  
  // Match repair patterns
  const allRepairPatterns = userTurns.flatMap(turn => matchRepairPatterns(turn));
  
  // ============================================================================
  // 1. Comprehension (0-50)
  // ============================================================================
  
  const comprehensionMetrics = scoreComprehension(
    conversationHistory,
    context,
    allMoves
  );
  
  // ============================================================================
  // 2. Repair (0-30)
  // ============================================================================
  
  const repairMetrics = scoreRepair(
    context.repair_events || [],
    allRepairPatterns,
    moveDistribution
  );
  
  // ============================================================================
  // 3. Flow (0-20)
  // ============================================================================
  
  const flowMetrics = scoreFlow(
    allMoves,
    moveDistribution,
    conversationHistory.length
  );
  
  // ============================================================================
  // Combine Scores
  // ============================================================================
  
  const overall = comprehensionMetrics.score + repairMetrics.score + flowMetrics.score;
  
  return {
    score: Math.round(overall),
    comprehension: Math.round(comprehensionMetrics.score),
    repair: Math.round(repairMetrics.score),
    flow: Math.round(flowMetrics.score),
    comprehension_metrics: comprehensionMetrics.metrics,
    repair_metrics: repairMetrics.metrics,
    flow_metrics: flowMetrics.metrics,
  };
}

// ============================================================================
// Comprehension Scoring (0-50)
// ============================================================================

function scoreComprehension(
  conversationHistory: ConversationMessage[],
  context: ScoringContext,
  allMoves: Record<number, any[]>
): {
  score: number;
  metrics: {
    answers_prompt_rate: number;
    detail_tracking_hits: number;
    slot_coverage: number;
  };
} {
  // Count agent questions
  const agentQuestions = conversationHistory.filter(
    m => m.role === 'agent' && m.content.includes('?')
  ).length;
  
  // Count user responses that follow agent questions
  let responseCount = 0;
  for (let i = 1; i < conversationHistory.length; i++) {
    if (
      conversationHistory[i].role === 'user' &&
      conversationHistory[i - 1].role === 'agent' &&
      conversationHistory[i - 1].content.includes('?')
    ) {
      responseCount++;
    }
  }
  
  const answers_prompt_rate = agentQuestions > 0 ? responseCount / agentQuestions : 1.0;
  
  // Slot coverage
  const requiredSlots = context.required_slots || Object.keys(context.slots);
  const filledSlots = requiredSlots.filter(key => {
    const value = context.slots[key];
    return value !== null && value !== undefined && value.trim() !== '';
  }).length;
  
  const slot_coverage = requiredSlots.length > 0 ? filledSlots / requiredSlots.length : 1.0;
  
  // Detail tracking (heuristic: longer user turns suggest engagement)
  const userTurns = conversationHistory.filter(m => m.role === 'user');
  const avgLength = userTurns.reduce((sum, m) => sum + m.content.length, 0) / userTurns.length;
  const detail_tracking_hits = avgLength > 50 ? 3 : avgLength > 30 ? 2 : 1;
  
  // Scoring logic
  let score = 0;
  
  // Answers prompt rate (0-20)
  score += answers_prompt_rate * 20;
  
  // Slot coverage (0-20)
  score += slot_coverage * 20;
  
  // Detail tracking (0-10)
  score += (detail_tracking_hits / 3) * 10;
  
  return {
    score,
    metrics: {
      answers_prompt_rate: Math.round(answers_prompt_rate * 100) / 100,
      detail_tracking_hits,
      slot_coverage: Math.round(slot_coverage * 100) / 100,
    },
  };
}

// ============================================================================
// Repair Scoring (0-30)
// ============================================================================

function scoreRepair(
  repairEvents: Array<{
    event_id: string;
    introduced_turn: number;
    resolved_turn: number | null;
  }>,
  repairPatterns: Array<{ pattern_id: string; type: string; snippet: string }>,
  moveDistribution: Record<string, number>
): {
  score: number;
  metrics: {
    repair_events_total: number;
    repair_events_resolved: number;
    repair_initiations: number;
    repair_completions: number;
  };
} {
  const repair_events_total = repairEvents.length;
  const repair_events_resolved = repairEvents.filter(e => e.resolved_turn !== null).length;
  const repair_initiations = repairPatterns.filter(p => p.type === 'clarification').length;
  const repair_completions = repairPatterns.filter(p => p.type === 'correction' || p.type === 'confirmation').length;
  
  let score = 0;
  
  // Resolution rate (0-15)
  if (repair_events_total > 0) {
    const resolution_rate = repair_events_resolved / repair_events_total;
    score += resolution_rate * 15;
  } else {
    // No repair events required, give partial credit
    score += 10;
  }
  
  // Repair strategy usage (0-15)
  const repairMoveCount = (moveDistribution['REPAIR_INIT'] || 0) + (moveDistribution['REPAIR_EXEC'] || 0);
  const strategyScore = Math.min(repairMoveCount / 2, 1.0) * 15;
  score += strategyScore;
  
  return {
    score,
    metrics: {
      repair_events_total,
      repair_events_resolved,
      repair_initiations,
      repair_completions,
    },
  };
}

// ============================================================================
// Flow Scoring (0-20)
// ============================================================================

function scoreFlow(
  allMoves: Record<number, any[]>,
  moveDistribution: Record<string, number>,
  totalTurns: number
): {
  score: number;
  metrics: {
    questions_count: number;
    proposals_count: number;
    closings_count: number;
    passive_lead_success?: boolean;
  };
} {
  const questions_count = moveDistribution['QUESTION'] || 0;
  const proposals_count = moveDistribution['PROPOSAL'] || 0;
  const closings_count = moveDistribution['CLOSING'] || 0;
  
  let score = 0;
  
  // Questions (0-8)
  const questionScore = Math.min(questions_count / 3, 1.0) * 8;
  score += questionScore;
  
  // Proposals (0-8)
  const proposalScore = Math.min(proposals_count / 2, 1.0) * 8;
  score += proposalScore;
  
  // Closing (0-4)
  const closingScore = closings_count > 0 ? 4 : 0;
  score += closingScore;
  
  return {
    score,
    metrics: {
      questions_count,
      proposals_count,
      closings_count,
    },
  };
}

// ============================================================================
// Legacy Scoring (for backward compatibility)
// ============================================================================

/**
 * Score conversation using LLM (original method)
 * Keep for comparison/fallback
 */
export async function scoreConversationLLM(
  conversationHistory: ConversationMessage[],
  goal: string
): Promise<{
  overall: number;
  subs: {
    comprehension_task: { score: number; evidence: string[] };
    repair: { score: number; evidence: string[] };
    flow: { score: number; evidence: string[] };
  };
  flags: string[];
  confidence: number;
}> {
  // This is the existing implementation
  // Keeping it as fallback
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  const SCORING_SYSTEM_PROMPT = `You are scoring an A2-level French conversation. Output ONLY JSON.
Do not reward fancy vocabulary. Reward understanding, repair, and staying on topic.
False starts/repetitions are NOT penalized.`;
  
  const turnByTurn = conversationHistory
    .map(t => `${t.role === 'agent' ? 'Agent' : 'User'}: ${t.content}`)
    .join('\n');
  
  const userPrompt = `Score:
- comprehension_task (0-50)
- repair (0-30)
- flow (0-20)

Return JSON:
{
  "overall": 0-100,
  "subs": {
    "comprehension_task": {"score":0-50,"evidence":[]},
    "repair": {"score":0-30,"evidence":[]},
    "flow": {"score":0-20,"evidence":[]}
  },
  "flags": [],
  "confidence": 0-1
}

Scenario goal:
${goal}

Conversation (turn by turn):
${turnByTurn}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SCORING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'submit_conversation_score',
            description: 'Submit the conversation scoring results',
            parameters: {
              type: 'object',
              properties: {
                overall: { type: 'number' },
                subs: {
                  type: 'object',
                  properties: {
                    comprehension_task: {
                      type: 'object',
                      properties: {
                        score: { type: 'number' },
                        evidence: { type: 'array', items: { type: 'string' } }
                      },
                      required: ['score', 'evidence']
                    },
                    repair: {
                      type: 'object',
                      properties: {
                        score: { type: 'number' },
                        evidence: { type: 'array', items: { type: 'string' } }
                      },
                      required: ['score', 'evidence']
                    },
                    flow: {
                      type: 'object',
                      properties: {
                        score: { type: 'number' },
                        evidence: { type: 'array', items: { type: 'string' } }
                      },
                      required: ['score', 'evidence']
                    }
                  },
                  required: ['comprehension_task', 'repair', 'flow']
                },
                flags: { type: 'array', items: { type: 'string' } },
                confidence: { type: 'number' }
              },
              required: ['overall', 'subs', 'flags', 'confidence']
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'submit_conversation_score' } }
    }),
  });

  if (!response.ok) {
    throw new Error(`Scoring failed: ${await response.text()}`);
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall) {
    throw new Error('No tool call in scoring response');
  }
  
  return JSON.parse(toolCall.function.arguments);
}

