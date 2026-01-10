/**
 * Reveal Panel Component
 * Shows the answer after reveal
 */

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Volume2, Loader2 } from 'lucide-react';
import type { Phrase } from '../types';
import { ExplanationChips } from './ExplanationChips';
import { usePhraseAudio } from '../hooks/usePhraseAudio';

interface RevealPanelProps {
  phrase: Phrase;
  timeToReveal?: number; // milliseconds
  showTimeToReveal?: boolean;
}

export function RevealPanel({ phrase, timeToReveal, showTimeToReveal }: RevealPanelProps) {
  const isRecall = phrase.mode === 'recall';
  const frenchText = phrase.canonical_fr || phrase.transcript_fr || '';
  const { isPlaying, isLoading, play } = usePhraseAudio({
    phraseId: phrase.id,
    text: frenchText,
    audioUrl: phrase.audio_url,
  });

  const formatTime = (ms: number): string => {
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card border border-border rounded-lg p-6 shadow-sm"
    >
      {/* French answer */}
      <div className="mb-6">
        <div className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
          {isRecall ? 'Answer' : 'French'}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-3xl font-serif">
            {phrase.canonical_fr || phrase.transcript_fr}
          </div>
          {/* Audio playback button */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={play}
            disabled={isLoading || isPlaying}
            title="Listen to pronunciation"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Volume2 className={`h-5 w-5 ${isPlaying ? 'text-primary animate-pulse' : ''}`} />
            )}
          </Button>
        </div>
        
        {/* Acceptable variants (recall only) */}
        {isRecall && phrase.answers_fr && phrase.answers_fr.length > 1 && (
          <div className="mt-3">
            <div className="text-xs text-muted-foreground mb-2">Also acceptable:</div>
            <div className="space-y-1">
              {phrase.answers_fr
                .filter((answer) => answer !== phrase.canonical_fr)
                .map((answer, i) => (
                  <div key={i} className="text-sm text-muted-foreground">
                    • {answer}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* English translation (recognition only) */}
      {!isRecall && phrase.translation_en && (
        <div className="mb-6 pb-6 border-b border-border">
          <div className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
            English
          </div>
          <div className="text-lg">
            {phrase.translation_en}
          </div>
        </div>
      )}

      {/* Tags and difficulty */}
      <div className="flex flex-wrap items-center gap-2">
        {phrase.tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="font-normal">
            {tag}
          </Badge>
        ))}
        <Badge variant="outline" className="font-normal">
          Difficulty {phrase.difficulty}/5
        </Badge>
        {showTimeToReveal && timeToReveal && (
          <Badge variant="outline" className="font-normal ml-auto">
            Revealed after {formatTime(timeToReveal)}
          </Badge>
        )}
      </div>

      {/* Explanation chips */}
      <ExplanationChips phraseId={phrase.id} />
    </motion.div>
  );
}

