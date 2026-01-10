/**
 * Hook for fetching phrase explanations
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PhraseExplanation {
  meaning: {
    one_liner: string;
    literal: string;
    example: string;
  };
  grammar: {
    bullets: string[];
    common_mistakes: string[];
  };
  usage: {
    when_to_use: string[];
    when_not_to_use: string[];
    register: 'casual' | 'neutral' | 'formal';
  };
  transitions: {
    before: string[];
    after: string[];
  };
  why_not?: Array<{
    user_alt: string;
    answer: string;
    rule_of_thumb: string;
  }>;
}

export function usePhraseExplanation(phraseId: string) {
  const [explanation, setExplanation] = useState<PhraseExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = useCallback(async (
    intent?: 'meaning' | 'grammar' | 'usage' | 'formal_vs_casual' | 'transitions' | 'why_not',
    whyNotText?: string
  ) => {
    if (!phraseId) return;

    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      // Get session token
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/phrase-explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken || anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          phraseId,
          intent,
          whyNotText,
          forceRegenerate: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch explanation');
      }

      const data = await response.json();
      if (data.success && data.explanation) {
        setExplanation(data.explanation);
      } else {
        throw new Error(data.error || 'Failed to fetch explanation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('[usePhraseExplanation] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [phraseId]);

  return {
    explanation,
    loading,
    error,
    fetchExplanation,
  };
}

