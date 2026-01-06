/**
 * Unified Exam Types
 * Voice-first assessment testing all 4 skills through 3 scenarios
 */

import type { PersonaPreset } from '../conversation/types';

// ============================================================================
// Exam Session Types
// ============================================================================

export type ExamPhase = 
  | 'intro'           // Welcome screen
  | 'mic_check'       // Test microphone
  | 'scenario'        // Active scenario conversation
  | 'transition'      // Between scenarios
  | 'confidence_quiz' // Post-exam confidence questions
  | 'processing'      // Scoring in progress
  | 'results';        // Final results

export type RecordingState = 
  | 'idle'            // Ready to record
  | 'recording'       // User speaking
  | 'processing'      // Transcribing
  | 'bot_speaking'    // Bot responding
  | 'error';          // Error state

export interface ExamSession {
  sessionId: string;
  userId: string;
  currentPhase: ExamPhase;
  currentScenario: number; // 1, 2, or 3
  startedAt: Date;
  scenarios: ScenarioExecution[];
}

// ============================================================================
// Scenario Execution
// ============================================================================

export interface ScenarioExecution {
  scenarioNumber: number;
  scenarioId: string;
  personaId: string;
  tier: 1 | 2 | 3;
  conversationHistory: ConversationTurn[];
  startedAt: Date;
  completedAt?: Date;
  quickScore?: number; // Quick score for adaptive difficulty
}

export interface ConversationTurn {
  turnNumber: number;
  speaker: 'user' | 'bot';
  transcript: string;
  audioUrl?: string;
  timestamp: Date;
  metrics?: TurnMetrics;
}

export interface TurnMetrics {
  // Fluency
  wpm?: number;
  pauseCount?: number;
  pauseRatio?: number;
  
  // Syntax tags found
  syntaxTags?: Array<{
    targetId: string;
    snippet: string;
  }>;
  
  // Conversation moves
  moves?: string[];
  
  // Confidence signals
  confidenceSignals?: string[];
}

// ============================================================================
// Scoring Types
// ============================================================================

export interface UnifiedScore {
  overall: number; // 0-100
  proficiencyLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  breakdown: {
    fluency: number;      // 0-100, weighted 25%
    syntax: number;       // 0-100, weighted 25%
    conversation: number; // 0-100, weighted 30%
    confidence: number;   // 0-100, weighted 20%
  };
  details?: {
    fluencyMetrics: {
      avgWpm: number;
      pauseControl: number;
    };
    syntaxCoverage: {
      PC: boolean;
      FP: boolean;
      OP: boolean;
      Q: boolean;
      C: boolean;
    };
    conversationMetrics: {
      comprehension: number;
      repair: number;
      flow: number;
    };
  };
}

// ============================================================================
// UI State Types
// ============================================================================

export interface VoiceControllerState {
  recordingState: RecordingState;
  isRecording: boolean;
  isBotSpeaking: boolean;
  audioLevel: number; // 0-100 for visual feedback
  errorMessage?: string;
}

export interface DebugState {
  isVisible: boolean;
  showTranscripts: boolean;
  currentPersona?: PersonaPreset;
  liveMetrics: {
    totalTurns: number;
    avgWpm: number;
    syntaxTagsFound: number;
    repairEventsTriggered: number;
  };
}

// ============================================================================
// Scenario Selection
// ============================================================================

export interface ScenarioSelection {
  scenarioId: string;
  personaId: string;
  tier: 1 | 2 | 3;
  title: string;
  context: string;
}

export interface AdaptiveProgression {
  scenario1Score: number;
  scenario2Score: number;
  recommendedTier2: 1 | 2 | 3;
  recommendedTier3: 1 | 2 | 3;
}

// ============================================================================
// Database Types
// ============================================================================

export interface UnifiedExamRecord {
  id: string;
  session_id: string;
  user_id: string;
  
  // Scenarios
  scenario_1_id: string;
  scenario_2_id: string;
  scenario_3_id: string;
  
  // Personas
  persona_1_id: string;
  persona_2_id: string;
  persona_3_id: string;
  
  // Data
  conversation_transcript: ConversationTurn[];
  
  // Scores
  fluency_score: number;
  syntax_score: number;
  conversation_score: number;
  confidence_score: number;
  overall_score: number;
  proficiency_level: string;
  
  // Metadata
  duration_seconds: number;
  started_at: string;
  completed_at?: string;
  trace_id?: string;
  is_official: boolean;
}

