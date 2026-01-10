/**
 * Phrase Card Component
 * Displays the prompt (recall or recognition mode)
 */

import { Play, Pause, Mic, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePhraseAudio } from '../hooks/usePhraseAudio';
import { getAssistHint } from '../utils/assistLevel';
import type { Phrase, MemberPhraseCard } from '../types';

interface PhraseCardProps {
  phrase: Phrase;
  card?: MemberPhraseCard;
  showSpeechIcon?: boolean;
  onStartSpeech?: () => void;
}

export function PhraseCard({ phrase, card, showSpeechIcon, onStartSpeech }: PhraseCardProps) {
  const isRecall = phrase.mode === 'recall';
  const assistLevel = card?.assist_level || 0;
  const assistHint = getAssistHint(phrase, assistLevel);
  const isPaused = card?.paused_reason === 'struggling';
  
  // For recognition mode, get French text for audio generation
  const frenchText = phrase.transcript_fr || phrase.canonical_fr || '';
  
  // Use audio hook for recognition mode
  const {
    isPlaying,
    isLoading,
    error: audioError,
    play,
    pause,
    replay,
  } = usePhraseAudio({
    phraseId: phrase.id,
    text: frenchText,
    audioUrl: phrase.audio_url,
    autoPlay: false,
  });

  const handlePlayClick = async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  };

  return (
    <div className="relative bg-card border border-border rounded-lg p-8 shadow-sm min-h-[300px] flex flex-col items-center justify-center">
      {/* Pause banner */}
      {isPaused && (
        <Alert className="absolute top-2 left-2 right-2 z-10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            This one is sticky. We paused it — ask your coach and we'll bring it back later.
          </AlertDescription>
        </Alert>
      )}

      {/* Mode badge */}
      <div className="absolute top-4 left-4">
        <Badge variant={isRecall ? 'default' : 'secondary'}>
          {isRecall ? 'Recall' : 'Recognition'}
        </Badge>
      </div>

      {/* Speech icon (if enabled) */}
      {showSpeechIcon && (
        <div className="absolute top-4 right-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onStartSpeech}
            className="rounded-full"
          >
            <Mic className="w-5 h-5 text-muted-foreground hover:text-primary" />
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="text-center space-y-6 w-full max-w-xl">
        {isRecall ? (
          // Recall: Show English prompt
          <>
            <div className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
              Say this in French
            </div>
            <div className="text-2xl md:text-3xl font-medium">
              {phrase.prompt_en}
            </div>
            
            {/* Assist hints */}
            {assistHint.type !== 'none' && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
                {assistHint.type === 'first_chunk' && (
                  <div className="text-lg text-muted-foreground italic">
                    {assistHint.hint}
                  </div>
                )}
                {assistHint.type === 'skeleton' && (
                  <div className="text-xl font-mono">
                    {assistHint.hint}
                  </div>
                )}
                {assistLevel === 4 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Try with microphone for feedback
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          // Recognition: Show audio player
          <>
            <div className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
              Listen and understand
            </div>
            <Button
              size="lg"
              variant="outline"
              className="w-full max-w-sm h-20 text-lg"
              onClick={handlePlayClick}
              disabled={isLoading || !!audioError}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                  Loading audio...
                </>
              ) : isPlaying ? (
                <>
                  <Pause className="w-6 h-6 mr-3" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-6 h-6 mr-3" />
                  Tap to play audio
                </>
              )}
            </Button>
            {/* Hide error display - audio may not be available for all cards */}
            {!isLoading && (
              <div className="text-xs text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={replay}
                  className="h-auto p-1 text-xs"
                >
                  Replay
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

