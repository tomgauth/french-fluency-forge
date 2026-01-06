import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface MultiSelectScoringResult {
  score: number;
  correctSelections: string[];
  missedSelections: string[];
  incorrectSelections: string[];
}

function scoreMultiSelect(
  selected: string[],
  correct: string[]
): MultiSelectScoringResult {
  const selectedSet = new Set(selected);
  const correctSet = new Set(correct);
  
  const correctSelections = selected.filter(id => correctSet.has(id));
  const incorrectSelections = selected.filter(id => !correctSet.has(id));
  const missedSelections = correct.filter(id => !selectedSet.has(id));
  
  // Score: (correct - incorrect) / total_correct * 100
  // Minimum score is 0
  const score = correct.length > 0
    ? Math.max(0, ((correctSelections.length - incorrectSelections.length) / correct.length) * 100)
    : 0;
  
  return { 
    score: Math.round(score * 100) / 100, // Round to 2 decimal places
    correctSelections, 
    missedSelections, 
    incorrectSelections 
  };
}

async function generateFeedback(
  scoringResult: MultiSelectScoringResult,
  correctOptionIds: string[],
  itemConfig: {
    options: Array<{ id: string; fr: string; en: string }>;
    correct_option_ids: string[];
  }
): Promise<string> {
  if (!OPENAI_API_KEY) {
    // Fallback feedback if no API key
    const correctCount = scoringResult.correctSelections.length;
    const totalCorrect = correctOptionIds.length;
    if (correctCount === totalCorrect && scoringResult.incorrectSelections.length === 0) {
      return "Excellent ! Vous avez tout compris.";
    } else if (correctCount > 0) {
      return `Bien ! Vous avez compris ${correctCount} sur ${totalCorrect} points importants.`;
    } else {
      return "Essayez d'écouter plus attentivement. Vous pouvez réessayer.";
    }
  }

  const optionsMap = new Map(
    itemConfig.options.map(opt => [opt.id, opt])
  );

  const correctTexts = scoringResult.correctSelections
    .map(id => optionsMap.get(id)?.fr)
    .filter(Boolean)
    .join(", ");
  
  const missedTexts = scoringResult.missedSelections
    .map(id => optionsMap.get(id)?.fr)
    .filter(Boolean)
    .join(", ");
  
  const incorrectTexts = scoringResult.incorrectSelections
    .map(id => optionsMap.get(id)?.fr)
    .filter(Boolean)
    .join(", ");

  const prompt = `Tu es un professeur de français encourageant. Un apprenant vient de faire un exercice de compréhension orale avec sélection multiple.

Résultats:
- Réponses correctes sélectionnées: ${correctTexts || "aucune"}
- Réponses correctes manquées: ${missedTexts || "aucune"}
- Réponses incorrectes sélectionnées: ${incorrectTexts || "aucune"}
- Score: ${scoringResult.score}/100

Génère un feedback en français, encourageant et constructif, en 1-2 phrases maximum. Sois positif même si le score est bas.`;

  try {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
        temperature: 0.7,
      messages: [
          { role: 'system', content: 'Tu es un professeur de français encourageant et bienveillant.' },
          { role: 'user', content: prompt }
        ],
    }),
  });

  if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
  }

  const result = await response.json();
    return result.choices?.[0]?.message?.content?.trim() || "Merci pour votre participation.";
  } catch (error) {
    console.error('Error generating feedback:', error);
    // Fallback feedback
    const correctCount = scoringResult.correctSelections.length;
    const totalCorrect = correctOptionIds.length;
    if (correctCount === totalCorrect && scoringResult.incorrectSelections.length === 0) {
      return "Excellent ! Vous avez tout compris.";
    } else if (correctCount > 0) {
      return `Bien ! Vous avez compris ${correctCount} sur ${totalCorrect} points importants.`;
    } else {
      return "Essayez d'écouter plus attentivement. Vous pouvez réessayer.";
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      selectedOptionIds,
      itemId, 
      recordingId,
      itemConfig 
    } = await req.json();

    if (!selectedOptionIds || !Array.isArray(selectedOptionIds) || !itemId || !recordingId || !itemConfig) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: selectedOptionIds (array), itemId, recordingId, itemConfig' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!itemConfig.correct_option_ids || !Array.isArray(itemConfig.correct_option_ids)) {
      return new Response(
        JSON.stringify({ error: 'itemConfig.correct_option_ids must be an array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing multi-select comprehension ${recordingId} for item ${itemId}`);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to processing
    await supabase
      .from('comprehension_recordings')
      .update({ status: 'processing' })
      .eq('id', recordingId);

    // Score the multi-select answers
    const scoringResult = scoreMultiSelect(selectedOptionIds, itemConfig.correct_option_ids);

    // Generate feedback
    const feedbackFr = await generateFeedback(scoringResult, itemConfig.correct_option_ids, itemConfig);

    // Version tracking
    const versions = {
      prompt_version: '2026-01-05',
      scorer_version: '2026-01-05',
      asr_version: 'none' // No ASR for multi-select
    };

    // Update recording with results
    const { error: updateError } = await supabase
      .from('comprehension_recordings')
      .update({
        selected_option_ids: selectedOptionIds,
        correct_option_ids: itemConfig.correct_option_ids,
        correct_selections: scoringResult.correctSelections,
        missed_selections: scoringResult.missedSelections,
        incorrect_selections: scoringResult.incorrectSelections,
        ai_score: scoringResult.score,
        ai_feedback_fr: feedbackFr,
        ai_confidence: scoringResult.correctSelections.length / itemConfig.correct_option_ids.length,
        prompt_version: versions.prompt_version,
        scorer_version: versions.scorer_version,
        asr_version: versions.asr_version,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', recordingId);

    if (updateError) {
      console.error('Failed to update recording:', updateError);
      throw updateError;
    }

    console.log(`Successfully processed multi-select comprehension ${recordingId}`);

    return new Response(
      JSON.stringify({
        success: true,
        score: scoringResult.score,
        feedbackFr,
        correctSelections: scoringResult.correctSelections,
        missedSelections: scoringResult.missedSelections,
        incorrectSelections: scoringResult.incorrectSelections,
        confidence: scoringResult.correctSelections.length / itemConfig.correct_option_ids.length,
        versions
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-comprehension:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
