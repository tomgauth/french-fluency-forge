/**
 * Prompt Bank Loader
 * Loads and validates prompt banks from JSON files
 */

import type { PromptBank, ModuleType, Prompt, SyntaxPrompt } from './types';

// Re-export types for consumers
export type { Prompt, SyntaxPrompt, ModuleType } from './types';

// Import prompt banks (we'll create these JSON files next)
import fluencyBank from './promptBanks/fluency.json';
import pronunciationBank from './promptBanks/pronunciation.json';
import confidenceBank from './promptBanks/confidence.json';
import syntaxBank from './promptBanks/syntax.json';
import conversationBank from './promptBanks/conversation.json';
import comprehensionBank from './promptBanks/comprehension.json';
import speakingBank from './promptBanks/speaking.json';

const promptBanks: Record<ModuleType, PromptBank> = {
  fluency: fluencyBank as PromptBank,
  pronunciation: pronunciationBank as PromptBank,
  confidence: confidenceBank as PromptBank,
  syntax: syntaxBank as PromptBank,
  conversation: conversationBank as PromptBank,
  comprehension: comprehensionBank as PromptBank,
  speaking: speakingBank as PromptBank,
};

/**
 * Get prompt bank for a module
 */
export function getPromptBank(module: ModuleType): PromptBank {
  const bank = promptBanks[module];
  if (!bank) {
    throw new Error(`Prompt bank not found for module: ${module}`);
  }
  return bank;
}

/**
 * Get all prompts for a module
 */
export function getPrompts(module: ModuleType): Prompt[] {
  return getPromptBank(module).prompts;
}

/**
 * Get prompt by ID
 */
export function getPromptById(module: ModuleType, promptId: string): Prompt | undefined {
  const prompts = getPrompts(module);
  return prompts.find(p => p.id === promptId);
}

/**
 * Get prompts by IDs (maintains order)
 */
export function getPromptsByIds(module: ModuleType, promptIds: string[]): Prompt[] {
  const prompts = getPrompts(module);
  const promptMap = new Map(prompts.map(p => [p.id, p]));
  
  return promptIds
    .map(id => promptMap.get(id))
    .filter((p): p is Prompt => p !== undefined);
}

/**
 * Filter prompts by tags
 */
export function getPromptsByTags(module: ModuleType, tags: string[]): Prompt[] {
  const prompts = getPrompts(module);
  return prompts.filter(p => 
    tags.some(tag => p.tags.includes(tag))
  );
}

/**
 * Filter prompts by difficulty
 */
export function getPromptsByDifficulty(
  module: ModuleType, 
  minDifficulty: number, 
  maxDifficulty: number
): Prompt[] {
  const prompts = getPrompts(module);
  return prompts.filter(p => 
    p.difficulty >= minDifficulty && p.difficulty <= maxDifficulty
  );
}

/**
 * Get prompt version for a module
 */
export function getPromptVersion(module: ModuleType): string {
  return getPromptBank(module).version;
}

/**
 * Validate that prompt IDs exist in a module
 */
export function validatePromptIds(module: ModuleType, promptIds: string[]): boolean {
  const prompts = getPrompts(module);
  const validIds = new Set(prompts.map(p => p.id));
  return promptIds.every(id => validIds.has(id));
}

/**
 * Get count of available prompts per module
 */
export function getPromptCounts(): Record<ModuleType, number> {
  return {
    fluency: getPrompts('fluency').length,
    pronunciation: getPrompts('pronunciation').length,
    confidence: getPrompts('confidence').length,
    syntax: getPrompts('syntax').length,
    conversation: getPrompts('conversation').length,
    comprehension: getPrompts('comprehension').length,
    speaking: getPrompts('speaking').length,
  };
}
