/**
 * Batch Audio Generation Utility
 * Generates and stores TTS audio for multiple phrases
 */

import { generatePhraseAudio, getAudioUrl, revokeAudioUrl } from './audioGeneration';
import { uploadPhraseAudio, audioExists } from '../services/audioStorage';
import type { Phrase } from '../types';

interface BatchGenerationProgress {
  total: number;
  completed: number;
  failed: number;
  current: string | null;
}

interface BatchGenerationResult {
  success: string[];
  failed: { phraseId: string; error: string }[];
}

/**
 * Generate and store audio for multiple phrases
 * Skips phrases that already have audio stored
 */
export async function batchGenerateAudio(
  phrases: Phrase[],
  onProgress?: (progress: BatchGenerationProgress) => void
): Promise<BatchGenerationResult> {
  const result: BatchGenerationResult = {
    success: [],
    failed: [],
  };

  const total = phrases.length;
  let completed = 0;
  let failed = 0;

  for (const phrase of phrases) {
    // Get the French text to generate audio for
    const text = phrase.canonical_fr || phrase.transcript_fr;
    
    if (!text) {
      failed++;
      result.failed.push({
        phraseId: phrase.id,
        error: 'No French text available',
      });
      onProgress?.({ total, completed, failed, current: null });
      continue;
    }

    onProgress?.({ total, completed, failed, current: phrase.id });

    try {
      // Check if audio already exists
      const exists = await audioExists(phrase.id);
      if (exists) {
        completed++;
        result.success.push(phrase.id);
        onProgress?.({ total, completed, failed, current: null });
        continue;
      }

      // Generate audio
      const blob = await generatePhraseAudio(text);
      
      // Upload to storage
      await uploadPhraseAudio(phrase.id, blob);
      
      completed++;
      result.success.push(phrase.id);
    } catch (err) {
      failed++;
      result.failed.push({
        phraseId: phrase.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    onProgress?.({ total, completed, failed, current: null });
    
    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return result;
}

/**
 * Generate audio for a single phrase if not already stored
 */
export async function generateAndStoreAudio(phrase: Phrase): Promise<string | null> {
  const text = phrase.canonical_fr || phrase.transcript_fr;
  
  if (!text) {
    return null;
  }

  try {
    // Check if audio already exists
    const exists = await audioExists(phrase.id);
    if (exists) {
      return phrase.id;
    }

    // Generate audio
    const blob = await generatePhraseAudio(text);
    
    // Upload to storage
    const url = await uploadPhraseAudio(phrase.id, blob);
    
    return url;
  } catch (err) {
    console.error(`[batchAudioGeneration] Failed to generate audio for phrase ${phrase.id}:`, err);
    return null;
  }
}
