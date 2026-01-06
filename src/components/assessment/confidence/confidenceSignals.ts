/**
 * Confidence Signal Detector
 * Versioned phrase lists for 5 rubric items
 */

import type { ConfidenceSignal, ConfidenceSignalType } from '@/components/assessment/conversation/types';

// ============================================================================
// Signal Patterns (Versioned v1.0)
// ============================================================================

/**
 * A) Assertiveness / Ownership Signals
 */
export const OWNERSHIP_SIGNALS = [
  'je veux',
  'je voudrais',
  'j\'ai besoin',
  'j\'ai besoin de',
  'je préfère',
  'je décide',
  'je propose',
  'je pense que',
  'je crois que',
  'selon moi',
  'à mon avis',
  'je suggère',
  'je recommande',
];

export const BOUNDARY_SIGNALS = [
  'je ne peux pas',
  'je ne peux plus',
  'ce n\'est pas possible',
  'ça ne me convient pas',
  'ça ne marche pas pour moi',
  'je refuse',
  'je ne suis pas d\'accord',
  'non',
  'pas possible',
];

export const MINIMIZING_SIGNALS = [
  'peu importe',
  'comme vous voulez',
  'comme tu veux',
  'c\'est égal',
  'ça m\'est égal',
  'je ne sais pas',
  'peut-être',
  'si vous voulez',
  'si tu veux',
];

/**
 * B) Emotional Engagement Signals
 */
export const FEELINGS_SIGNALS = [
  'je suis frustré',
  'je suis stressé',
  'je suis content',
  'je suis heureux',
  'je suis inquiet',
  'je suis déçu',
  'je suis fâché',
  'je suis triste',
  'je suis surpris',
  'ça m\'inquiète',
  'ça me stresse',
  'ça me frustre',
  'ça m\'énerve',
];

export const EMPATHY_SIGNALS = [
  'je comprends',
  'je vois',
  'd\'accord',
  'merci',
  'merci beaucoup',
  'c\'est gentil',
  'j\'apprécie',
  'je vous remercie',
  'je te remercie',
];

/**
 * C) Clarity / Structure Signals
 */
export const STRUCTURE_SIGNALS = [
  'd\'abord',
  'premièrement',
  'ensuite',
  'puis',
  'après',
  'finalement',
  'enfin',
  'donc',
  'alors',
  'en résumé',
  'pour résumer',
  'en conclusion',
];

export const REPAIR_SIGNALS = [
  'je reformule',
  'je veux dire',
  'c\'est-à-dire',
  'en fait',
  'en d\'autres termes',
  'autrement dit',
  'pour clarifier',
  'pour être clair',
];

/**
 * D) Confidence Language Signals (use conservatively)
 */
export const CONFIDENT_SIGNALS = [
  'certainement',
  'absolument',
  'tout à fait',
  'bien sûr',
  'évidemment',
  'sans doute',
];

export const HEDGING_SIGNALS = [
  'je pense',  // Conservative: can be normal
  'peut-être',
  'probablement',
  'je suppose',
  'je crois',
  'il me semble',
  'en quelque sorte',
  'plus ou moins',
];

// ============================================================================
// Signal Detection
// ============================================================================

/**
 * Match signals in text
 */
export function matchSignals(
  text: string,
  signals: string[],
  type: ConfidenceSignalType
): ConfidenceSignal[] {
  const lowerText = text.toLowerCase();
  const matches: ConfidenceSignal[] = [];
  
  for (const signal of signals) {
    const index = lowerText.indexOf(signal.toLowerCase());
    if (index !== -1) {
      // Extract the actual snippet from original text
      const snippet = text.substring(index, index + signal.length);
      matches.push({
        type,
        snippet,
      });
    }
  }
  
  return matches;
}

/**
 * Detect all confidence signals in a turn
 */
export function detectConfidenceSignals(text: string): ConfidenceSignal[] {
  const allSignals: ConfidenceSignal[] = [];
  
  // Ownership
  allSignals.push(...matchSignals(text, OWNERSHIP_SIGNALS, 'ownership'));
  
  // Boundary
  allSignals.push(...matchSignals(text, BOUNDARY_SIGNALS, 'boundary'));
  
  // Minimizing
  allSignals.push(...matchSignals(text, MINIMIZING_SIGNALS, 'minimizing'));
  
  // Engagement (feelings)
  allSignals.push(...matchSignals(text, FEELINGS_SIGNALS, 'engagement'));
  
  // Engagement (empathy)
  allSignals.push(...matchSignals(text, EMPATHY_SIGNALS, 'engagement'));
  
  // Structure
  allSignals.push(...matchSignals(text, STRUCTURE_SIGNALS, 'structure'));
  
  // Repair
  allSignals.push(...matchSignals(text, REPAIR_SIGNALS, 'repair'));
  
  // Confidence language
  allSignals.push(...matchSignals(text, CONFIDENT_SIGNALS, 'confidence_language'));
  allSignals.push(...matchSignals(text, HEDGING_SIGNALS, 'confidence_language'));
  
  return allSignals;
}

/**
 * Detect signals across all user turns
 */
export function detectAllSignals(
  userTurns: string[]
): Record<number, ConfidenceSignal[]> {
  const result: Record<number, ConfidenceSignal[]> = {};
  
  userTurns.forEach((turn, index) => {
    result[index] = detectConfidenceSignals(turn);
  });
  
  return result;
}

// ============================================================================
// Signal Counting
// ============================================================================

/**
 * Count signals by type
 */
export function countSignalsByType(
  allSignals: Record<number, ConfidenceSignal[]>
): Record<ConfidenceSignalType, number> {
  const counts: Record<string, number> = {};
  
  Object.values(allSignals).forEach(turnSignals => {
    turnSignals.forEach(signal => {
      counts[signal.type] = (counts[signal.type] || 0) + 1;
    });
  });
  
  return counts as Record<ConfidenceSignalType, number>;
}

/**
 * Get evidence snippets for a type
 */
export function getEvidenceForType(
  allSignals: Record<number, ConfidenceSignal[]>,
  type: ConfidenceSignalType,
  limit: number = 3
): string[] {
  const snippets: string[] = [];
  
  for (const turnSignals of Object.values(allSignals)) {
    for (const signal of turnSignals) {
      if (signal.type === type) {
        snippets.push(signal.snippet);
        if (snippets.length >= limit) {
          return snippets;
        }
      }
    }
  }
  
  return snippets;
}

// ============================================================================
// Analysis Helpers
// ============================================================================

/**
 * Check for over-minimizing (warning flag)
 */
export function isOverMinimizing(counts: Record<ConfidenceSignalType, number>): boolean {
  const minimizing = counts['minimizing'] || 0;
  const ownership = counts['ownership'] || 0;
  
  // Flag if minimizing significantly outweighs ownership
  return minimizing > 2 && ownership === 0;
}

/**
 * Check for low engagement
 */
export function hasLowEngagement(counts: Record<ConfidenceSignalType, number>): boolean {
  const engagement = counts['engagement'] || 0;
  return engagement === 0;
}

/**
 * Check for good structure use
 */
export function hasGoodStructure(counts: Record<ConfidenceSignalType, number>): boolean {
  const structure = counts['structure'] || 0;
  return structure >= 2;
}

