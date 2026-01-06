/**
 * Prompt Bank Types
 * Defines the structure of prompt banks and prompts
 */

export type ModuleType = 
  | 'pronunciation' 
  | 'fluency' 
  | 'confidence' 
  | 'syntax' 
  | 'conversation' 
  | 'speaking' 
  | 'comprehension';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface PromptBase {
  id: string;
  type: string;
  tags: string[];
  difficulty: number; // 1-5
  cefr?: CEFRLevel;
}

// Fluency prompts (picture description)
export interface FluencyPrompt extends PromptBase {
  type: 'picture';
  payload: {
    imageUrl: string;
    description: string;
    altText?: string;
  };
}

// Pronunciation prompts (read aloud or listen & repeat)
export interface PronunciationPrompt extends PromptBase {
  type: 'read_aloud' | 'listen_repeat';
  payload: {
    text: string;
    audioUrl?: string; // For listen & repeat
    phonemes?: string[]; // IPA phonemes being tested
    phonetic?: string; // IPA transcription
  };
}

// Confidence prompts (speaking about confidence)
export interface ConfidencePrompt extends PromptBase {
  type: 'speaking';
  payload: {
    question: string;
    context?: string;
  };
}

// Syntax prompts (syntax exercises)
export interface SyntaxPrompt extends PromptBase {
  type: 'syntax_exercise';
  payload: {
    exerciseType: 'E1' | 'E2' | 'E3';
    duration: 15 | 30 | 60;
    instruction: string;
    targetStructures: string[];
  };
}

// Conversation prompts (dialogue scenarios)
export interface ConversationPrompt extends PromptBase {
  type: 'scenario';
  payload: {
    scenario: string;
    role: string;
    context: string;
  };
}

// Speaking prompts (open-ended question)
export interface SpeakingPrompt extends PromptBase {
  type: 'question';
  payload: {
    question: string;
    context?: string;
  };
}

// Comprehension prompts (multi-select listening)
export interface ComprehensionPrompt extends PromptBase {
  type: 'listen_multi_select';
  payload: {
    audioScript: string;
    transcript_fr: string;
    word_count: number;
    estimated_duration_s: number;
    prompt: {
      fr: string;
      en: string;
    };
    options: Array<{
      id: string;
      fr: string;
      en: string;
    }>;
    answer_key: {
      correct_option_ids: string[];
    };
  };
}

export type Prompt = 
  | FluencyPrompt 
  | PronunciationPrompt 
  | ConfidencePrompt 
  | SyntaxPrompt 
  | ConversationPrompt 
  | SpeakingPrompt 
  | ComprehensionPrompt;

export interface PromptBank {
  version: string;
  module: ModuleType;
  prompts: Prompt[];
  meta?: {
    description?: string;
    lastUpdated?: string;
    author?: string;
  };
}

export interface PromptSelection {
  [module: string]: string[]; // module -> array of prompt IDs
}
