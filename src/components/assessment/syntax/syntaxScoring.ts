/**
 * Enhanced Syntax Scoring with Evidence
 * Deterministic weighted scoring based on LLM tag extraction
 */

import type { SyntaxTag, SyntaxTargetId, SyntaxScore, SyntaxCoverage } from '@/components/assessment/conversation/types';

// ============================================================================
// Target Weights (as per spec)
// ============================================================================

export const SYNTAX_WEIGHTS: Record<SyntaxTargetId, number> = {
  PC: 25,  // Passé composé
  FP: 15,  // Futur proche
  OP: 25,  // Object pronouns (le/la/les/lui/leur)
  Q: 15,   // Questions
  C: 20,   // Connectors + structure
};

// ============================================================================
// Target Definitions
// ============================================================================

export const SYNTAX_TARGET_DEFINITIONS: Record<SyntaxTargetId, {
  name: string;
  description: string;
  examples: string[];
}> = {
  PC: {
    name: 'Passé Composé',
    description: 'Past tense with avoir/être + past participle',
    examples: ["j'ai mangé", "il est allé", "nous avons fait"],
  },
  FP: {
    name: 'Futur Proche',
    description: 'Near future with aller + infinitive',
    examples: ["je vais manger", "il va partir", "nous allons faire"],
  },
  OP: {
    name: 'Object Pronouns',
    description: 'le, la, les, lui, leur as object pronouns',
    examples: ["je le vois", "elle lui parle", "nous les aimons"],
  },
  Q: {
    name: 'Questions',
    description: 'Question formation with inversion, est-ce que, or intonation',
    examples: ["Qu'est-ce que...?", "Est-ce que...?", "Pourquoi...?"],
  },
  C: {
    name: 'Connectors & Structure',
    description: 'Discourse connectors and structural markers',
    examples: ["parce que", "donc", "mais", "d'abord", "ensuite"],
  },
};

// ============================================================================
// Coverage Calculation
// ============================================================================

/**
 * Calculate coverage score for a target based on tags
 */
export function calculateTargetCoverage(
  targetId: SyntaxTargetId,
  tags: SyntaxTag[]
): SyntaxCoverage {
  const targetTags = tags.filter(t => t.target_id === targetId);
  
  if (targetTags.length === 0) {
    return { count: 0, coverage_score: 0.0 };
  }
  
  // Count clear instances
  const clearCount = targetTags.filter(t => t.quality === 'clear').length;
  const maybeCount = targetTags.filter(t => t.quality === 'maybe').length;
  
  // Coverage score logic:
  // - 1.0 if ≥1 clear instance
  // - 0.5 if only "maybe" instances
  // - 0.0 if absent
  
  let coverage_score = 0.0;
  
  if (clearCount >= 1) {
    coverage_score = 1.0;
  } else if (maybeCount >= 1) {
    coverage_score = 0.5;
  }
  
  return {
    count: targetTags.length,
    coverage_score,
  };
}

/**
 * Calculate all target coverages
 */
export function calculateAllCoverages(
  tags: SyntaxTag[]
): Record<SyntaxTargetId, SyntaxCoverage> {
  const targets: SyntaxTargetId[] = ['PC', 'FP', 'OP', 'Q', 'C'];
  
  const coverages: Record<SyntaxTargetId, SyntaxCoverage> = {} as any;
  
  for (const target of targets) {
    coverages[target] = calculateTargetCoverage(target, tags);
  }
  
  return coverages;
}

// ============================================================================
// Scoring
// ============================================================================

/**
 * Calculate syntax score from tags
 */
export function calculateSyntaxScore(tags: SyntaxTag[]): SyntaxScore {
  const coverages = calculateAllCoverages(tags);
  
  // Calculate subscores (weight * coverage_score)
  const PC = SYNTAX_WEIGHTS.PC * coverages.PC.coverage_score;
  const FP = SYNTAX_WEIGHTS.FP * coverages.FP.coverage_score;
  const OP = SYNTAX_WEIGHTS.OP * coverages.OP.coverage_score;
  const Q = SYNTAX_WEIGHTS.Q * coverages.Q.coverage_score;
  const C = SYNTAX_WEIGHTS.C * coverages.C.coverage_score;
  
  const total = PC + FP + OP + Q + C;
  
  return {
    score: Math.round(total),
    PC: Math.round(PC),
    FP: Math.round(FP),
    OP: Math.round(OP),
    Q: Math.round(Q),
    C: Math.round(C),
    coverage: coverages,
  };
}

// ============================================================================
// LLM Tag Extraction (to be called from edge function)
// ============================================================================

/**
 * Build prompt for syntax tag extraction
 */
export function buildSyntaxTagPrompt(transcript: string): string {
  return `Extract grammatical features from this French transcript.

TARGETS TO IDENTIFY:
1. PC (Passé Composé): avoir/être + past participle (e.g., "j'ai mangé", "il est allé")
2. FP (Futur Proche): aller + infinitive (e.g., "je vais manger", "il va partir")
3. OP (Object Pronouns): le, la, les, lui, leur as object pronouns (e.g., "je le vois", "elle lui parle")
4. Q (Questions): any question formation (inversion, est-ce que, intonation)
5. C (Connectors): discourse connectors like parce que, donc, mais, d'abord, ensuite, alors, etc.

QUALITY RATINGS:
- "clear": Direct, unambiguous evidence in transcript
- "maybe": Possible instance but unclear or incomplete
- "incorrect": Attempted but grammatically wrong

TRANSCRIPT:
${transcript}

For each target found, provide:
- target_id (PC, FP, OP, Q, or C)
- snippet (exact phrase from transcript)
- quality (clear, maybe, or incorrect)

Return JSON array of tags. If none found for a target, omit it.`;
}

/**
 * Build OpenAI function schema for tag extraction
 */
export function buildSyntaxTagFunctionSchema() {
  return {
    name: 'extract_syntax_tags',
    description: 'Extract grammatical feature tags from French transcript',
    parameters: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              target_id: {
                type: 'string',
                enum: ['PC', 'FP', 'OP', 'Q', 'C'],
              },
              snippet: { type: 'string' },
              quality: {
                type: 'string',
                enum: ['clear', 'maybe', 'incorrect'],
              },
            },
            required: ['target_id', 'snippet', 'quality'],
          },
        },
        debug_flags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional debug flags like "asr_correction_suspicion_high"',
        },
      },
      required: ['tags'],
    },
  };
}

// ============================================================================
// Debug Flags
// ============================================================================

/**
 * Detect potential issues with syntax tags
 */
export function detectSyntaxDebugFlags(tags: SyntaxTag[], transcript: string): string[] {
  const flags: string[] = [];
  
  // Check for missing evidence
  const missingEvidence = tags.filter(t => !t.snippet || t.snippet.trim() === '');
  if (missingEvidence.length > 0) {
    flags.push('no_evidence_for_claim');
  }
  
  // Check for ASR auto-correction suspicion
  // (advanced forms appear isolated without surrounding context)
  const advancedForms = tags.filter(t =>
    t.quality === 'clear' &&
    (t.target_id === 'PC' || t.target_id === 'OP') &&
    transcript.split(/\s+/).length < 50
  );
  
  if (advancedForms.length > 2 && transcript.length < 200) {
    flags.push('asr_correction_suspicion_high');
  }
  
  return flags;
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format syntax score for display
 */
export function formatSyntaxScore(score: SyntaxScore): {
  summary: string;
  details: string[];
} {
  const summary = `Total: ${score.score}/100`;
  
  const details = [
    `PC (Passé Composé): ${score.PC}/${SYNTAX_WEIGHTS.PC}`,
    `FP (Futur Proche): ${score.FP}/${SYNTAX_WEIGHTS.FP}`,
    `OP (Object Pronouns): ${score.OP}/${SYNTAX_WEIGHTS.OP}`,
    `Q (Questions): ${score.Q}/${SYNTAX_WEIGHTS.Q}`,
    `C (Connectors): ${score.C}/${SYNTAX_WEIGHTS.C}`,
  ];
  
  return { summary, details };
}

/**
 * Get target status icon for display
 */
export function getTargetStatusIcon(coverage: SyntaxCoverage): string {
  if (coverage.coverage_score === 1.0) return '✓';
  if (coverage.coverage_score > 0) return '?';
  return '✗';
}

/**
 * Get target status label
 */
export function getTargetStatusLabel(coverage: SyntaxCoverage): string {
  if (coverage.coverage_score === 1.0) return 'Clear';
  if (coverage.coverage_score > 0) return 'Maybe';
  return 'Absent';
}

