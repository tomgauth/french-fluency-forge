/**
 * Pronunciation Module with Phrase Bank
 * Uses coverage-constrained sampling to test all 39 French phonemes
 * 
 * STATE MACHINE:
 * - idle: Ready to record
 * - recording: User is recording
 * - processing: Audio being analyzed (3 steps: uploading, analyzing, finishing)
 * - feedback: Showing result
 * - error: Error occurred
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAudioRecorder, formatTime } from "@/hooks/useAudioRecorder";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mic, Square, RotateCcw, Loader2, AlertCircle, ChevronRight, Check } from "lucide-react";
import { useAdminMode } from "@/hooks/useAdminMode";
import SkipButton from "../SkipButton";
import { StatusIndicator, StatusBadge, type ProcessingStatus } from "./StatusIndicator";
import { PronunciationDebugPanel } from "./PronunciationDebugPanel";
import { EnhancedFeedbackDisplay } from "./EnhancedFeedbackDisplay";
import { IPADisplay } from "./IPADisplay";
import { CoverageProgress } from "./CoverageProgress";
import { ConfettiCelebration } from "./ConfettiCelebration";
import { selectPhrasesWithCoverage, type PronunciationPhrase } from "@/lib/pronunciation/coverageSampler";
import { parseIPA, getTargetPhonemes } from "@/lib/pronunciation/ipaParser";
import { updatePhonemeStats, extractPhonemeScores } from "@/lib/pronunciation/phonemeStats";
import { generateSeed } from "@/lib/random/seededShuffle";
import pronunciationPhrasesBank from "../promptBank/promptBanks/pronunciation-phrases.json";

// Clear state machine phases
type ModulePhase = 'idle' | 'recording' | 'processing' | 'feedback' | 'error';

interface PronunciationModuleWithPhrasesProps {
  sessionId: string;
  onComplete: (results: any[]) => void;
  onSkip?: () => void;
}

const PronunciationModuleWithPhrases = ({
  sessionId,
  onComplete,
  onSkip
}: PronunciationModuleWithPhrasesProps) => {
  const { user } = useAuth();
  const { isAdmin, isDev } = useAdminMode();

  // Dev mode toggle state
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const showDevFeatures = devModeEnabled && (isAdmin || isDev);

  // Phrase state
  const [phrases, setPhrases] = useState<PronunciationPhrase[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [testedPhonemes, setTestedPhonemes] = useState<Set<string>>(new Set());
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});

  // Clear state machine - ONE source of truth for UI
  const [phase, setPhase] = useState<ModulePhase>('idle');
  const [processingStep, setProcessingStep] = useState<1 | 2 | 3>(1);
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState<'speechsuper' | 'azure' | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const {
    isRecording,
    recordingTime,
    audioBlob,
    wavBlob,
    isConverting,
    error: recordingError,
    startRecording,
    stopRecording,
    resetRecording,
    getWavBlob
  } = useAudioRecorder({
    maxDuration: 30,
    convertToWavOnStop: true
  });

  // Initialize phrases with coverage sampling (prefer long phrases, fall back if coverage misses)
  useEffect(() => {
    const seed = generateSeed();
    console.log('[Pronunciation] Selecting phrases with coverage, seed:', seed);
    const phrasesData = pronunciationPhrasesBank.phrases as any[];
    let result = selectPhrasesWithCoverage(phrasesData, seed, {
      '5-10w': 4,
      'sent': 8
    });
    if (result.coveragePercent < 100) {
      console.warn('[Pronunciation] Long-only selection missed phonemes, expanding quotas.');
      result = selectPhrasesWithCoverage(phrasesData, seed, {
        '5-10w': 4,
        'sent': 6,
        '4-5w': 2,
        '3-4w': 2,
        '2w': 1
      });
    }
    console.log('[Pronunciation] Selected', result.phrases.length, 'phrases');
    console.log('[Pronunciation] Coverage:', result.coveragePercent + '%');
    setPhrases(result.phrases);
  }, []);

  const currentPhrase = phrases[currentIndex];
  const currentAttemptCount = currentPhrase ? attemptCounts[currentPhrase.id] || 0 : 0;
  const maxAttemptsReached = currentAttemptCount >= 2;
  const progress = phrases.length > 0 ? (currentIndex + 1) / phrases.length * 100 : 0;

  // Sync recorder state with phase
  useEffect(() => {
    if (isRecording && phase !== 'recording') {
      setPhase('recording');
    }
  }, [isRecording, phase]);

  // Auto-submit when WAV is ready (user mode only)
  useEffect(() => {
    if (!showDevFeatures && wavBlob && phase === 'recording' && !isRecording) {
      console.log('[Pronunciation] WAV ready, auto-submitting...');
      handleRecordingSubmit();
    }
  }, [wavBlob, showDevFeatures, phase, isRecording]);

  // Map processing step to status for StatusIndicator
  const getProcessingStatus = (): ProcessingStatus => {
    if (phase === 'recording') return 'recording';
    if (phase === 'processing') {
      if (processingStep === 1) return 'uploading';
      if (processingStep === 2) return 'processing';
      return 'analyzed';
    }
    if (phase === 'feedback') return 'complete';
    if (phase === 'error') return 'error';
    return 'idle';
  };

  const handleStartRecording = () => {
    setPhase('idle'); // Reset first
    setCurrentResult(null);
    setErrorMessage(null);
    startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
    // Phase will update via useEffect when wavBlob is ready
  };

  const handleRecordingSubmit = async () => {
    if (!audioBlob || !currentPhrase) return;
    
    setPhase('processing');
    setProcessingStep(1); // Uploading
    setErrorMessage(null);

    try {
      // Get WAV audio
      let audioToSend = wavBlob;
      let audioFormatToSend = 'audio/wav';
      
      if (!audioToSend) {
        console.log('[Pronunciation] Converting to WAV...');
        audioToSend = await getWavBlob();
      }
      
      if (!audioToSend) {
        console.warn('[Pronunciation] WAV conversion failed, using WebM');
        audioToSend = audioBlob;
        audioFormatToSend = audioBlob.type || 'audio/webm';
      }

      // Convert to base64
      const arrayBuffer = await audioToSend.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Audio = btoa(binary);
      
      setProcessingStep(2); // Analyzing

      // Call pronunciation API
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-pronunciation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          audio: base64Audio,
          referenceText: currentPhrase.text_fr,
          itemId: currentPhrase.id,
          audioFormat: audioFormatToSend
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Assessment failed');
      }
      
      setProcessingStep(3); // Finishing
      
      const result = await response.json();
      console.log('[Pronunciation] Result:', result);
      setCurrentProvider(result.provider || 'azure');

      // Update tested phonemes
      const phrasePhonemes = currentPhrase.phonemes || parseIPA(currentPhrase.ipa);
      setTestedPhonemes(prev => {
        const next = new Set(prev);
        phrasePhonemes.forEach(p => next.add(p));
        return next;
      });

      // Increment attempt count
      const attemptNumber = currentAttemptCount + 1;
      setAttemptCounts(prev => ({
        ...prev,
        [currentPhrase.id]: attemptNumber
      }));

      // Build result object
      const itemResult = {
        ...result,
        phraseId: currentPhrase.id,
        phraseIpa: currentPhrase.ipa,
        attemptNumber,
        scores: result.scores || {
          overall: result.pronScore || 0,
          accuracy: result.accuracyScore || 0,
          fluency: result.fluencyScore || 0,
          completeness: result.completenessScore || 0
        },
        words: result.words || [],
        allPhonemes: result.allPhonemes || []
      };

      // OVERWRITE previous result for same phrase (for "Try Again")
      setResults(prev => {
        const filtered = prev.filter(r => r.phraseId !== currentPhrase.id);
        return [...filtered, itemResult];
      });
      
      setCurrentResult(itemResult);
      setPhase('feedback');
      
      // Trigger confetti for high scores (95%+)
      const overallScore = itemResult.scores?.overall || 0;
      if (!showDevFeatures && overallScore >= 95) {
        setShowConfetti(true);
      }
    } catch (error) {
      console.error("Pronunciation error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Assessment failed");
      setPhase('error');
      toast.error(error instanceof Error ? error.message : "Assessment failed");
    }
  };

  const advanceToNext = async () => {
    resetRecording();
    setCurrentResult(null);
    setPhase('idle');
    setProcessingStep(1);
    setCurrentProvider(null);
    
    if (currentIndex < phrases.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Test complete - update phoneme stats
      if (user) {
        console.log('[Pronunciation] Test complete, updating phoneme stats...');
        const allPhonemeScores = results.flatMap(r => extractPhonemeScores(r));
        if (allPhonemeScores.length > 0) {
          await updatePhonemeStats(user.id, allPhonemeScores);
          toast.success('Phoneme stats updated!');
        }
      }
      onComplete(results);
    }
  };

  const handleTryAgain = () => {
    resetRecording();
    setCurrentResult(null);
    setPhase('idle');
    setProcessingStep(1);
  };

  // Loading state
  if (phrases.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      {/* Confetti celebration for high scores */}
      <ConfettiCelebration show={showConfetti} onComplete={() => setShowConfetti(false)} />
      
      <div className="max-w-3xl mx-auto space-y-6 py-[30px]">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Pronunciation Test</h1>
              {/* Dev Mode Toggle - only visible to admins */}
              {(isAdmin || isDev) && (
                <div className="flex items-center gap-2 border rounded-lg px-2 py-1 bg-muted/50">
                  <Switch
                    id="dev-mode"
                    checked={devModeEnabled}
                    onCheckedChange={setDevModeEnabled}
                    className="scale-75"
                  />
                  <Label htmlFor="dev-mode" className="text-xs font-medium cursor-pointer">
                    Dev
                  </Label>
                </div>
              )}
            </div>
            {phase !== 'idle' && phase !== 'feedback' && (
              <StatusBadge status={getProcessingStatus()} provider={currentProvider} devMode={showDevFeatures} />
            )}
          </div>
          <Progress value={progress} className="h-2 mb-2" />
          <p className="text-sm text-muted-foreground">
            Phrase {currentIndex + 1} of {phrases.length}
          </p>
        </div>

        {/* Coverage Progress - only in dev mode */}
        {showDevFeatures && (
          <CoverageProgress 
            testedPhonemes={testedPhonemes} 
            currentPhrase={currentIndex + 1} 
            totalPhrases={phrases.length} 
          />
        )}

        {/* Status Flow - ONLY show during processing phase */}
        {phase === 'processing' && (
          <StatusIndicator 
            status={getProcessingStatus()} 
            provider={currentProvider} 
            devMode={showDevFeatures} 
          />
        )}

        {/* Recording Error */}
        {(recordingError || phase === 'error') && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <div className="font-semibold text-destructive mb-1">Error</div>
              <p className="text-sm text-destructive">{recordingError || errorMessage}</p>
            </div>
          </div>
        )}

        {/* Current Phrase + Recording Controls - Show when NOT in feedback phase */}
        {phase !== 'feedback' && currentPhrase && (
          <>
            <IPADisplay 
              textFr={currentPhrase.text_fr} 
              ipa={currentPhrase.ipa} 
              targetPhonemes={getTargetPhonemes(currentPhrase.ipa)} 
              showTargets={showDevFeatures}
              showIPA={showDevFeatures}
            />

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {showDevFeatures ? 'Record this phrase' : 'Say this phrase'}
                  </CardTitle>
                  {currentAttemptCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Attempt {currentAttemptCount}/2
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <RecordingControls 
                  phase={phase}
                  isRecording={isRecording}
                  isConverting={isConverting}
                  audioBlob={audioBlob}
                  wavBlob={wavBlob}
                  recordingTime={recordingTime}
                  onStart={handleStartRecording}
                  onStop={handleStopRecording}
                  onReset={() => {
                    resetRecording();
                    setPhase('idle');
                  }}
                  onSubmit={handleRecordingSubmit}
                  devMode={showDevFeatures}
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* Feedback Display - ONLY show in feedback phase */}
        {phase === 'feedback' && currentResult && (
          <div className="space-y-6">
            <EnhancedFeedbackDisplay 
              result={currentResult} 
              onContinue={advanceToNext} 
              onTryAgain={maxAttemptsReached ? null : handleTryAgain} 
              attemptNumber={currentAttemptCount}
              showScores={showDevFeatures}
            />
            {showDevFeatures && <PronunciationDebugPanel result={currentResult} isOpen={false} />}
          </div>
        )}

        {onSkip && <SkipButton onClick={onSkip} />}
      </div>
    </div>
  );
};

// Recording Controls Component - simplified
interface RecordingControlsProps {
  phase: ModulePhase;
  isRecording: boolean;
  isConverting: boolean;
  audioBlob: Blob | null;
  wavBlob: Blob | null;
  recordingTime: number;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onSubmit: () => void;
  devMode?: boolean;
}

function RecordingControls({
  phase,
  isRecording,
  isConverting,
  audioBlob,
  wavBlob,
  recordingTime,
  onStart,
  onStop,
  onReset,
  onSubmit,
  devMode = false
}: RecordingControlsProps) {
  const isProcessing = phase === 'processing';
  const showMicButton = phase === 'idle' && !isRecording && !audioBlob;
  const showStopButton = isRecording;
  const showDevControls = devMode && audioBlob && !isRecording && phase !== 'processing';

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="text-3xl font-mono tabular-nums">
        {formatTime(recordingTime)}
      </div>

      {/* Dev mode messages */}
      {devMode && isConverting && (
        <div className="text-sm text-primary flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Converting to WAV for Azure...
        </div>
      )}
      
      {devMode && wavBlob && !isConverting && !isRecording && (
        <div className="text-xs text-green-600 flex items-center gap-1">
          <Check className="h-3 w-3" />
          Optimized for pronunciation assessment (WAV)
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Mic button - only when idle and no recording */}
        {showMicButton && (
          <Button 
            size="lg" 
            onClick={onStart} 
            className="h-16 w-16 rounded-full" 
            disabled={isProcessing || isConverting}
          >
            <Mic className="h-6 w-6" />
          </Button>
        )}

        {/* Stop button - only when recording */}
        {showStopButton && (
          <Button 
            size="lg" 
            variant="destructive" 
            onClick={onStop} 
            className="h-16 w-16 rounded-full animate-pulse"
          >
            <Square className="h-6 w-6" />
          </Button>
        )}

        {/* Dev mode controls */}
        {showDevControls && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onReset} disabled={isProcessing || isConverting}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Redo
            </Button>
            <Button onClick={onSubmit} disabled={isProcessing || isConverting} size="lg">
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Analyze
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Processing indicator for user mode */}
      {!devMode && isProcessing && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Analyzing your pronunciation...</span>
        </div>
      )}
    </div>
  );
}

export default PronunciationModuleWithPhrases;
