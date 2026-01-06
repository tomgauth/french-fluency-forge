/**
 * Repair Event Library
 * Inlined for edge function deployment
 */

// ============================================================================
// Types
// ============================================================================

export type RepairEventType = 'E1' | 'E2' | 'E3' | 'E4' | 'E5';

export interface RepairEvent {
  event_id: RepairEventType;
  event_type: string;
  introduced_turn: number;
  resolved_turn: number | null;
  resolution_evidence_snippet?: string;
}

export interface RepairEventDefinition {
  id: RepairEventType;
  name: string;
  description: string;
  example_trigger: string;
  example_resolution: string;
  detection_keywords: string[];
}

// ============================================================================
// Repair Event Definitions
// ============================================================================

export const REPAIR_EVENTS: Record<RepairEventType, RepairEventDefinition> = {
  E1: {
    id: 'E1',
    name: 'Misheard number/date',
    description: 'Bot repeats wrong value: user must correct + confirm',
    example_trigger: 'Vous avez dit le 15 mars? (when user said 14 mars)',
    example_resolution: 'Non, le 14 mars, pas le 15.',
    detection_keywords: ['non', 'pas', 'correction', 'erreur', 'plutôt', 'en fait'],
  },
  E2: {
    id: 'E2',
    name: 'Ambiguous instruction',
    description: 'Bot says something ambiguous, user must ask for clarification',
    example_trigger: 'Vous devez faire ça avant.',
    example_resolution: 'Avant quand? / Avant quoi?',
    detection_keywords: ['avant', 'quand', 'quel', 'quelle', 'préciser', 'clarifier', '?'],
  },
  E3: {
    id: 'E3',
    name: 'Contradiction',
    description: 'Bot contradicts earlier statement; user must notice and clarify',
    example_trigger: 'Turn 2: "C\'est ouvert jusqu\'à 18h" → Turn 5: "On ferme à 17h"',
    example_resolution: 'Attendez, vous avez dit 18h avant. C\'est 17h ou 18h?',
    detection_keywords: ['attendez', 'mais', 'vous avez dit', 'contradiction', 'avant'],
  },
  E4: {
    id: 'E4',
    name: 'Wrong assumption',
    description: 'Bot assumes wrong goal; user must re-state goal',
    example_trigger: 'Ah, vous voulez annuler? (when user wants to change)',
    example_resolution: 'Non, je veux changer, pas annuler.',
    detection_keywords: ['non', 'pas', 'en fait', 'je veux', 'je voudrais'],
  },
  E5: {
    id: 'E5',
    name: 'Missing required document/info',
    description: 'Bot reveals it late; user must ask what\'s needed and next steps',
    example_trigger: 'Ah, il faut aussi votre numéro de référence.',
    example_resolution: 'Quel numéro? Où je le trouve?',
    detection_keywords: ['quel', 'quelle', 'où', 'comment', 'besoin', 'nécessaire', '?'],
  },
};

// ============================================================================
// Resolution Detection
// ============================================================================

export function detectResolution(
  repairEvent: RepairEvent,
  userTurn: string
): { resolved: boolean; confidence: number; evidence: string } {
  const definition = REPAIR_EVENTS[repairEvent.event_id];
  const lowerTurn = userTurn.toLowerCase();
  
  const keywordMatches = definition.detection_keywords.filter(keyword =>
    lowerTurn.includes(keyword.toLowerCase())
  );
  
  const keywordScore = Math.min(keywordMatches.length / 2, 1.0);
  
  let typeScore = 0;
  let evidence = '';
  
  switch (repairEvent.event_id) {
    case 'E1':
      if (/\b(non|pas)\b/.test(lowerTurn)) {
        typeScore = 0.5;
        evidence = 'User corrected with negation';
      }
      if (/\b\d+\b/.test(lowerTurn)) {
        typeScore += 0.3;
        evidence += ' and provided correct number';
      }
      break;
      
    case 'E2':
      if (lowerTurn.includes('?')) {
        typeScore = 0.6;
        evidence = 'User asked clarifying question';
      }
      if (/(avant quand|avant quoi|quel|quelle)/.test(lowerTurn)) {
        typeScore = 0.8;
        evidence = 'User asked specific clarification';
      }
      break;
      
    case 'E3':
      if (/(vous avez dit|avant|mais|attendez)/.test(lowerTurn)) {
        typeScore = 0.7;
        evidence = 'User noticed contradiction';
      }
      break;
      
    case 'E4':
      if (/\b(non|pas)\b/.test(lowerTurn)) {
        typeScore = 0.4;
        evidence = 'User rejected assumption';
      }
      if (/(je veux|je voudrais|en fait)/.test(lowerTurn)) {
        typeScore += 0.4;
        evidence += ' and restated goal';
      }
      break;
      
    case 'E5':
      if (lowerTurn.includes('?')) {
        typeScore = 0.5;
        evidence = 'User asked question';
      }
      if (/(quel|où|comment|besoin)/.test(lowerTurn)) {
        typeScore = 0.8;
        evidence = 'User asked about requirements';
      }
      break;
  }
  
  const combinedScore = (keywordScore + typeScore) / 2;
  const resolved = combinedScore > 0.5;
  
  return {
    resolved,
    confidence: combinedScore,
    evidence: evidence || keywordMatches.join(', '),
  };
}

// ============================================================================
// Repair Event Prompt Generation
// ============================================================================

export function generateRepairEventPrompt(
  eventType: RepairEventType,
  context: string
): string {
  switch (eventType) {
    case 'E1':
      return `
In your next response, slightly mishear or misstate a number or date the user mentioned.
For example, if they said "14 mars", respond with "Le 15 mars, c'est ça?"
Wait for them to correct you.
Context: ${context}
`;
      
    case 'E2':
      return `
In your next response, give an ambiguous instruction or vague timeframe.
Use words like "avant", "après", "bientôt" without specifying when/what.
Example: "Vous devez faire ça avant." or "On va traiter ça après."
Wait for them to ask for clarification.
Context: ${context}
`;
      
    case 'E3':
      return `
In your next response, contradict something you said earlier in the conversation.
Example: If you said the office closes at 18h, now say it closes at 17h.
Wait for them to notice the contradiction.
Context: ${context}
`;
      
    case 'E4':
      return `
In your next response, assume the wrong goal or action.
Example: If they want to change something, ask "Vous voulez annuler?"
Wait for them to correct your assumption.
Context: ${context}
`;
      
    case 'E5':
      return `
In your next response, reveal a requirement or needed document you didn't mention before.
Example: "Ah, il faut aussi votre numéro de référence" or "Il me faut une pièce d'identité."
Wait for them to ask what it is or where to find it.
Context: ${context}
`;
      
    default:
      return '';
  }
}

// ============================================================================
// Repair Pattern Matching
// ============================================================================

export interface RepairPattern {
  id: string;
  pattern: RegExp;
  type: 'clarification' | 'correction' | 'confirmation' | 'paraphrase';
  example: string;
}

export const REPAIR_PATTERNS: RepairPattern[] = [
  {
    id: 'RP01',
    pattern: /pardon,?\s*(je\s*n['\']ai\s*pas\s*compris|je\s*ne\s*comprends\s*pas)/i,
    type: 'clarification',
    example: 'Pardon, je n\'ai pas compris',
  },
  {
    id: 'RP02',
    pattern: /vous\s*pouvez\s*répéter/i,
    type: 'clarification',
    example: 'Vous pouvez répéter ?',
  },
  {
    id: 'RP03',
    pattern: /quand\s*vous\s*dites\s*.*vous\s*voulez\s*dire/i,
    type: 'paraphrase',
    example: 'Quand vous dites X, vous voulez dire Y ?',
  },
  {
    id: 'RP04',
    pattern: /juste\s*pour\s*confirmer/i,
    type: 'confirmation',
    example: 'Juste pour confirmer…',
  },
  {
    id: 'RP05',
    pattern: /en\s*fait,?\s*(je\s*veux\s*dire|je\s*voulais\s*dire)/i,
    type: 'correction',
    example: 'En fait, je veux dire…',
  },
  {
    id: 'RP06',
    pattern: /c['\']est-à-dire/i,
    type: 'clarification',
    example: 'C\'est-à-dire ?',
  },
  {
    id: 'RP07',
    pattern: /je\s*reformule/i,
    type: 'paraphrase',
    example: 'Je reformule : …',
  },
  {
    id: 'RP08',
    pattern: /si\s*je\s*comprends\s*bien/i,
    type: 'confirmation',
    example: 'Si je comprends bien, …',
  },
  {
    id: 'RP09',
    pattern: /pour\s*être\s*sûr/i,
    type: 'confirmation',
    example: 'Pour être sûr, …',
  },
  {
    id: 'RP10',
    pattern: /qu['\']est-ce\s*que\s*(ça\s*veut\s*dire|vous\s*voulez\s*dire)/i,
    type: 'clarification',
    example: 'Qu\'est-ce que ça veut dire ?',
  },
];

export function matchRepairPatterns(userTurn: string): Array<{
  pattern_id: string;
  type: string;
  snippet: string;
}> {
  const matches: Array<{ pattern_id: string; type: string; snippet: string }> = [];
  
  for (const pattern of REPAIR_PATTERNS) {
    const match = userTurn.match(pattern.pattern);
    if (match) {
      matches.push({
        pattern_id: pattern.id,
        type: pattern.type,
        snippet: match[0],
      });
    }
  }
  
  return matches;
}
