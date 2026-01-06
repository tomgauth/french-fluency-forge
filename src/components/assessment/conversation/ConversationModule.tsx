import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Check, Loader2, Mic, RotateCcw, Square } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getPrompts } from '@/components/assessment/promptBank/loadPromptBank';
import type { SpeakingPrompt } from '@/components/assessment/promptBank/types';

interface ConversationModuleProps {
  sessionId: string;
  onComplete: () => void;
}

type ProcessingStep =
  | 'idle'
  | 'uploading'
  | 'analyzing_fluency'
  | 'analyzing_syntax'
  | 'analyzing_conversation'
  | 'complete'
  | 'error';

interface DebugLogEntry {
  timestamp: string;
  step: ProcessingStep;
  message: string;
}

const MAX_DURATION_SECONDS = 120;
const MIN_DURATION_SECONDS = 20;
const AUDIO_BUCKET = 'speech-test-audio';

export function ConversationModule({ sessionId, onComplete }: ConversationModuleProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');

  const isDev = import.meta.env.DEV || window.location.pathname.startsWith('/dev');

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

  const remainingTime = Math.max(0, MAX_DURATION_SECONDS - recordingTime);
  const progress = (recordingTime / MAX_DURATION_SECONDS) * 100;

  const addDebugLog = (step: ProcessingStep, message: string) => {
    if (!isDev) return;
    setDebugLogs((prev) => [
      {
        timestamp: new Date().toISOString(),
        step,
        message,
      },
      ...prev,
    ]);
  };

  const handleReset = () => {
    resetRecording();
    setErrorMessage(null);
    setProcessingStep('idle');
    setAudioPath(null);
    setTranscript('');
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

  const parseErrorMessage = (rawError: string) => {
    try {
      const parsed = JSON.parse(rawError);
      if (parsed?.error) return parsed.error as string;
      return rawError;
    } catch {
      return rawError;
    }
  };

  const uploadAudio = async (blob: Blob) => {
    if (!user) throw new Error('You must be logged in.');
    if (audioPath) return audioPath;

    const path = `speech-test/${sessionId}/${prompt.id}-${Date.now()}.webm`;
    addDebugLog('uploading', `Uploading audio to ${AUDIO_BUCKET}/${path}`);

    const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, blob, {
      contentType: blob.type || 'audio/webm',
      upsert: true,
    });

    if (error) {
      throw new Error(error.message || 'Failed to upload audio.');
    }

    setAudioPath(path);
    return path;
  };

  const getNextAttemptNumber = async (table: 'fluency_recordings' | 'skill_recordings', moduleType?: string) => {
    if (!user) return 1;

    let query = supabase
      .from(table)
      .select('attempt_number')
      .eq('session_id', sessionId)
      .eq('item_id', prompt.id)
      .order('attempt_number', { ascending: false })
      .limit(1);

    if (table === 'skill_recordings' && moduleType) {
      query = query.eq('module_type', moduleType);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      return data[0].attempt_number + 1;
    }

    return 1;
  };

  const analyzeSkillWithTranscript = async (
    moduleType: 'syntax' | 'conversation',
    transcriptText: string,
    storagePath: string
  ) => {
    if (!user) return;

    const attemptNumber = await getNextAttemptNumber('skill_recordings', moduleType);

    await supabase
      .from('skill_recordings')
      .update({ superseded: true, used_for_scoring: false })
      .eq('session_id', sessionId)
      .eq('item_id', prompt.id)
      .eq('module_type', moduleType)
      .eq('used_for_scoring', true);

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
        transcript: transcriptText,
        word_count: transcriptText.split(/\s+/).filter(Boolean).length,
        used_for_scoring: true,
        superseded: false,
        audio_storage_path: storagePath,
      })
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    addDebugLog(moduleType === 'syntax' ? 'analyzing_syntax' : 'analyzing_conversation', 'Calling analyze-skill');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-skill`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          transcript: transcriptText,
          moduleType,
          itemId: prompt.id,
          promptText: prompt.payload.question,
          recordingId: recording.id,
        }),
      }
    );

    if (!response.ok) {
      const errorText = parseErrorMessage(await response.text());
      await supabase
        .from('skill_recordings')
        .update({ status: 'error', error_message: errorText })
        .eq('id', recording.id);

      throw new Error(errorText || 'Failed to analyze skill');
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob || !user) {
      toast.error('Please record your response first.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      setProcessingStep('uploading');
      const storagePath = await uploadAudio(audioBlob);

      const base64Audio = await convertBlobToBase64(audioBlob);
      const fluencyAttempt = await getNextAttemptNumber('fluency_recordings');

      await supabase
        .from('fluency_recordings')
        .update({ superseded: true, used_for_scoring: false })
        .eq('session_id', sessionId)
        .eq('item_id', prompt.id)
        .eq('used_for_scoring', true);

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
          audio_storage_path: storagePath,
        })
        .select('id')
        .single();

      if (fluencyInsertError) {
        throw fluencyInsertError;
      }

      setProcessingStep('analyzing_fluency');
      addDebugLog('analyzing_fluency', 'Calling analyze-fluency');

      const fluencyResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-fluency`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            audio: base64Audio,
            itemId: prompt.id,
            recordingDuration: recordingTime,
          }),
        }
      );

      if (!fluencyResponse.ok) {
        const errorText = parseErrorMessage(await fluencyResponse.text());
        await supabase
          .from('fluency_recordings')
          .update({ status: 'error', error_message: errorText })
          .eq('id', fluencyRecording.id);
        throw new Error(errorText || 'Failed to analyze fluency');
      }

      const fluencyResult = await fluencyResponse.json();

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
          audio_storage_path: storagePath,
        })
        .eq('id', fluencyRecording.id);

      const nextTranscript = (fluencyResult.transcript || '').trim();
      setTranscript(nextTranscript);

      if (!nextTranscript) {
        throw new Error('Transcription failed. Please retry analysis.');
      }

      setProcessingStep('analyzing_syntax');
      await analyzeSkillWithTranscript('syntax', nextTranscript, storagePath);

      setProcessingStep('analyzing_conversation');
      await analyzeSkillWithTranscript('conversation', nextTranscript, storagePath);

      setProcessingStep('complete');
      setHasSubmitted(true);
      toast.success('Recording analyzed successfully.');
      onComplete();
    } catch (error) {
      console.error('Speaking assessment error:', error);
      setProcessingStep('error');
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
      toast.error('Failed to analyze your recording.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const processingLabelMap: Record<ProcessingStep, string> = {
    idle: 'Ready',
    uploading: 'Uploading audio',
    analyzing_fluency: 'Analyzing fluency',
    analyzing_syntax: 'Analyzing syntax',
    analyzing_conversation: 'Analyzing conversation',
    complete: 'Complete',
    error: 'Error',
  };

  const isProcessing = ['uploading', 'analyzing_fluency', 'analyzing_syntax', 'analyzing_conversation'].includes(processingStep);

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
              <Button size="lg" className="h-16 w-16 rounded-full" onClick={startRecording} disabled={isSubmitting || isProcessing}>
                <Mic className="h-6 w-6" />
              </Button>
            )}

            {isRecording && (
              <Button
                size="lg"
                variant="destructive"
                className="h-16 w-16 rounded-full animate-pulse"
                onClick={stopRecording}
                disabled={isSubmitting}
              >
                <Square className="h-6 w-6" />
              </Button>
            )}

            {!isRecording && audioBlob && (
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleReset} className="gap-2" disabled={isSubmitting || isProcessing}>
                  <RotateCcw className="h-4 w-4" />
                  Record again
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || isProcessing} className="gap-2">
                  {isSubmitting ? 'Analyzing...' : 'Submit recording'}
                  <Check className="h-4 w-4" />
                </Button>
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

          {processingStep !== 'idle' && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Check className="h-4 w-4 text-primary" />
                )}
                <span className="font-medium">{processingLabelMap[processingStep]}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {processingStep === 'uploading' && 'Saving your audio securely so you can retry if needed.'}
                {processingStep === 'analyzing_fluency' && 'Calculating words per minute and pauses.'}
                {processingStep === 'analyzing_syntax' && 'Scoring your syntax and structure.'}
                {processingStep === 'analyzing_conversation' && 'Evaluating conversation clarity and flow.'}
                {processingStep === 'complete' && 'Processing complete. Redirecting to results.'}
                {processingStep === 'error' && 'Something went wrong. You can retry analysis without re-recording.'}
              </div>
              {processingStep === 'error' && audioBlob && (
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={handleSubmit} disabled={isSubmitting}>
                    Retry analysis
                  </Button>
                </div>
              )}
            </div>
          )}
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

      {isDev && debugLogs.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Speech Test Debug Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-amber-700 dark:text-amber-300">
            {debugLogs.map((log, index) => (
              <div key={`${log.timestamp}-${index}`}>
                <span className="font-semibold">[{log.step}]</span> {log.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground text-center">
        {remainingTime > 0 ? `Time remaining: ${remainingTime}s` : 'Recording limit reached.'}
      </div>
    </div>
  );
}
