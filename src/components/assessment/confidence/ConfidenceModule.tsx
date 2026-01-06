import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, ArrowRight, CheckCircle } from 'lucide-react';
import { ConfidenceQuestionnaire } from './ConfidenceQuestionnaire';

interface ConfidenceModuleProps {
  sessionId: string;
  onComplete: () => void;
}

type Phase = 'intro' | 'questionnaire' | 'complete';

export function ConfidenceModule({ sessionId, onComplete }: ConfidenceModuleProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [questionnaireScore, setQuestionnaireScore] = useState<number | null>(null);

  const handleQuestionnaireComplete = (score: number) => {
    setQuestionnaireScore(score);
    setPhase('complete');
  };

  const handleFinalComplete = () => {
    onComplete();
  };

  if (phase === 'intro') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Confidence Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground">
              Measure your speaking confidence through a short self-reflection questionnaire.
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">This assessment includes:</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• <strong>8 quick questions</strong> about your speaking habits</li>
                <li>• <strong>Honest answers</strong> about your last 14 days of speaking</li>
              </ul>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Important:</strong> We do NOT grade grammar, accent, or vocabulary. 
                This measures your confidence in speaking, not your French perfection.
              </p>
            </div>

            <div className="text-center pt-4">
              <Button size="lg" onClick={() => setPhase('questionnaire')} className="gap-2">
                Start
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'questionnaire') {
    return (
      <ConfidenceQuestionnaire
        sessionId={sessionId}
        onComplete={handleQuestionnaireComplete}
      />
    );
  }

  if (phase === 'complete') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-primary/30">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Confidence Assessment Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Confidence Score</div>
              <div className="text-3xl font-bold text-primary">{questionnaireScore}</div>
            </div>

            <Button size="lg" onClick={handleFinalComplete}>
              Continue to Next Module
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
