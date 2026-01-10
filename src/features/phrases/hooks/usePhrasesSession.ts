/**
 * Phrases Session Hook
 * Manages session state, queue, and review logic
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { MemberPhraseCard, Rating, PhraseReviewLog, SessionState, Phrase } from '../types';
import { getPhraseById } from '../data/mockPhrasesData';
import { buildSessionQueue } from '../data/schedulerMock';
import { 
  calculateNextReviewFSRS, 
  previewAllIntervalsFSRS,
  formatIntervalFSRS,
  getFSRSConfigFromSettings,
} from '../data/fsrsScheduler';
import { usePhrasesSettings } from './usePhrasesSettings';
import type { SpeechRecognitionResult } from '../services/speechRecognition';
import { fetchMemberCardsWithPhrases, insertReviewLog, upsertMemberCards } from '../services/phrasesApi';
import { runMigrationIfNeeded } from '../utils/migrateLocalStorage';

export function usePhrasesSession() {
  const { user } = useAuth();
  const memberId = user?.id || 'guest';
  const { settings } = usePhrasesSettings();
  
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [cards, setCards] = useState<MemberPhraseCard[]>([]);
  const [reviewLogs, setReviewLogs] = useState<PhraseReviewLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [speechResult, setSpeechResult] = useState<SpeechRecognitionResult | null>(null);
  const [phraseMap, setPhraseMap] = useState<Record<string, Phrase>>({});

  // Load cards and logs from Supabase (or localStorage for guests)
  useEffect(() => {
    let isActive = true;
    const load = async () => {
      setLoading(true);
      try {
        if (user?.id) {
          await runMigrationIfNeeded(user.id);
          const { cards: dbCards, phraseMap: dbPhrases } = await fetchMemberCardsWithPhrases(user.id);
          if (!isActive) return;
          
          // If Supabase returned cards, use them
          if (dbCards.length > 0) {
            setCards(dbCards);
            setPhraseMap(dbPhrases);
            localStorage.setItem(`solv_phrases_cards_${user.id}`, JSON.stringify(dbCards));
          } else {
            // Supabase returned empty, check localStorage for cached cards
            const cardsKey = `solv_phrases_cards_${user.id}`;
            const storedCards = localStorage.getItem(cardsKey);
            if (storedCards) {
              try {
                const parsed = JSON.parse(storedCards);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  console.log('[usePhrasesSession] Using localStorage cards (Supabase empty)');
                  setCards(parsed);
                  // Build phrase map from mock data AND localStorage phrases
                  const localPhraseMap: Record<string, Phrase> = {};
                  
                  // First, load any TSV-imported phrases from localStorage
                  const phrasesKey = `solv_phrases_${user.id}`;
                  const storedPhrases = localStorage.getItem(phrasesKey);
                  if (storedPhrases) {
                    try {
                      const parsedPhrases = JSON.parse(storedPhrases);
                      if (Array.isArray(parsedPhrases)) {
                        for (const phrase of parsedPhrases) {
                          if (phrase.id) {
                            localPhraseMap[phrase.id] = phrase;
                          }
                        }
                      }
                    } catch (err) {
                      console.error('[usePhrasesSession] Failed to parse localStorage phrases:', err);
                    }
                  }
                  
                  // Then, fill in any missing from mock data
                  for (const card of parsed) {
                    if (!localPhraseMap[card.phrase_id]) {
                      const phrase = getPhraseById(card.phrase_id);
                      if (phrase) {
                        localPhraseMap[phrase.id] = phrase;
                      }
                    }
                  }
                  setPhraseMap(localPhraseMap);
                }
              } catch (err) {
                console.error('[usePhrasesSession] Failed to parse localStorage:', err);
              }
            }
          }
        } else {
          const cardsKey = `solv_phrases_cards_${memberId}`;
          const logsKey = `solv_phrases_logs_${memberId}`;
          
          const storedCards = localStorage.getItem(cardsKey);
          const storedLogs = localStorage.getItem(logsKey);
          
          if (storedCards) {
            try {
              const parsedCards = JSON.parse(storedCards);
              setCards(parsedCards);
              // Build phrase map from localStorage phrases AND mock data
              const localPhraseMap: Record<string, Phrase> = {};
              
              // First, load any TSV-imported phrases from localStorage
              const phrasesKey = `solv_phrases_${memberId}`;
              const storedPhrases = localStorage.getItem(phrasesKey);
              if (storedPhrases) {
                try {
                  const parsedPhrases = JSON.parse(storedPhrases);
                  if (Array.isArray(parsedPhrases)) {
                    for (const phrase of parsedPhrases) {
                      if (phrase.id) {
                        localPhraseMap[phrase.id] = phrase;
                      }
                    }
                  }
                } catch (err) {
                  console.error('[usePhrasesSession] Failed to parse localStorage phrases:', err);
                }
              }
              
              // Then, fill in any missing from mock data
              for (const card of parsedCards) {
                if (!localPhraseMap[card.phrase_id]) {
                  const phrase = getPhraseById(card.phrase_id);
                  if (phrase) {
                    localPhraseMap[phrase.id] = phrase;
                  }
                }
              }
              setPhraseMap(localPhraseMap);
            } catch (err) {
              console.error('Failed to load cards:', err);
            }
          }
          
          if (storedLogs) {
            try {
              setReviewLogs(JSON.parse(storedLogs));
            } catch (err) {
              console.error('Failed to load logs:', err);
            }
          }
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [memberId, user?.id]);

  // Persist cards (Supabase for authed users, local cache for guests)
  const persistCards = useCallback((updatedCards: MemberPhraseCard[]) => {
    setCards(updatedCards);
    const key = `solv_phrases_cards_${memberId}`;
    localStorage.setItem(key, JSON.stringify(updatedCards));

    if (user?.id) {
      void upsertMemberCards(updatedCards);
    }
  }, [memberId, user?.id]);

  // Persist logs (append-only); Supabase for authed users, local otherwise
  const persistLogs = useCallback((updatedLogs: PhraseReviewLog[]) => {
    setReviewLogs(updatedLogs);
    const key = `solv_phrases_logs_${memberId}`;
    localStorage.setItem(key, JSON.stringify(updatedLogs));

    if (user?.id) {
      const latest = updatedLogs[updatedLogs.length - 1];
      if (latest) {
        void insertReviewLog(latest);
      }
    }
  }, [memberId, user?.id]);

  // Start a new session
  const startSession = useCallback(() => {
    const queue = buildSessionQueue(cards, settings.new_per_day, settings.reviews_per_day);
    
    if (queue.length === 0) {
      return null;
    }

    const newSession: SessionState = {
      queue,
      currentIndex: 0,
      isRevealed: false,
      startTime: Date.now(),
      completed: 0,
      total: queue.length,
    };

    setSessionState(newSession);
    return newSession;
  }, [cards, settings]);

  // Get current card
  const currentCard = sessionState && sessionState.currentIndex < sessionState.queue.length
    ? sessionState.queue[sessionState.currentIndex]
    : null;

  const currentPhrase = currentCard
    ? phraseMap[currentCard.phrase_id] || getPhraseById(currentCard.phrase_id)
    : null;

  // Reveal card
  const revealCard = useCallback(() => {
    if (!sessionState) return;
    
    setSessionState({
      ...sessionState,
      isRevealed: true,
      revealTime: Date.now(),
    });
  }, [sessionState]);

  // Store speech recognition result
  const handleSpeechResult = useCallback((result: SpeechRecognitionResult) => {
    setSpeechResult(result);
    
    // Auto-assess if enabled
    if (settings.auto_assess_enabled) {
      // Suggest rating based on similarity
      let suggestedRating: Rating = 'good';
      if (result.similarity >= 0.90) {
        suggestedRating = 'easy';
      } else if (result.similarity >= 0.75) {
        suggestedRating = 'good';
      } else if (result.similarity >= 0.50) {
        suggestedRating = 'hard';
      } else {
        suggestedRating = 'again';
      }
      
      // Store suggested rating in result (will be used when rating)
      (result as any).suggestedRating = suggestedRating;
    }
  }, [settings.auto_assess_enabled]);

  // Rate card
  const rateCard = useCallback((rating: Rating) => {
    if (!sessionState || !currentCard || !currentPhrase) return;

    const now = new Date();
    const responseTime = sessionState.revealTime && sessionState.startTime
      ? sessionState.revealTime - sessionState.startTime
      : undefined;

    // Calculate overdue metrics
    const lastReviewedAt = currentCard.scheduler.last_reviewed_at 
      ? new Date(currentCard.scheduler.last_reviewed_at)
      : now;
    const dueAt = new Date(currentCard.scheduler.due_at);
    const elapsedMs = now.getTime() - lastReviewedAt.getTime();
    const wasOverdue = dueAt < now;
    const overdueMs = wasOverdue ? now.getTime() - dueAt.getTime() : 0;

    // Store before state
    const stateBefore = currentCard.scheduler.state;
    const dueBefore = currentCard.scheduler.due_at;
    const intervalBeforeMs = currentCard.scheduler.interval_ms;
    const stabilityBefore = currentCard.scheduler.stability;
    const difficultyBefore = currentCard.scheduler.difficulty;

    // Update card with new scheduling using FSRS
    const fsrsConfig = getFSRSConfigFromSettings(settings);
    const { card: updatedCard } = calculateNextReviewFSRS(currentCard, rating, fsrsConfig, now);
    const updatedCards = cards.map((c) => c.id === updatedCard.id ? updatedCard : c);
    persistCards(updatedCards);

    // Enhanced review log with all FSRS fields
    const log: PhraseReviewLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      member_id: memberId,
      phrase_id: currentCard.phrase_id,
      card_id: currentCard.id,
      started_at: new Date(sessionState.startTime || Date.now()).toISOString(),
      revealed_at: sessionState.revealTime ? new Date(sessionState.revealTime).toISOString() : undefined,
      rated_at: now.toISOString(),
      rating,
      response_time_ms: responseTime,
      mode: currentPhrase.mode,
      
      // FSRS scheduling data
      state_before: stateBefore,
      state_after: updatedCard.scheduler.state,
      due_before: dueBefore,
      due_after: updatedCard.scheduler.due_at,
      interval_before_ms: intervalBeforeMs,
      interval_after_ms: updatedCard.scheduler.interval_ms || 0,
      stability_before: stabilityBefore,
      stability_after: updatedCard.scheduler.stability,
      difficulty_before: difficultyBefore,
      difficulty_after: updatedCard.scheduler.difficulty,
      elapsed_ms: elapsedMs,
      was_overdue: wasOverdue,
      overdue_ms: overdueMs > 0 ? overdueMs : undefined,
      
      // Config snapshot
      config_snapshot: {
        fsrs_version: 6,
        request_retention: settings.target_retention,
        learning_steps: ['1m', '10m'], // TODO: get from settings if we add this
        relearning_steps: ['10m'],
        enable_fuzz: false,
      },
      
      // Speech data
      speech_used: speechResult !== null,
      transcript: speechResult?.transcript,
      similarity: speechResult?.similarity,
      auto_assessed: settings.auto_assess_enabled && speechResult !== null,
      suggested_rating: (speechResult as any)?.suggestedRating,
    };
    persistLogs([...reviewLogs, log]);
    
    // Clear speech result for next card
    setSpeechResult(null);

    // Move to next card
    const nextIndex = sessionState.currentIndex + 1;
    
    if (nextIndex >= sessionState.queue.length) {
      // Session complete
      setSessionState({
        ...sessionState,
        currentIndex: nextIndex,
        completed: sessionState.completed + 1,
        isRevealed: false,
      });
    } else {
      // Next card
      setSessionState({
        ...sessionState,
        currentIndex: nextIndex,
        completed: sessionState.completed + 1,
        isRevealed: false,
        startTime: Date.now(),
        revealTime: undefined,
      });
    }

    return updatedCard;
  }, [sessionState, currentCard, currentPhrase, cards, persistCards, reviewLogs, persistLogs, memberId, speechResult, settings]);

  // Card actions during session
  const buryCard = useCallback(() => {
    if (!currentCard) return;
    
    const updatedCard = {
      ...currentCard,
      status: 'buried' as const,
      updated_at: new Date().toISOString(),
    };
    const updatedCards = cards.map((c) => c.id === updatedCard.id ? updatedCard : c);
    persistCards(updatedCards);

    // Remove from queue and move to next
    const newQueue = sessionState!.queue.filter((_, i) => i !== sessionState!.currentIndex);
    setSessionState({
      ...sessionState!,
      queue: newQueue,
      total: newQueue.length,
      isRevealed: false,
      startTime: Date.now(),
      revealTime: undefined,
    });
  }, [currentCard, cards, persistCards, sessionState]);

  const suspendCard = useCallback(() => {
    if (!currentCard) return;
    
    const updatedCard = {
      ...currentCard,
      status: 'suspended' as const,
      updated_at: new Date().toISOString(),
    };
    const updatedCards = cards.map((c) => c.id === updatedCard.id ? updatedCard : c);
    persistCards(updatedCards);

    // Remove from queue and move to next
    const newQueue = sessionState!.queue.filter((_, i) => i !== sessionState!.currentIndex);
    setSessionState({
      ...sessionState!,
      queue: newQueue,
      total: newQueue.length,
      isRevealed: false,
      startTime: Date.now(),
      revealTime: undefined,
    });
  }, [currentCard, cards, persistCards, sessionState]);

  const removeCard = useCallback(() => {
    if (!currentCard) return;
    
    const updatedCard = {
      ...currentCard,
      status: 'removed' as const,
      updated_at: new Date().toISOString(),
    };
    const updatedCards = cards.map((c) => c.id === updatedCard.id ? updatedCard : c);
    persistCards(updatedCards);

    // Remove from queue and move to next
    const newQueue = sessionState!.queue.filter((_, i) => i !== sessionState!.currentIndex);
    setSessionState({
      ...sessionState!,
      queue: newQueue,
      total: newQueue.length,
      isRevealed: false,
      startTime: Date.now(),
      revealTime: undefined,
    });
  }, [currentCard, cards, persistCards, sessionState]);

  const flagCard = useCallback((reason: string) => {
    if (!currentCard) return;
    
    const updatedCard = {
      ...currentCard,
      flag_reason: reason,
      updated_at: new Date().toISOString(),
    };
    const updatedCards = cards.map((c) => c.id === updatedCard.id ? updatedCard : c);
    persistCards(updatedCards);
  }, [currentCard, cards, persistCards]);

  const addNote = useCallback((note: string) => {
    if (!currentCard) return;
    
    const updatedCard = {
      ...currentCard,
      note,
      updated_at: new Date().toISOString(),
    };
    const updatedCards = cards.map((c) => c.id === updatedCard.id ? updatedCard : c);
    persistCards(updatedCards);
  }, [currentCard, cards, persistCards]);

  // Get interval previews for current card (using FSRS)
  const fsrsConfig = getFSRSConfigFromSettings(settings);
  const intervalPreviews = currentCard 
    ? previewAllIntervalsFSRS(currentCard, fsrsConfig)
    : null;
  
  const intervals = intervalPreviews
    ? {
        again: formatIntervalFSRS(intervalPreviews.again.interval_ms),
        hard: formatIntervalFSRS(intervalPreviews.hard.interval_ms),
        good: formatIntervalFSRS(intervalPreviews.good.interval_ms),
        easy: formatIntervalFSRS(intervalPreviews.easy.interval_ms),
      }
    : null;
  
  const exactDueDates = intervalPreviews
    ? {
        again: new Date(intervalPreviews.again.due_at),
        hard: new Date(intervalPreviews.hard.due_at),
        good: new Date(intervalPreviews.good.due_at),
        easy: new Date(intervalPreviews.easy.due_at),
      }
    : null;

  // Calculate time left in session (estimate 20s per card)
  const estimatedTimeLeft = sessionState
    ? (sessionState.total - sessionState.completed) * 20
    : 0;

  // Check if session is complete
  const isComplete = sessionState
    ? sessionState.currentIndex >= sessionState.queue.length
    : false;

  // End session
  const endSession = useCallback(() => {
    setSessionState(null);
  }, []);

  return {
    sessionState,
    currentCard,
    currentPhrase,
    loading,
    isComplete,
    estimatedTimeLeft,
    intervals,
    exactDueDates,
    speechResult,
    actions: {
      startSession,
      revealCard,
      rateCard,
      buryCard,
      suspendCard,
      removeCard,
      flagCard,
      addNote,
      endSession,
      handleSpeechResult,
    },
  };
}

