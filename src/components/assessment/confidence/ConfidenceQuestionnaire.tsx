import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { ArrowRight, ArrowLeft, ClipboardList, Info } from 'lucide-react';
import { 
  confidenceQuestions, 
  calculateQuestionnaireScore,
  type ConfidenceQuestionConfig,
  type ScenarioOption
} from './confidenceQuestions';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ConfidenceQuestionnaireProps {
  sessionId: string;
  onComplete: (normalizedScore: number) => void;
}

export function ConfidenceQuestionnaire({ sessionId, onComplete }: ConfidenceQuestionnaireProps) {
  const { user } = useAuth();
  const [showIntro, setShowIntro] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, number | string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentQuestion = confidenceQuestions[currentIndex];
  const progress = ((currentIndex + 1) / confidenceQuestions.length) * 100;
  const isLastQuestion = currentIndex === confidenceQuestions.length - 1;
  const hasAnswer = responses[currentQuestion?.id] !== undefined;

  const handleAnswer = (value: number | string) => {
    setResponses(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));
  };

  const handleNext = async () => {
    if (isLastQuestion) {
      await handleSubmit();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const { rawScore, normalizedScore, honestyFlag } = calculateQuestionnaireScore(responses);
      
      await supabase.from('confidence_questionnaire_responses').insert({
        session_id: sessionId,
        user_id: user.id,
        responses: responses,
        raw_score: rawScore,
        normalized_score: normalizedScore,
        honesty_flag: honestyFlag
      });
      
      onComplete(normalizedScore);
    } catch (error) {
      console.error('Failed to save questionnaire:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showIntro) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <ClipboardList className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Self-Assessment Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground">
              We'll ask you 8 quick questions about how you typically feel when speaking French.
            </p>
            
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex gap-3">
              <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Important:</strong> Answer based on your <em>default behavior in the last 14 days</em>, not your "best day" or how you wish you behaved.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">What we're measuring:</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Your willingness to start conversations</li>
                <li>• How you handle mistakes and corrections</li>
                <li>• Your comfort with imperfection</li>
                <li>• Post-conversation self-evaluation patterns</li>
              </ul>
            </div>

            <div className="text-center pt-4">
              <Button size="lg" onClick={() => setShowIntro(false)} className="gap-2">
                Start Questions
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {confidenceQuestions.length}
            </span>
            <span className="text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
        <CardContent className="pt-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <QuestionRenderer
                question={currentQuestion}
                value={responses[currentQuestion.id]}
                onChange={handleAnswer}
              />
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentIndex === 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!hasAnswer || isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? 'Saving...' : isLastQuestion ? 'Finish Confidence' : 'Next'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Question renderer component
interface QuestionRendererProps {
  question: ConfidenceQuestionConfig;
  value: number | string | undefined;
  onChange: (value: number | string) => void;
}

function QuestionRenderer({ question, value, onChange }: QuestionRendererProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium leading-relaxed">{question.prompt}</h3>
      
      {question.type === 'slider' && (
        <SliderInput
          value={value as number | undefined}
          onChange={onChange}
          leftLabel={question.leftLabel}
          rightLabel={question.rightLabel}
          min={question.min}
          max={question.max}
        />
      )}
      
      {question.type === 'likert' && (
        <LikertInput
          options={question.options}
          value={value as number | undefined}
          onChange={onChange}
        />
      )}
      
      {(question.type === 'scenario' || question.type === 'tradeoff') && (
        <ScenarioInput
          options={question.options}
          value={value as string | undefined}
          onChange={onChange}
        />
      )}
    </div>
  );
}

// Slider input
interface SliderInputProps {
  value: number | undefined;
  onChange: (value: number) => void;
  leftLabel: string;
  rightLabel: string;
  min: number;
  max: number;
}

function SliderInput({ value, onChange, leftLabel, rightLabel, min, max }: SliderInputProps) {
  const currentValue = value ?? 5;
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="px-2">
        <Slider
          value={[currentValue]}
          onValueChange={([v]) => onChange(v)}
          min={min}
          max={max}
          step={1}
          className="w-full"
        />
      </div>
      <div className="text-center">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold">
          {currentValue}
        </span>
      </div>
    </div>
  );
}

// Likert input
interface LikertInputProps {
  options: string[];
  value: number | undefined;
  onChange: (value: number) => void;
}

function LikertInput({ options, value, onChange }: LikertInputProps) {
  return (
    <div className="space-y-2">
      {options.map((option, index) => (
        <button
          key={index}
          onClick={() => onChange(index)}
          className={`w-full text-left p-4 rounded-lg border transition-all ${
            value === index
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          }`}
        >
          <span className="font-medium">{option}</span>
        </button>
      ))}
    </div>
  );
}

// Scenario input (also used for tradeoff)
interface ScenarioInputProps {
  options: ScenarioOption[];
  value: string | undefined;
  onChange: (value: string) => void;
}

function ScenarioInput({ options, value, onChange }: ScenarioInputProps) {
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`w-full text-left p-4 rounded-lg border transition-all ${
            value === option.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          }`}
        >
          <span className="font-medium">{option.text}</span>
        </button>
      ))}
    </div>
  );
}
