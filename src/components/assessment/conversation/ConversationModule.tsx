import { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Check, Mic, RotateCcw, Square, ChevronDown, ChevronUp, Bug } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getPrompts } from '@/components/assessment/promptBank/loadPromptBank';
import type { SpeakingPrompt } from '@/components/assessment/promptBank/types';
import { useAdminMode } from '@/hooks/useAdminMode';

interface ConversationModuleProps {
  sessionId: string;
  onComplete: () => void;
}

const MAX_DURATION_SECONDS = 120;
const MIN_DURATION_SECONDS = 20;

interface StepStatus {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'success' | 'error';
  data?: any;
  error?: string;
  timestamp?: number;
}

export function ConversationModule({ sessionId, onComplete }: ConversationModuleProps) {
  const { user } = useAuth();
  const { showDevTools } = useAdminMode();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([]);

  const updateStep = useCallback((id: string, status: StepStatus['status'], data?: any, error?: string) => {
    setStepStatuses(prev => {
      const existing = prev.find(s => s.id === id);
      if (existing) {
        return prev.map(s => s.id === id ? { ...s, status, data, error, timestamp: Date.now() } : s);
      }
      return [...prev, { id, label: id, status, data, error, timestamp: Date.now() }];
    });
  }, []);

  const prompt = useMemo(() => {
    const prompts = getPrompts('speaking') as SpeakingPrompt[];
    if (prompts.length === 0) {
      return {
        id: 'speaking-fallback',
        type: 'question',
        tags: ['fallback'],
        difficulty: 1,
        payload: {
          question: 'Parlez de quelque chose que vous aimez faire pendant votre temps libre.',
        },
      } as SpeakingPrompt;
    }
    return prompts[Math.floor(Math.random() * prompts.length)];
  }, []);

  const {
    isRecording,
    recordingTime,
    audioBlob,
    error: recordingError,
    startRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder({ maxDuration: MAX_DURATION_SECONDS });

  // Update step statuses when state changes
  useEffect(() => {
    if (showDevTools) {
      updateStep('1-recording-state', isRecording ? 'in-progress' : audioBlob ? 'success' : 'pending', {
        isRecording,
        recordingTime,
        hasAudioBlob: !!audioBlob,
        audioBlobSize: audioBlob ? `${(audioBlob.size / 1024).toFixed(2)} KB` : null,
        audioBlobType: audioBlob?.type || null,
      });
      
      if (audioBlob) {
        updateStep('2-audio-blob-stored', 'success', {
          location: 'Browser Memory (JavaScript Blob object)',
          size: `${(audioBlob.size / 1024).toFixed(2)} KB`,
          type: audioBlob.type,
          note: 'Not saved to storage yet - only in browser memory',
        });
      } else {
        updateStep('2-audio-blob-stored', 'pending');
      }
    }
  }, [isRecording, audioBlob, recordingTime, showDevTools, updateStep]);

  const remainingTime = Math.max(0, MAX_DURATION_SECONDS - recordingTime);
  const progress = (recordingTime / MAX_DURATION_SECONDS) * 100;

  const handleReset = () => {
    resetRecording();
    setErrorMessage(null);
    if (showDevTools) {
      setStepStatuses([]);
    }
  };

  const convertBlobToBase64 = async (blob: Blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const getNextAttemptNumber = async (table: 'fluency_recordings' | 'skill_recordings', moduleType?: string): Promise<number> => {
    if (!user) return 1;

    let data: { attempt_number: number }[] | null = null;

    if (table === 'skill_recordings') {
      const result = await supabase
        .from('skill_recordings')
        .select('attempt_number')
        .eq('session_id', sessionId)
        .eq('item_id', prompt.id)
        .eq('module_type', moduleType ?? 'conversation')
        .order('attempt_number', { ascending: false })
        .limit(1);
      data = result.data;
    } else {
      const result = await supabase
        .from('fluency_recordings')
        .select('attempt_number')
        .eq('session_id', sessionId)
        .eq('item_id', prompt.id)
        .order('attempt_number', { ascending: false })
        .limit(1);
      data = result.data;
    }

    if (data && data.length > 0) {
      return data[0].attempt_number + 1;
    }

    return 1;
  };

  const analyzeSkillWithTranscript = async (moduleType: 'syntax' | 'conversation', transcript: string) => {
    if (!user) return;

    const stepId = `8-${moduleType}-analysis`;
    updateStep(stepId, 'in-progress', { moduleType, transcriptLength: transcript.length });

    const attemptNumber = await getNextAttemptNumber('skill_recordings', moduleType);
    updateStep(`${stepId}-attempt`, 'success', { attemptNumber });

    await supabase
      .from('skill_recordings')
      .update({ superseded: true, used_for_scoring: false })
      .eq('session_id', sessionId)
      .eq('item_id', prompt.id)
      .eq('module_type', moduleType)
      .eq('used_for_scoring', true);

    updateStep(`${stepId}-db-insert`, 'in-progress');
    const { data: recording, error: insertError } = await supabase
      .from('skill_recordings')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        module_type: moduleType,
        item_id: prompt.id,
        attempt_number: attemptNumber,
        duration_seconds: recordingTime,
        status: 'processing',
        transcript,
        word_count: transcript.split(/\s+/).filter(Boolean).length,
        used_for_scoring: true,
        superseded: false,
      })
      .select('id')
      .single();

    if (insertError) {
      updateStep(`${stepId}-db-insert`, 'error', null, insertError.message);
      throw insertError;
    }
    updateStep(`${stepId}-db-insert`, 'success', { recordingId: recording.id, status: 'processing' });

    updateStep(`${stepId}-edge-function`, 'in-progress', {
      functionName: 'analyze-skill',
      payload: { transcript: transcript.substring(0, 100) + '...', moduleType, recordingId: recording.id },
    });

    // Try to get the actual response by making a direct fetch call to see what's really happening
    let directResponseData: any = null;
    let directResponseStatus: number | null = null;
    let directResponseText: string | null = null;
    
    try {
      // First, make a direct fetch to see the actual response
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const directResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-skill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          transcript,
          moduleType,
          itemId: prompt.id,
          promptText: prompt.payload.question,
          recordingId: recording.id,
        }),
      });

      directResponseStatus = directResponse.status;
      directResponseText = await directResponse.text();
      
      updateStep(`${stepId}-direct-fetch`, directResponse.ok ? 'success' : 'error', {
        status: directResponseStatus,
        statusText: directResponse.statusText,
        ok: directResponse.ok,
        responseTextLength: directResponseText.length,
        responseTextPreview: directResponseText.substring(0, 500),
      });

      if (directResponse.ok) {
        try {
          directResponseData = JSON.parse(directResponseText);
          updateStep(`${stepId}-direct-fetch-parse`, 'success', {
            hasData: !!directResponseData,
            dataKeys: directResponseData ? Object.keys(directResponseData) : [],
            hasScore: !!directResponseData?.score,
          });
        } catch (parseError) {
          updateStep(`${stepId}-direct-fetch-parse`, 'error', {
            parseError: parseError instanceof Error ? parseError.message : String(parseError),
            responseText: directResponseText.substring(0, 1000),
          });
        }
      } else {
        try {
          directResponseData = JSON.parse(directResponseText);
        } catch {
          directResponseData = { rawText: directResponseText };
        }
      }
    } catch (fetchError) {
      updateStep(`${stepId}-direct-fetch`, 'error', {
        fetchError: fetchError instanceof Error ? fetchError.message : String(fetchError),
      });
    }

    // Now try the Supabase client invoke
    let errorResponseBody: any = null;
    let data: any = null;  // V0-CORE: Moved outside try-catch to fix scope issue
    try {
      const result = await supabase.functions.invoke('analyze-skill', {
        body: {
          transcript,
          moduleType,
          itemId: prompt.id,
          promptText: prompt.payload.question,
          recordingId: recording.id,
        },
      });
      data = result.data;
      const error = result.error;

      updateStep(`${stepId}-supabase-invoke`, error ? 'error' : 'success', {
        hasData: !!data,
        hasError: !!error,
        errorMessage: error?.message,
        dataKeys: data ? Object.keys(data) : [],
      });

      if (error) {
        // Try to fetch the error response directly to get the full error body
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const directResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-skill`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            },
            body: JSON.stringify({
              transcript,
              moduleType,
              itemId: prompt.id,
              promptText: prompt.payload.question,
              recordingId: recording.id,
            }),
          });

          if (!directResponse.ok) {
            errorResponseBody = await directResponse.json().catch(async () => ({ rawText: await directResponse.text().catch(() => 'Could not read response') }));
          }
        } catch (fetchError) {
          console.error('Failed to fetch error response directly:', fetchError);
        }

        // Try to extract more details from the error
        let errorDetails: any = {
          message: error.message,
          name: error.name,
          status: (error as any).status,
          context: (error as any).context,
          errorResponseBody: errorResponseBody,
          directResponseStatus: directResponseStatus,
          directResponseData: directResponseData,
          directResponseText: directResponseText?.substring(0, 1000),
        };

        // If data exists, it might contain error details from the edge function
        if (data && typeof data === 'object') {
          errorDetails.edgeFunctionError = data;
        }

        // If direct fetch was successful but Supabase client sees error, that's the issue
        if (directResponseStatus === 200 && error) {
          errorDetails.discrepancy = 'Direct fetch returned 200 OK but Supabase client reports error';
          errorDetails.directResponseParsed = directResponseData;
        }

        updateStep(`${stepId}-edge-function`, 'error', {
          errorMessage: error.message || 'Unknown error',
          errorDetails: errorDetails,
          fullErrorObject: JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
          responseData: data,
          directErrorResponse: errorResponseBody,
          directFetchStatus: directResponseStatus,
          directFetchData: directResponseData,
        }, error.message || 'Unknown error');
        
      await supabase
        .from('skill_recordings')
          .update({ 
            status: 'error', 
            error_message: error.message || 'Failed to analyze skill',
            ai_breakdown: { errorDetails: errorDetails }
          })
        .eq('id', recording.id);
        throw error;
      }

      // If direct fetch succeeded but Supabase client also succeeded, compare them
      if (directResponseStatus === 200 && directResponseData) {
        updateStep(`${stepId}-response-comparison`, 'success', {
          directFetchScore: directResponseData.score,
          supabaseClientScore: data?.score,
          scoresMatch: directResponseData.score === data?.score,
        });
      }

      updateStep(`${stepId}-edge-function`, 'success', {
        response: data ? { score: data.score, hasFeedback: !!data.feedback } : null,
        directFetchStatus: directResponseStatus,
        directFetchScore: directResponseData?.score,
      });
    } catch (invokeError) {
      // Catch any errors from the invoke call itself
      updateStep(`${stepId}-edge-function-invoke-error`, 'error', {
        invokeError: invokeError instanceof Error ? invokeError.message : String(invokeError),
        invokeStack: invokeError instanceof Error ? invokeError.stack : 'no-stack',
        errorResponseBody: errorResponseBody,
      });
      throw invokeError;
    }

    updateStep(`${stepId}-edge-function`, 'success', {
      response: data ? { score: data.score, hasFeedback: !!data.feedback } : null,
    });

    // Verify status is completed
    updateStep(`${stepId}-verify-complete`, 'in-progress');
    const { data: updatedRecording } = await supabase
      .from('skill_recordings')
      .select('status')
      .eq('id', recording.id)
      .single();

    if (updatedRecording?.status !== 'completed') {
      updateStep(`${stepId}-verify-complete`, 'error', null, `Status is ${updatedRecording?.status}, expected 'completed'`);
      throw new Error(`Skill analysis did not complete. Status: ${updatedRecording?.status}`);
    }
    updateStep(`${stepId}-verify-complete`, 'success', { status: updatedRecording.status });
    updateStep(stepId, 'success', { score: data?.score, feedback: data?.feedback?.substring(0, 50) });
  };

  const handleSubmit = async () => {
    if (!audioBlob || !user) {
      toast.error('Please record your response first.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    
    if (showDevTools) {
      setStepStatuses([]);
    }

    try {
      updateStep('3-base64-conversion', 'in-progress', { audioBlobSize: `${(audioBlob.size / 1024).toFixed(2)} KB` });
      const base64Audio = await convertBlobToBase64(audioBlob);
      updateStep('3-base64-conversion', 'success', {
        base64Length: base64Audio.length,
        base64Preview: base64Audio.substring(0, 50) + '...',
        note: 'Converted in browser - not saved to storage',
      });

      updateStep('4-fluency-attempt', 'in-progress');
      const fluencyAttempt = await getNextAttemptNumber('fluency_recordings');
      updateStep('4-fluency-attempt', 'success', { attemptNumber: fluencyAttempt });

      updateStep('5-fluency-db-supersede', 'in-progress');
      await supabase
        .from('fluency_recordings')
        .update({ superseded: true, used_for_scoring: false })
        .eq('session_id', sessionId)
        .eq('item_id', prompt.id)
        .eq('used_for_scoring', true);
      updateStep('5-fluency-db-supersede', 'success');

      updateStep('6-fluency-db-insert', 'in-progress', { status: 'processing' });
      const { data: fluencyRecording, error: fluencyInsertError } = await supabase
        .from('fluency_recordings')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          item_id: prompt.id,
          attempt_number: fluencyAttempt,
          status: 'processing',
          duration_seconds: recordingTime,
          used_for_scoring: true,
          superseded: false,
        })
        .select('id')
        .single();

      if (fluencyInsertError) {
        updateStep('6-fluency-db-insert', 'error', null, fluencyInsertError.message);
        throw fluencyInsertError;
      }
      updateStep('6-fluency-db-insert', 'success', { recordingId: fluencyRecording.id, status: 'processing' });

      updateStep('7-fluency-edge-function', 'in-progress', {
        functionName: 'analyze-fluency',
        payloadSize: `${(base64Audio.length / 1024).toFixed(2)} KB`,
      });
      const { data: fluencyResult, error: fluencyError } = await supabase.functions.invoke('analyze-fluency', {
        body: {
            audio: base64Audio,
            itemId: prompt.id,
            recordingDuration: recordingTime,
        },
      });

      if (fluencyError) {
        updateStep('7-fluency-edge-function', 'error', null, fluencyError.message || 'Unknown error');
        await supabase
          .from('fluency_recordings')
          .update({ status: 'error', error_message: fluencyError.message || 'Failed to analyze fluency' })
          .eq('id', fluencyRecording.id);
        throw fluencyError;
      }

      updateStep('7-fluency-edge-function', 'success', {
        transcript: fluencyResult?.transcript?.substring(0, 100) + '...',
        wpm: fluencyResult?.articulationWpm ?? fluencyResult?.wpm,
        wordCount: fluencyResult?.wordCount,
      });

      updateStep('7-fluency-db-update', 'in-progress');
      await supabase
        .from('fluency_recordings')
        .update({
          status: 'completed',
          transcript: fluencyResult.transcript,
          word_count: fluencyResult.wordCount,
          wpm: fluencyResult.articulationWpm ?? fluencyResult.wpm,
          pause_count: fluencyResult.longPauseCount ?? null,
          total_pause_duration: fluencyResult.totalPauseDuration ?? null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', fluencyRecording.id);
      updateStep('7-fluency-db-update', 'success', { status: 'completed' });

      const transcript = fluencyResult.transcript || '';
      updateStep('7-transcript-extracted', 'success', { transcriptLength: transcript.length });

      updateStep('8-skill-analysis-parallel', 'in-progress', { modules: ['syntax', 'conversation'] });
      await Promise.all([
        analyzeSkillWithTranscript('syntax', transcript),
        analyzeSkillWithTranscript('conversation', transcript),
      ]);
      updateStep('8-skill-analysis-parallel', 'success');

      updateStep('9-complete', 'success');
      setHasSubmitted(true);
      toast.success('Recording analyzed successfully.');
      onComplete();
    } catch (error) {
      console.error('Speaking assessment error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Something went wrong.';
      setErrorMessage(errorMsg);
      updateStep('error-caught', 'error', null, errorMsg);
      toast.error('Failed to analyze your recording.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: StepStatus['status']) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'in-progress': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: StepStatus['status']) => {
    switch (status) {
      case 'success': return '✓';
      case 'error': return '✗';
      case 'in-progress': return '⟳';
      default: return '○';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="border-primary/20">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Speaking Assessment</CardTitle>
          <p className="text-sm text-muted-foreground">
            Speak as much as you can. Aim for 20 seconds to 2 minutes.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border bg-muted/30 p-5">
            <p className="text-sm uppercase tracking-wide text-muted-foreground mb-2">Prompt</p>
            <p className="text-lg font-medium text-foreground">{prompt.payload.question}</p>
            {prompt.payload.context && (
              <p className="text-sm text-muted-foreground mt-2">{prompt.payload.context}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Speaking time</span>
              <span>{recordingTime}s / {MAX_DURATION_SECONDS}s</span>
            </div>
            <Progress value={progress} className="h-2" />
            {isRecording && (
              <p className="text-xs text-muted-foreground">
                Keep going! Longer answers help us measure fluency and structure.
              </p>
            )}
          </div>

          {(recordingError || errorMessage) && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>{recordingError || errorMessage}</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            {!isRecording && !audioBlob && (
              <Button size="lg" className="h-16 w-16 rounded-full" onClick={startRecording}>
                <Mic className="h-6 w-6" />
              </Button>
            )}

            {isRecording && (
              <Button
                size="lg"
                variant="destructive"
                className="h-16 w-16 rounded-full animate-pulse"
                onClick={stopRecording}
              >
                <Square className="h-6 w-6" />
              </Button>
            )}

            {!isRecording && audioBlob && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">Recording saved.</p>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Record again
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? 'Analyzing...' : 'Submit recording'}
                  <Check className="h-4 w-4" />
                </Button>
                </div>
              </div>
            )}

            {!isRecording && audioBlob && recordingTime < MIN_DURATION_SECONDS && (
              <p className="text-xs text-muted-foreground">
                We recommend at least {MIN_DURATION_SECONDS} seconds for accurate scoring.
              </p>
            )}

            {!audioBlob && (
              <p className="text-sm text-muted-foreground">
                Press the microphone to start recording.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {hasSubmitted && (
        <Card className="border-primary/30">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Processing complete. Redirecting to results...
          </CardContent>
        </Card>
      )}

      <Card className="border-border/40">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-2">We evaluate:</p>
          <ul className="space-y-1">
            <li>• Fluency (words per minute)</li>
            <li>• Syntax and sentence structure</li>
            <li>• Conversation skills and clarity</li>
          </ul>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground text-center">
        {remainingTime > 0 ? `Time remaining: ${remainingTime}s` : 'Recording limit reached.'}
      </div>

      {showDevTools && (
        <Card className="border-yellow-300 bg-yellow-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-yellow-700" />
                <CardTitle className="text-sm font-mono">Dev Mode: Step-by-Step Status</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDevPanel(!showDevPanel)}
                className="h-6 px-2"
              >
                {showDevPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          {showDevPanel && (
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              <div className="text-xs text-muted-foreground mb-3">
                <p className="font-semibold mb-1">Audio Storage:</p>
                <p>• audioBlob is stored in <strong>browser memory only</strong> (JavaScript Blob object)</p>
                <p>• Not saved to Supabase Storage - no bucket needed</p>
                <p>• Converted to base64 on submit, sent directly to edge function</p>
              </div>
              {stepStatuses.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No steps executed yet. Start recording to see status.</p>
              ) : (
                stepStatuses.map((step) => (
                  <div
                    key={step.id}
                    className={`p-3 rounded border text-xs ${getStatusColor(step.status)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <span className="font-mono font-bold">{getStatusIcon(step.status)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold break-words">{step.id}</div>
                          {step.data && (
                            <div className="mt-1 text-xs opacity-80 font-mono">
                              <pre className="whitespace-pre-wrap break-words">
                                {JSON.stringify(step.data, null, 2)}
                              </pre>
                            </div>
                          )}
                          {step.error && (
                            <div className="mt-1 text-red-700 font-semibold">
                              ERROR: {step.error}
                            </div>
                          )}
                          {step.timestamp && (
                            <div className="mt-1 text-xs opacity-60">
                              {new Date(step.timestamp).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
