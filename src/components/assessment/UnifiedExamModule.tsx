/**
 * Unified Voice-Based Assessment Module
 * Tests all 4 skills (fluency, syntax, conversation, confidence) through 3 voice scenarios
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminMode } from '@/hooks/useAdminMode';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Mic, Volume2, Loader2 } from 'lucide-react';
import type { ExamPhase, ExamSession, RecordingState, UnifiedScore } from './unifiedExam/types';

interface UnifiedExamModuleProps {
  sessionId: string;
  onComplete: () => void;
}

export function UnifiedExamModule({ sessionId, onComplete }: UnifiedExamModuleProps) {
  const { isAdmin, isDev } = useAdminMode();
  
  // Core state
  const [phase, setPhase] = useState<ExamPhase>('intro');
  const [currentScenario, setCurrentScenario] = useState<number>(1);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  
  // Conversation state
  const [conversationHistory, setConversationHistory] = useState<Array<{
    speaker: 'user' | 'bot';
    content: string;
    timestamp: Date;
  }>>([]);
  
  // Progress tracking
  const [progress, setProgress] = useState<number>(0);
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  
  // Results
  const [finalScore, setFinalScore] = useState<UnifiedScore | null>(null);
  
  // Debug mode
  const [showDebug, setShowDebug] = useState<boolean>(false);
  
  // Keyboard shortcut for debug (Cmd+D or Ctrl+D)
  useEffect(() => {
    if (!isAdmin && !isDev) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        setShowDebug(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isAdmin, isDev]);
  
  // Timer
  useEffect(() => {
    if (phase === 'scenario') {
      const timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [phase]);
  
  // Calculate progress
  useEffect(() => {
    const phaseProgress: Record<ExamPhase, number> = {
      intro: 0,
      mic_check: 5,
      scenario: currentScenario === 1 ? 15 : currentScenario === 2 ? 50 : 85,
      transition: currentScenario === 1 ? 33 : 66,
      confidence_quiz: 90,
      processing: 95,
      results: 100,
    };
    setProgress(phaseProgress[phase]);
  }, [phase, currentScenario]);
  
  // ============================================================================
  // Phase Handlers
  // ============================================================================
  
  const handleStartExam = () => {
    setPhase('mic_check');
  };
  
  const handleMicCheckComplete = () => {
    setPhase('scenario');
    setCurrentScenario(1);
    // TODO: Load first scenario and persona
  };
  
  const handleScenarioComplete = () => {
    if (currentScenario < 3) {
      setPhase('transition');
      setTimeout(() => {
        setCurrentScenario(prev => prev + 1);
        setPhase('scenario');
        setConversationHistory([]);
      }, 5000); // 5-second transition
    } else {
      setPhase('confidence_quiz');
    }
  };
  
  const handleConfidenceQuizComplete = () => {
    setPhase('processing');
    // TODO: Run scoring
    setTimeout(() => {
      // Mock score for now
      setFinalScore({
        overall: 72,
        proficiencyLevel: 'B1',
        breakdown: {
          fluency: 68,
          syntax: 75,
          conversation: 78,
          confidence: 67,
        },
      });
      setPhase('results');
    }, 3000);
  };
  
  const handleComplete = () => {
    onComplete();
  };
  
  // ============================================================================
  // Recording Handlers
  // ============================================================================
  
  const handleStartRecording = () => {
    setRecordingState('recording');
    // TODO: Start actual recording
  };
  
  const handleStopRecording = () => {
    setRecordingState('processing');
    // TODO: Stop recording and transcribe
    
    // Mock: Add user turn
    setTimeout(() => {
      const userTurn = {
        speaker: 'user' as const,
        content: 'Bonjour, je voudrais changer ma réservation.',
        timestamp: new Date(),
      };
      setConversationHistory(prev => [...prev, userTurn]);
      
      // Get bot response
      setRecordingState('bot_speaking');
      setTimeout(() => {
        const botTurn = {
          speaker: 'bot' as const,
          content: 'Bien sûr, je peux vous aider. C\'est pour quelle date?',
          timestamp: new Date(),
        };
        setConversationHistory(prev => [...prev, botTurn]);
        setRecordingState('idle');
      }, 2000);
    }, 1500);
  };
  
  // ============================================================================
  // Render Phases
  // ============================================================================
  
  const renderIntro = () => (
    <Card className="max-w-2xl mx-auto mt-12">
      <CardContent className="p-12 text-center space-y-6">
        <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
          <Volume2 className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">Voice Assessment</h1>
        <p className="text-lg text-muted-foreground">
          Test your French proficiency through 3 short conversations.
        </p>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>⏱️ Duration: 5-7 minutes</p>
          <p>🎤 Voice-based (microphone required)</p>
          <p>📊 Tests: Fluency, Grammar, Conversation, Confidence</p>
        </div>
        <Button onClick={handleStartExam} size="lg" className="mt-6">
          Start Assessment
        </Button>
      </CardContent>
    </Card>
  );
  
  const renderMicCheck = () => (
    <Card className="max-w-2xl mx-auto mt-12">
      <CardContent className="p-12 text-center space-y-6">
        <Mic className="w-16 h-16 mx-auto text-primary animate-pulse" />
        <h2 className="text-2xl font-bold">Microphone Check</h2>
        <p className="text-muted-foreground">
          Click the button and say "Bonjour" to test your microphone.
        </p>
        <Button onClick={handleMicCheckComplete} size="lg">
          Start Recording Test
        </Button>
        {/* TODO: Add actual mic test */}
      </CardContent>
    </Card>
  );
  
  const renderScenario = () => (
    <div className="max-w-4xl mx-auto mt-8 space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Scenario {currentScenario} of 3</span>
          <span>{Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      
      {/* Main Conversation Area */}
      <Card>
        <CardContent className="p-8 space-y-6">
          {/* Bot Avatar / Visual Feedback */}
          <div className="flex justify-center">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
              recordingState === 'bot_speaking' ? 'bg-primary/20 scale-110' : 'bg-muted'
            }`}>
              <Volume2 className={`w-16 h-16 ${
                recordingState === 'bot_speaking' ? 'text-primary animate-pulse' : 'text-muted-foreground'
              }`} />
            </div>
          </div>
          
          {/* Recording Control */}
          <div className="flex justify-center">
            {recordingState === 'idle' && (
              <Button
                onClick={handleStartRecording}
                size="lg"
                className="w-48 h-48 rounded-full"
              >
                <Mic className="w-12 h-12" />
              </Button>
            )}
            
            {recordingState === 'recording' && (
              <Button
                onClick={handleStopRecording}
                size="lg"
                variant="destructive"
                className="w-48 h-48 rounded-full animate-pulse"
              >
                <Mic className="w-12 h-12" />
              </Button>
            )}
            
            {(recordingState === 'processing' || recordingState === 'bot_speaking') && (
              <Button
                size="lg"
                disabled
                className="w-48 h-48 rounded-full"
              >
                <Loader2 className="w-12 h-12 animate-spin" />
              </Button>
            )}
          </div>
          
          {/* Status Text */}
          <p className="text-center text-sm text-muted-foreground">
            {recordingState === 'idle' && 'Click to speak'}
            {recordingState === 'recording' && 'Recording... Click to stop'}
            {recordingState === 'processing' && 'Processing...'}
            {recordingState === 'bot_speaking' && 'Bot is speaking...'}
          </p>
          
          {/* Debug Mode: Show Conversation */}
          {(showDebug || isDev) && conversationHistory.length > 0 && (
            <div className="mt-6 p-4 bg-muted rounded-lg space-y-2 max-h-64 overflow-y-auto">
              <p className="text-xs font-bold text-muted-foreground">DEBUG: Conversation</p>
              {conversationHistory.map((turn, idx) => (
                <div key={idx} className={`text-sm ${turn.speaker === 'user' ? 'text-blue-600' : 'text-green-600'}`}>
                  <strong>{turn.speaker}:</strong> {turn.content}
                </div>
              ))}
            </div>
          )}
          
          {/* Temp: Manual scenario completion for testing */}
          {isDev && (
            <Button onClick={handleScenarioComplete} variant="outline" size="sm">
              [DEV] Complete Scenario
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
  
  const renderTransition = () => (
    <Card className="max-w-2xl mx-auto mt-12">
      <CardContent className="p-12 text-center space-y-6">
        <div className="text-6xl">✓</div>
        <h2 className="text-2xl font-bold">Scenario {currentScenario - 1} Complete</h2>
        <p className="text-muted-foreground">
          Next: {currentScenario === 2 ? 'Work Situation' : 'Social Situation'}
        </p>
        <div className="text-4xl font-bold text-primary">
          {/* Countdown would go here */}
          Starting...
        </div>
      </CardContent>
    </Card>
  );
  
  const renderProcessing = () => (
    <Card className="max-w-2xl mx-auto mt-12">
      <CardContent className="p-12 text-center space-y-6">
        <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
        <h2 className="text-2xl font-bold">Analyzing Your Performance</h2>
        <p className="text-muted-foreground">
          Evaluating fluency, grammar, conversation skills, and confidence...
        </p>
        <Progress value={95} className="h-2" />
      </CardContent>
    </Card>
  );
  
  const renderResults = () => (
    <Card className="max-w-2xl mx-auto mt-12">
      <CardContent className="p-12 text-center space-y-6">
        <div className="text-6xl">🎉</div>
        <h2 className="text-3xl font-bold">Your French Level: {finalScore?.proficiencyLevel}</h2>
        <div className="text-5xl font-bold text-primary">{finalScore?.overall}/100</div>
        
        <div className="space-y-4 mt-8">
          <div className="flex items-center justify-between">
            <span className="font-medium">Fluency</span>
            <div className="flex items-center gap-3">
              <Progress value={finalScore?.breakdown.fluency} className="w-48 h-2" />
              <span className="w-16 text-right font-mono">{finalScore?.breakdown.fluency}/100</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Grammar</span>
            <div className="flex items-center gap-3">
              <Progress value={finalScore?.breakdown.syntax} className="w-48 h-2" />
              <span className="w-16 text-right font-mono">{finalScore?.breakdown.syntax}/100</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Conversation</span>
            <div className="flex items-center gap-3">
              <Progress value={finalScore?.breakdown.conversation} className="w-48 h-2" />
              <span className="w-16 text-right font-mono">{finalScore?.breakdown.conversation}/100</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Confidence</span>
            <div className="flex items-center gap-3">
              <Progress value={finalScore?.breakdown.confidence} className="w-48 h-2" />
              <span className="w-16 text-right font-mono">{finalScore?.breakdown.confidence}/100</span>
            </div>
          </div>
        </div>
        
        <div className="mt-8 space-x-4">
          <Button onClick={handleComplete} size="lg">
            View Detailed Report
          </Button>
          <Button onClick={handleComplete} variant="outline" size="lg">
            Retake (14 days)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  // ============================================================================
  // Main Render
  // ============================================================================
  
  return (
    <div className="min-h-screen bg-background p-6">
      {phase === 'intro' && renderIntro()}
      {phase === 'mic_check' && renderMicCheck()}
      {phase === 'scenario' && renderScenario()}
      {phase === 'transition' && renderTransition()}
      {phase === 'processing' && renderProcessing()}
      {phase === 'results' && renderResults()}
      
      {/* Debug indicator */}
      {showDebug && (isAdmin || isDev) && (
        <div className="fixed top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded text-xs font-bold">
          DEBUG MODE (Cmd+D to toggle)
        </div>
      )}
    </div>
  );
}

