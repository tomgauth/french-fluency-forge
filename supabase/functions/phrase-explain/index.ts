import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

interface RequestBody {
  phraseId: string;
  intent?: 'meaning' | 'grammar' | 'usage' | 'formal_vs_casual' | 'transitions' | 'why_not';
  whyNotText?: string;
  forceRegenerate?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token (allow anon key via apikey header)
    const authHeader = req.headers.get('Authorization');
    const apiKey = req.headers.get('apikey');
    
    // Accept either Authorization header or apikey header
    if (!authHeader && !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });

    // Parse request body
    const body: RequestBody = await req.json();
    const { phraseId, intent, whyNotText, forceRegenerate = false } = body;

    if (!phraseId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing phraseId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache first (unless forceRegenerate)
    if (!forceRegenerate) {
      const { data: cached, error: cacheError } = await supabase
        .from('phrase_explanations')
        .select('explanation_json, model, version, generated_at')
        .eq('phrase_id', phraseId)
        .single();

      if (!cacheError && cached) {
        return new Response(
          JSON.stringify({
            success: true,
            explanation: cached.explanation_json,
            cached: true,
            model: cached.model,
            version: cached.version,
            generated_at: cached.generated_at,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get phrase data
    const { data: phrase, error: phraseError } = await supabase
      .from('phrases')
      .select('*')
      .eq('id', phraseId)
      .single();

    if (phraseError || !phrase) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phrase not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate explanation with OpenAI
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const frenchText = phrase.canonical_fr || phrase.transcript_fr || '';
    const englishPrompt = phrase.prompt_en || '';
    const translation = phrase.translation_en || '';

    // Build prompt based on intent
    const systemPrompt = `You are a helpful French language coach. Be concise and practical.

IMPORTANT: Always respond with ONLY valid JSON using EXACTLY these lowercase keys:
{
  "meaning": { "one_liner": "...", "literal": "...", "example": "..." },
  "grammar": { "bullets": ["..."], "common_mistakes": ["..."] },
  "usage": { "when_to_use": ["..."], "when_not_to_use": ["..."], "register": "casual" or "neutral" or "formal" },
  "transitions": { "before": ["..."], "after": ["..."] }
}

Use lowercase keys ONLY: meaning, grammar, usage, transitions, one_liner, literal, example, bullets, common_mistakes, when_to_use, when_not_to_use, register, before, after.`;

    let userPrompt = '';
    
    if (intent === 'why_not' && whyNotText) {
      userPrompt = `Phrase: "${frenchText}" (${translation || englishPrompt})
      
User asked: "Why not ${whyNotText}?"

Explain why the user's alternative doesn't work. Return JSON:
{"why_not": [{"user_alt": "...", "answer": "...", "rule_of_thumb": "..."}]}`;
    } else {
      userPrompt = `Phrase: "${frenchText}" (${translation || englishPrompt})

Generate explanation using the exact lowercase JSON schema.
${intent ? `Focus on: ${intent}` : ''}`;
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[phrase-explain] OpenAI error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate explanation', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const explanationText = openaiData.choices[0]?.message?.content;
    
    if (!explanationText) {
      return new Response(
        JSON.stringify({ success: false, error: 'No explanation generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let explanation: PhraseExplanation;
    try {
      explanation = JSON.parse(explanationText);
    } catch (parseError) {
      console.error('[phrase-explain] JSON parse error:', parseError);
      // Fallback: try to extract JSON from markdown code blocks
      const jsonMatch = explanationText.match(/```json\s*([\s\S]*?)\s*```/) || explanationText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        explanation = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Could not parse explanation JSON');
      }
    }

    // Store in cache
    const { error: insertError } = await supabase
      .from('phrase_explanations')
      .upsert({
        phrase_id: phraseId,
        explanation_json: explanation,
        model: 'gpt-4o-mini',
        version: 1,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'phrase_id',
      });

    if (insertError) {
      console.error('[phrase-explain] Cache insert error:', insertError);
      // Continue anyway - return explanation even if cache fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        explanation,
        cached: false,
        model: 'gpt-4o-mini',
        version: 1,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('[phrase-explain] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

