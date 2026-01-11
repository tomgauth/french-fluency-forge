/**
 * Phrases Session Page
 * Active session UI with phrase cards and rating flow
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminPadding } from '@/components/AdminPadding';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle } from 'lucide-react';
import { usePhrasesSession } from '@/features/phrases/hooks/usePhrasesSession';
import { usePhrasesSettings } from '@/features/phrases/hooks/usePhrasesSettings';
import { SessionHeader } from '@/features/phrases/components/SessionHeader';
import { PhraseCard } from '@/features/phrases/components/PhraseCard';
import { RevealPanel } from '@/features/phrases/components/RevealPanel';
import { RatingButtons } from '@/features/phrases/components/RatingButtons';
import { PhraseActionsMenu } from '@/features/phrases/components/PhraseActionsMenu';
import { SpeechFeedbackPanel } from '@/features/phrases/components/SpeechFeedbackPanel';
import { EmptyState } from '@/features/phrases/components/EmptyState';
import type { Rating } from '@/features/phrases/types';

export default function PhrasesSessionPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = usePhrasesSettings();
  const {
    sessionState,
    currentCard,
    currentPhrase,
    loading,
    isComplete,
    estimatedTimeLeft,
    intervals,
    exactDueDates,
    speechResult,
    actions,
  } = usePhrasesSession();

  // Start session on mount if not already started
  useEffect(() => {
    if (!loading && !sessionState) {
      const newSession = actions.startSession();
      if (!newSession) {
        // No cards available
        toast({
          title: 'No phrases available',
          description: 'Add some phrases to get started!',
        });
        navigate('/phrases');
      }
    }
  }, [loading, sessionState, actions, toast, navigate]);

  if (loading) {
    return (
      <AdminPadding>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Loading session...</div>
        </div>
      </AdminPadding>
    );
  }

  if (!sessionState) {
    return (
      <AdminPadding>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Preparing session...</div>
        </div>
      </AdminPadding>
    );
  }

  // Session complete
  if (isComplete) {
    return (
      <AdminPadding>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6 max-w-md"
          >
            <div className="flex justify-center">
              <div className="p-6 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold mb-2">Session complete!</h1>
              <p className="text-muted-foreground">
                You reviewed {sessionState.completed} phrase{sessionState.completed !== 1 ? 's' : ''}. 
                Great work!
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => navigate('/phrases/library')}
              >
                View library
              </Button>
              <Button onClick={() => navigate('/phrases')}>
                Back to phrases
              </Button>
            </div>
          </motion.div>
        </div>
      </AdminPadding>
    );
  }

  if (!currentCard || !currentPhrase) {
    return (
      <AdminPadding>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <EmptyState
            icon={CheckCircle}
            title="No more cards"
            description="All done for now!"
            action={{
              label: 'Back to phrases',
              onClick: () => navigate('/phrases'),
            }}
          />
        </div>
      </AdminPadding>
    );
  }

  const handleRate = (rating: Rating) => {
    const updatedCard = actions.rateCard(rating);
    if (updatedCard && intervals) {
      toast({
        title: 'Rated!',
        description: `Next review: ${intervals[rating]}`,
      });
    }
  };

  const timeToReveal = sessionState.isRevealed && sessionState.revealTime && sessionState.startTime
    ? sessionState.revealTime - sessionState.startTime
    : undefined;

  return (
    <AdminPadding>
      <div className="min-h-screen bg-background">
        <SessionHeader
          completed={sessionState.completed}
          total={sessionState.total}
          estimatedTimeLeft={estimatedTimeLeft}
        />

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="space-y-6">
            {/* Actions menu */}
            <div className="flex justify-end">
              <PhraseActionsMenu
                onAddNote={(note) => {
                  actions.addNote(note);
                  toast({ title: 'Note saved' });
                }}
                onFlag={(reason) => {
                  actions.flagCard(reason);
                  toast({ title: 'Issue flagged', description: 'Thanks for reporting!' });
                }}
                onBury={() => {
                  actions.buryCard();
                  toast({ title: 'Phrase buried', description: 'Hidden until tomorrow' });
                }}
                onSuspend={() => {
                  actions.suspendCard();
                  toast({ title: 'Phrase suspended', description: 'Hidden indefinitely' });
                }}
                onRemove={() => {
                  actions.removeCard();
                  toast({ title: 'Phrase removed', description: 'Removed from your set' });
                }}
              />
            </div>

            {/* Phrase card with animation */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentCard.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
              >
                <PhraseCard
                  phrase={currentPhrase}
                  showSpeechIcon={settings.speech_feedback_enabled}
                />
              </motion.div>
            </AnimatePresence>

            {/* Speech feedback (if enabled and recall mode) */}
            {!sessionState.isRevealed && 
             settings.speech_feedback_enabled && 
             currentPhrase.mode === 'recall' && (
              <SpeechFeedbackPanel 
                enabled={settings.speech_feedback_enabled}
                targetText={currentPhrase.answers_fr || [currentPhrase.canonical_fr || '']}
                onTranscript={actions.handleSpeechResult}
              />
            )}

            {/* Reveal button or revealed content */}
            {!sessionState.isRevealed ? (
              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={actions.revealCard}
                  className="min-w-[200px]"
                >
                  Reveal answer
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <RevealPanel
                  phrase={currentPhrase}
                  timeToReveal={timeToReveal}
                  showTimeToReveal={settings.show_time_to_recall}
                />
                <RatingButtons
                  onRate={handleRate}
                  intervals={intervals || undefined}
                  exactDueDates={exactDueDates || undefined}
                  suggestedRating={speechResult && settings.auto_assess_enabled 
                    ? (speechResult as any).suggestedRating 
                    : undefined}
                />
              </div>
            )}

            {/* Keyboard shortcuts hint */}
            <div className="text-center text-xs text-muted-foreground">
              <p>Tip: Use keyboard shortcuts 1-4 for rating</p>
            </div>
          </div>
        </div>
      </div>
    </AdminPadding>
  );
}

