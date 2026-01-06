/**
 * Resume Session Banner
 * Shown when user has an unfinished speaking assessment session
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Play, RotateCcw, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ResumeSessionBannerProps {
  sessionId: string;
  currentModule: string | null;
  currentItemIndex: number;
  onContinue: () => void;
  onRestartModule: () => void;
  onRestartSession: () => void;
  onDismiss: () => void;
}

export function ResumeSessionBanner({
  sessionId,
  currentModule,
  currentItemIndex,
  onContinue,
  onRestartModule,
  onRestartSession,
  onDismiss,
}: ResumeSessionBannerProps) {
  const [showOptions, setShowOptions] = useState(false);

  const moduleNames: Record<string, string> = {
    pronunciation: 'Pronunciation',
    fluency: 'Fluency',
    confidence: 'Confidence',
    syntax: 'Syntax',
    conversation: 'Speech Test',
    comprehension: 'Comprehension',
  };

  const moduleName = currentModule ? moduleNames[currentModule] || currentModule : 'Unknown';

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <CardTitle>Continue Your Speaking Checkup</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          You have an unfinished assessment. Pick up where you left off or start fresh.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            <strong>Current progress:</strong> {moduleName} module, item {currentItemIndex + 1}
          </AlertDescription>
        </Alert>

        {!showOptions ? (
          <div className="flex gap-2">
            <Button onClick={onContinue} className="flex-1">
              <Play className="mr-2 h-4 w-4" />
              Continue Assessment
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowOptions(true)}
            >
              More Options
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button onClick={onContinue} className="w-full">
              <Play className="mr-2 h-4 w-4" />
              Continue from where I left off
            </Button>
            <Button
              variant="outline"
              onClick={onRestartModule}
              className="w-full"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart {moduleName} module
            </Button>
            <Button
              variant="outline"
              onClick={onRestartSession}
              className="w-full"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart entire checkup
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowOptions(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
