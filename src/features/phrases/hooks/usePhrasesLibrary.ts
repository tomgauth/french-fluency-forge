/**
 * Phrases Library Hook
 * Manages phrase library with filtering and actions
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { MemberPhraseCard, Phrase, LibraryFilters, PhraseStats } from '../types';
import { getPhraseById } from '../data/mockPhrasesData';
import { fetchMemberCardsWithPhrases, upsertMemberCards } from '../services/phrasesApi';
import { runMigrationIfNeeded } from '../utils/migrateLocalStorage';

export function usePhrasesLibrary(memberId?: string) {
  const { user } = useAuth();
  const effectiveMemberId = memberId || user?.id || 'guest';
  
  const [cards, setCards] = useState<MemberPhraseCard[]>([]);
  const [phraseMap, setPhraseMap] = useState<Record<string, Phrase>>({});
  const [filters, setFilters] = useState<LibraryFilters>({
    search: '',
    mode: 'all',
    status: 'all',
    tags: [],
    dueFilter: 'all',
  });
  const [loading, setLoading] = useState(true);

  // Load cards from Supabase (or localStorage for guests)
  useEffect(() => {
    let isActive = true;
    const load = async () => {
      setLoading(true);
      try {
        if (user?.id) {
          await runMigrationIfNeeded(user.id);
          console.log('[usePhrasesLibrary] Fetching cards from Supabase for user:', user.id);
          const { cards: dbCards, phraseMap: dbPhrases } = await fetchMemberCardsWithPhrases(user.id);
          console.log('[usePhrasesLibrary] Supabase returned', dbCards.length, 'cards');
          if (!isActive) return;
          
          // If Supabase returned cards, use them
          if (dbCards.length > 0) {
            console.log('[usePhrasesLibrary] Using Supabase cards');
            setCards(dbCards);
            setPhraseMap(dbPhrases);
            localStorage.setItem(`solv_phrases_cards_${user.id}`, JSON.stringify(dbCards));
          } else {
            // Supabase returned empty, check localStorage for cached cards
            const key = `solv_phrases_cards_${user.id}`;
            console.log('[usePhrasesLibrary] Supabase empty, checking localStorage key:', key);
            const stored = localStorage.getItem(key);
            console.log('[usePhrasesLibrary] localStorage value exists:', !!stored);
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                console.log('[usePhrasesLibrary] Parsed localStorage, found', parsed.length, 'cards');
                if (Array.isArray(parsed) && parsed.length > 0) {
                  console.log('[usePhrasesLibrary] Using localStorage cards (Supabase empty)');
                  setCards(parsed);
                  // Build phrase map from localStorage phrases AND mock data
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
                      console.error('[usePhrasesLibrary] Failed to parse localStorage phrases:', err);
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
                console.error('[usePhrasesLibrary] Failed to parse localStorage:', err);
                setCards([]);
              }
            }
          }
        } else {
          const key = `solv_phrases_cards_${effectiveMemberId}`;
          const stored = localStorage.getItem(key);
          
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              setCards(parsed);
              // Build phrase map from localStorage phrases AND mock data
              const localPhraseMap: Record<string, Phrase> = {};
              
              // First, load any TSV-imported phrases from localStorage
              const phrasesKey = `solv_phrases_${effectiveMemberId}`;
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
                  console.error('[usePhrasesLibrary] Failed to parse localStorage phrases:', err);
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
            } catch (err) {
              console.error('Failed to load phrase cards:', err);
              setCards([]);
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
    return () => { isActive = false; };
  }, [effectiveMemberId, user?.id]);

  // Save cards (Supabase for authed, local cache for guests)
  const saveCards = (updatedCards: MemberPhraseCard[]) => {
    setCards(updatedCards);
    const key = `solv_phrases_cards_${effectiveMemberId}`;
    localStorage.setItem(key, JSON.stringify(updatedCards));

    if (user?.id) {
      void upsertMemberCards(updatedCards);
    }
  };

  // Filter cards based on current filters
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const phrase = phraseMap[card.phrase_id] || getPhraseById(card.phrase_id);
      if (!phrase) return false;

      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const searchable = [
          phrase.prompt_en,
          phrase.canonical_fr,
          phrase.transcript_fr,
          phrase.translation_en,
          ...(phrase.answers_fr || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        
        if (!searchable.includes(search)) return false;
      }

      // Mode filter
      if (filters.mode !== 'all' && phrase.mode !== filters.mode) return false;

      // Status filter
      if (filters.status !== 'all' && card.status !== filters.status) return false;

      // Tags filter
      if (filters.tags.length > 0) {
        const hasTag = filters.tags.some((tag) => phrase.tags.includes(tag));
        if (!hasTag) return false;
      }

      // Due filter
      if (filters.dueFilter !== 'all') {
        const now = new Date();
        const dueDate = new Date(card.scheduler.due_at);
        
        if (filters.dueFilter === 'overdue' && dueDate >= now) return false;
        if (filters.dueFilter === 'today') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (dueDate < today || dueDate >= tomorrow) return false;
        }
        if (filters.dueFilter === 'future' && dueDate <= now) return false;
      }

      return true;
    });
  }, [cards, filters, phraseMap]);

  // Calculate stats
  const stats: PhraseStats = useMemo(() => {
    const now = new Date();
    return {
      total: cards.length,
      due: cards.filter((c) => c.status === 'active' && new Date(c.scheduler.due_at) <= now).length,
      new: cards.filter((c) => c.scheduler.state === 'new').length,
      learning: cards.filter((c) => c.scheduler.state === 'learning').length,
      review: cards.filter((c) => c.scheduler.state === 'review').length,
      suspended: cards.filter((c) => c.status === 'suspended').length,
      buried: cards.filter((c) => c.status === 'buried').length,
      known_recall: cards.filter((c) => {
        const phrase = phraseMap[c.phrase_id] || getPhraseById(c.phrase_id);
        return phrase?.mode === 'recall' && c.scheduler.state === 'review' && (c.scheduler.interval_days || 0) >= 21;
      }).length,
      known_recognition: cards.filter((c) => {
        const phrase = phraseMap[c.phrase_id] || getPhraseById(c.phrase_id);
        return phrase?.mode === 'recognition' && c.scheduler.state === 'review' && (c.scheduler.interval_days || 0) >= 21;
      }).length,
    };
  }, [cards, phraseMap]);

  // Actions
  const buryCard = (cardId: string) => {
    const updated = cards.map((card) =>
      card.id === cardId
        ? { ...card, status: 'buried' as const, updated_at: new Date().toISOString() }
        : card
    );
    saveCards(updated);
  };

  const suspendCard = (cardId: string) => {
    const updated = cards.map((card) =>
      card.id === cardId
        ? { ...card, status: 'suspended' as const, updated_at: new Date().toISOString() }
        : card
    );
    saveCards(updated);
  };

  const removeCard = (cardId: string) => {
    const updated = cards.map((card) =>
      card.id === cardId
        ? { ...card, status: 'removed' as const, updated_at: new Date().toISOString() }
        : card
    );
    saveCards(updated);
  };

  const reactivateCard = (cardId: string) => {
    const updated = cards.map((card) =>
      card.id === cardId
        ? { ...card, status: 'active' as const, updated_at: new Date().toISOString() }
        : card
    );
    saveCards(updated);
  };

  const updateCardNote = (cardId: string, note: string) => {
    const updated = cards.map((card) =>
      card.id === cardId
        ? { ...card, note, updated_at: new Date().toISOString() }
        : card
    );
    saveCards(updated);
  };

  const flagCard = (cardId: string, reason: string) => {
    const updated = cards.map((card) =>
      card.id === cardId
        ? { ...card, flag_reason: reason, updated_at: new Date().toISOString() }
        : card
    );
    saveCards(updated);
  };

  // Get enriched cards with phrase data
  const enrichedCards = useMemo(() => {
    return filteredCards.map((card) => ({
      card,
      phrase: phraseMap[card.phrase_id] || getPhraseById(card.phrase_id),
    })).filter((item): item is { card: MemberPhraseCard; phrase: Phrase } => 
      item.phrase !== undefined
    );
  }, [filteredCards, phraseMap]);

  return {
    cards: enrichedCards,
    filters,
    setFilters,
    stats,
    loading,
    actions: {
      bury: buryCard,
      suspend: suspendCard,
      remove: removeCard,
      reactivate: reactivateCard,
      updateNote: updateCardNote,
      flag: flagCard,
    },
  };
}

