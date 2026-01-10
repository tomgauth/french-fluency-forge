import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const CONFIDENCE_PROMPT = `You are a French language evaluator. Your task is to assess how confidently the student communicates in informal spoken French.

You are NOT judging grammar or accuracy. You are evaluating confidence: how much the speaker asserts their views, expresses emotion or vulnerability, and carries the conversation with clarity and energy.

Use the criteria below. Assign a score for each section, compute a total score (out of 100).

# Scoring Criteria

## 1. Length & Development (0–25 points)
- 0 pts: Very short, hesitant, or clipped replies (under 50 words)
- 10 pts: Some development (1–2 short paragraphs, 50–100 words)
- 20 pts: Fully developed (100–200 words)
- 25 pts: Very expressive, >200 words with expansion, examples, and elaboration

## 2. Assertiveness & Ownership (0–25 points)
Look for strong personal positioning. Award points for use of:
- "Moi je pense…"
- "Franchement…"
- "Je vais te dire…"
- "Ce que j'adore…"
- Confident tone, opinions stated directly
- First-person perspective without hedging or apology
- High score if the speaker leads the exchange instead of reacting passively

## 3. Emotional Engagement (0–20 points)
How openly does the speaker express emotion, vulnerability, humor, or personal experience?
- 0–5: Neutral, purely factual, or mechanical
- 10: Some feeling or anecdote
- 20: Vulnerability, humor, personal stories, or expressive emotional tone

## 4. Clarity & Control (0–15 points)
- Clear progression of ideas
- Speaker seems in control, not rambling or self-doubting
- Knows what they want to say and communicates it smoothly

## 5. Linguistic Confidence Signals (0–15 points)
Award 3 points each for confident expressions like:
- "Franchement…"
- "Je vais être honnête…"
- "Le truc, c'est que…"
- "Moi, je pense que…"
- "Ce que j'adore, c'est…"

Do NOT subtract points for grammar mistakes, hesitation words (euh…), or accent.`;

const SYNTAX_PROMPT = `You are evaluating the SYNTAX of a French learner.

Score 0–100 based on:
- Verb tense consistency
- Agreement (gender/number)
- Sentence structure
- Use of connectors

Use the submit_evaluation function to return your evaluation.`;

const CONVERSATION_PROMPT = `You are evaluating CONVERSATION skills in spoken French.

Score 0–100 based on:
- Relevance to the prompt
- Idea development
- Clarity and coherence
- Natural conversational markers

Use the submit_evaluation function to return your evaluation.`;

async function transcribeAudio(audioBase64: string, audioMimeType?: string): Promise<string> {
  console.log('Starting transcription...');
  console.log('Audio MIME type:', audioMimeType || 'not provided, defaulting to audio/webm');
  
  // Convert base64 to blob
  const binaryString = atob(audioBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Detect format from MIME type or default to webm
  const mimeType = audioMimeType || 'audio/webm';
  let extension = 'webm';
  
  if (mimeType.includes('wav')) extension = 'wav';
  else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) extension = 'mp3';
  else if (mimeType.includes('mp4') || mimeType.includes('m4a')) extension = 'm4a';
  else if (mimeType.includes('ogg')) extension = 'ogg';
  else if (mimeType.includes('flac')) extension = 'flac';
  else if (mimeType.includes('webm')) extension = 'webm';
  
  console.log(`Using file extension: ${extension}, MIME type: ${mimeType}`);
  
  const formData = new FormData();
  formData.append('file', new Blob([bytes], { type: mimeType }), `audio.${extension}`);
  formData.append('model', 'whisper-1');
  formData.append('language', 'fr');
  formData.append('response_format', 'json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Whisper API error:', error);
    throw new Error(`Transcription failed: ${error}`);
  }

  const result = await response.json();
  console.log('Transcription complete:', result.text?.substring(0, 100));
  return result.text || '';
}

async function analyzeWithAI(transcript: string, moduleType: string, promptText: string): Promise<{
  score: number;
  feedback: string;
  breakdown: Record<string, number>;
  evidence: string[];
}> {
  console.log(`Analyzing ${moduleType} with AI...`);
  
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set');
    throw new Error('OpenAI API key not configured');
  }
  
  let systemPrompt = '';
  switch (moduleType) {
    case 'confidence':
      systemPrompt = CONFIDENCE_PROMPT;
      break;
    case 'syntax':
      systemPrompt = SYNTAX_PROMPT;
      break;
    case 'conversation':
      systemPrompt = CONVERSATION_PROMPT;
      break;
    default:
      throw new Error(`Unknown module type: ${moduleType}`);
  }

  console.log(`[${moduleType}] Calling OpenAI API with transcript length: ${transcript.length}`);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      top_p: 1,
      presence_penalty: 0,
      frequency_penalty: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `The prompt given to the student was: "${promptText}"

The student's response (transcribed from audio):
"${transcript}"

Analyze this response and provide your evaluation. Include specific evidence quotes from the transcript to support your scores.`
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'submit_evaluation',
            description: 'Submit the evaluation scores and feedback',
            parameters: {
              type: 'object',
              properties: {
                score: {
                  type: 'number',
                  description: 'Score from 0-100'
                },
                feedback: {
                  type: 'string',
                  description: 'Feedback in English explaining what the student did well and what could be improved'
                },
                evidence: {
                  type: 'array',
                  description: 'Evidence quotes from transcript supporting the score',
                  items: {
                    type: 'string'
                  }
                }
              },
              required: ['score', 'feedback', 'evidence']
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'submit_evaluation' } }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[${moduleType}] OpenAI API error (${response.status}):`, errorText);
    throw new Error(`OpenAI API error (${response.status}): ${errorText.substring(0, 500)}`);
  }

  const result = await response.json();
  console.log(`[${moduleType}] OpenAI API response received, choices: ${result.choices?.length || 0}`);
  console.log(`[${moduleType}] AI analysis result preview:`, JSON.stringify(result).substring(0, 500));
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/124f6311-db23-45e5-999d-c67603bf859a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-skill/index.ts:214',message:'AI response received',data:{hasChoices:!!result.choices,choicesLength:result.choices?.length,firstChoice:result.choices?.[0]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/124f6311-db23-45e5-999d-c67603bf859a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-skill/index.ts:218',message:'Tool call extracted',data:{hasToolCall:!!toolCall,toolCallName:toolCall?.function?.name,hasArguments:!!toolCall?.function?.arguments,argumentsPreview:toolCall?.function?.arguments?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  if (!toolCall) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/124f6311-db23-45e5-999d-c67603bf859a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-skill/index.ts:220',message:'No tool call error',data:{fullResult:JSON.stringify(result).substring(0,1000)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    throw new Error('No tool call in AI response');
  }
  
  let args;
  try {
    args = JSON.parse(toolCall.function.arguments);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/124f6311-db23-45e5-999d-c67603bf859a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-skill/index.ts:225',message:'Args parsed successfully',data:{hasScore:!!args.score,scoreValue:args.score,hasTotalScore:!!args.total_score,totalScoreValue:args.total_score,hasFeedback:!!args.feedback,hasEvidence:!!args.evidence,evidenceIsArray:Array.isArray(args.evidence),allKeys:Object.keys(args)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
    // #endregion
  } catch (parseError) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/124f6311-db23-45e5-999d-c67603bf859a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-skill/index.ts:227',message:'JSON parse error',data:{error:parseError instanceof Error ? parseError.message : String(parseError),rawArguments:toolCall.function.arguments?.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    throw new Error(`Failed to parse tool call arguments: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/124f6311-db23-45e5-999d-c67603bf859a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-skill/index.ts:232',message:'Before score calculation',data:{argsScore:args.score,argsTotalScore:args.total_score,willUseScore:!!args.score,willUseTotalScore:!!args.total_score},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
  // #endregion
  
  const finalScore = args.score ?? args.total_score ?? 0;
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/124f6311-db23-45e5-999d-c67603bf859a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-skill/index.ts:236',message:'Returning result',data:{finalScore,hasFeedback:!!args.feedback,evidenceLength:Array.isArray(args.evidence) ? args.evidence.length : 'not-array'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C,D'})}).catch(()=>{});
  // #endregion
  
  return {
    score: Math.min(100, Math.max(0, finalScore)),
    feedback: args.feedback || '',
    breakdown: {},
    evidence: Array.isArray(args.evidence) ? args.evidence : []
  };
}

// Determinism guardrail: run multiple times and use median if needed
async function analyzeWithDeterminismGuard(
  transcript: string,
  moduleType: string,
  promptText: string
): Promise<{
  score: number;
  feedback: string;
  breakdown: Record<string, number>;
  evidence: string[];
  flags: string[];
}> {
  // First attempt
  const result1 = await analyzeWithAI(transcript, moduleType, promptText);
  
  // Check if we need to run additional attempts (based on env flag or always for critical modules)
  const runMultiple = Deno.env.get('ENABLE_DETERMINISM_GUARD') === 'true';
  
  if (!runMultiple) {
    return { ...result1, flags: [], evidence: result1.evidence || [] };
  }
  
  // Run 2 more times
  const result2 = await analyzeWithAI(transcript, moduleType, promptText);
  const result3 = await analyzeWithAI(transcript, moduleType, promptText);
  
  const scores = [result1.score, result2.score, result3.score];
  const spread = Math.max(...scores) - Math.min(...scores);
  
  // If spread > 5, flag as unstable and use median
  if (spread > 5) {
    const sortedScores = [...scores].sort((a, b) => a - b);
    const medianScore = sortedScores[1];
    
    // Find which result has the median score
    const medianResult = [result1, result2, result3].find(r => r.score === medianScore) || result1;
    
    return {
      ...medianResult,
      score: medianScore,
      flags: ['unstable_scoring', `spread=${spread}`],
      evidence: medianResult.evidence || []
    };
  }
  
  return { ...result1, flags: [], evidence: result1.evidence || [] };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/124f6311-db23-45e5-999d-c67603bf859a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-skill/index.ts:280',message:'Function entry',data:{method:req.method,hasBody:!!req.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'ALL'})}).catch(()=>{});
    // #endregion
    
    const { audioBase64, audioMimeType, transcript: directTranscript, moduleType, itemId, promptText, recordingId } = await req.json();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/124f6311-db23-45e5-999d-c67603bf859a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-skill/index.ts:286',message:'Request parsed',data:{moduleType,hasTranscript:!!directTranscript,transcriptLength:directTranscript?.length,hasRecordingId:!!recordingId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'ALL'})}).catch(()=>{});
    // #endregion

    // Either audioBase64 or directTranscript is required
    if ((!audioBase64 && !directTranscript) || !moduleType || !itemId || !promptText || !recordingId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Early validation: check for OpenAI API key before doing any work
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured - failing early');
      // Update recording status to error immediately
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from('skill_recordings')
          .update({ 
            status: 'error', 
            error_message: 'OpenAI API key not configured on server',
            completed_at: new Date().toISOString()
          })
          .eq('id', recordingId);
      }
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${moduleType} recording ${recordingId}${directTranscript ? ' (dev mode - text input)' : ''}`);
    if (audioMimeType) {
      console.log(`Audio MIME type: ${audioMimeType}`);
    }

    // Get auth token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to processing
    await supabase
      .from('skill_recordings')
      .update({ status: 'processing' })
      .eq('id', recordingId);

    // Use direct transcript if provided (dev mode), otherwise transcribe audio
    let transcript: string;
    if (directTranscript) {
      console.log('Using direct text input (dev mode)');
      transcript = directTranscript;
    } else {
      transcript = await transcribeAudio(audioBase64, audioMimeType);
    }
    const wordCount = transcript.split(/\s+/).filter(w => w.length > 0).length;

    // Analyze with AI (with determinism guard)
    console.log(`[${moduleType}] Starting AI analysis for recording ${recordingId}`);
    console.log(`[${moduleType}] Transcript length: ${transcript.length}, Prompt length: ${promptText.length}`);
    
    let analysis;
    try {
      analysis = await analyzeWithDeterminismGuard(transcript, moduleType, promptText);
      console.log(`[${moduleType}] AI analysis complete: score=${analysis.score}, hasFeedback=${!!analysis.feedback}`);
    } catch (analysisError) {
      console.error(`[${moduleType}] AI analysis failed:`, analysisError);
      console.error(`[${moduleType}] Error details:`, {
        message: analysisError instanceof Error ? analysisError.message : String(analysisError),
        stack: analysisError instanceof Error ? analysisError.stack : 'no-stack',
        name: analysisError instanceof Error ? analysisError.name : typeof analysisError,
      });
      throw analysisError;
    }

    // Version tracking
    const versions = {
      prompt_version: '2026-01-04',
      scorer_version: '2026-01-04',
      asr_version: 'whisper-1'
    };

    // Update recording with results
    const { error: updateError } = await supabase
      .from('skill_recordings')
      .update({
        transcript,
        word_count: wordCount,
        ai_score: analysis.score,
        ai_feedback: analysis.feedback,
        ai_breakdown: {
          evidence: analysis.evidence,
          flags: analysis.flags,
          versions
        },
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

    console.log(`Successfully processed ${moduleType} recording ${recordingId}`);

    const responseBody = {
        success: true,
        transcript,
        wordCount,
        score: analysis.score,
        feedback: analysis.feedback,
        breakdown: analysis.breakdown,
        evidence: analysis.evidence,
        flags: analysis.flags,
        versions
    };

    // Validate response body before sending
    try {
      const responseJson = JSON.stringify(responseBody);
      console.log(`[${moduleType}] Response body size: ${responseJson.length} bytes`);
      console.log(`[${moduleType}] Response preview: ${responseJson.substring(0, 200)}...`);
      
      // Verify JSON is valid
      JSON.parse(responseJson);
      
      return new Response(
        responseJson,
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (jsonError) {
      console.error(`[${moduleType}] Failed to serialize response:`, jsonError);
      throw new Error(`Response serialization failed: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
    }

  } catch (error) {
    console.error('Error in analyze-skill:', error);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/124f6311-db23-45e5-999d-c67603bf859a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-skill/index.ts:437',message:'Error caught',data:{errorMessage:error instanceof Error ? error.message : String(error),errorStack:error instanceof Error ? error.stack : 'no-stack',errorType:typeof error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'ALL'})}).catch(()=>{});
    // #endregion
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Update recording status to 'error' in database
    // Extract recordingId from request if possible (need to parse it again from the original request)
    try {
      const reqBody = await req.clone().json().catch(() => ({}));
      if (reqBody.recordingId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase
            .from('skill_recordings')
            .update({ 
              status: 'error', 
              error_message: errorMessage,
              completed_at: new Date().toISOString()
            })
            .eq('id', reqBody.recordingId);
          console.log(`Updated recording ${reqBody.recordingId} status to 'error'`);
        }
      }
    } catch (updateError) {
      console.error('Failed to update recording status to error:', updateError);
    }
    
    // Return more detailed error information
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        stack: errorStack,
        details: error instanceof Error ? {
          name: error.name,
          message: error.message,
        } : { type: typeof error, value: String(error) }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
