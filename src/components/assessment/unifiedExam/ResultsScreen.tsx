/**
 * Results Screen for Unified Exam
 * Shows 4-part score breakdown with visual feedback
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  MessageSquare, 
  CheckCircle, 
  Award,
  Download,
  RefreshCw
} from 'lucide-react';
import type { UnifiedScore } from './types';

interface ResultsScreenProps {
  score: UnifiedScore;
  onViewReport: () => void;
  onRetake?: () => void;
  canRetake: boolean;
  nextRetakeDate?: Date;
}

export function ResultsScreen({ 
  score, 
  onViewReport, 
  onRetake, 
  canRetake,
  nextRetakeDate 
}: ResultsScreenProps) {
  
  // ============================================================================
  // Level Display
  // ============================================================================
  
  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      A1: 'text-orange-500',
      A2: 'text-yellow-500',
      B1: 'text-blue-500',
      B2: 'text-indigo-500',
      C1: 'text-purple-500',
      C2: 'text-pink-500',
    };
    return colors[level] || 'text-primary';
  };
  
  const getLevelDescription = (level: string) => {
    const descriptions: Record<string, string> = {
      A1: 'Beginner - Basic phrases and expressions',
      A2: 'Elementary - Simple conversations on familiar topics',
      B1: 'Intermediate - Can handle most situations while traveling',
      B2: 'Upper Intermediate - Fluent in most contexts',
      C1: 'Advanced - Effective in complex situations',
      C2: 'Mastery - Near-native proficiency',
    };
    return descriptions[level] || '';
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-orange-600';
  };
  
  // ============================================================================
  // Main Render
  // ============================================================================
  
  return (
    <div className="max-w-4xl mx-auto mt-8 space-y-6 pb-12">
      {/* Header Card */}
      <Card className="border-2 border-primary/20">
        <CardContent className="p-12 text-center space-y-6">
          <Award className="w-20 h-20 mx-auto text-primary" />
          
          <div>
            <h1 className="text-4xl font-bold mb-2">Assessment Complete!</h1>
            <p className="text-lg text-muted-foreground">
              Your French proficiency level
            </p>
          </div>
          
          <div className="space-y-3">
            <div className={`text-6xl font-bold ${getLevelColor(score.proficiencyLevel)}`}>
              {score.proficiencyLevel}
            </div>
            <p className="text-sm text-muted-foreground">
              {getLevelDescription(score.proficiencyLevel)}
            </p>
          </div>
          
          <div className={`text-7xl font-bold ${getScoreColor(score.overall)}`}>
            {score.overall}<span className="text-3xl text-muted-foreground">/100</span>
          </div>
        </CardContent>
      </Card>
      
      {/* Skill Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Skill Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Fluency */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                <span className="font-medium">Fluency (Speed & Pauses)</span>
                <Badge variant="outline" className="text-xs">25% weight</Badge>
              </div>
              <span className={`text-2xl font-bold ${getScoreColor(score.breakdown.fluency)}`}>
                {score.breakdown.fluency}
              </span>
            </div>
            <Progress value={score.breakdown.fluency} className="h-3" />
            {score.details?.fluencyMetrics && (
              <p className="text-sm text-muted-foreground">
                Average: {score.details.fluencyMetrics.avgWpm.toFixed(0)} WPM
              </p>
            )}
          </div>
          
          {/* Grammar/Syntax */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-medium">Grammar (Syntax Variety)</span>
                <Badge variant="outline" className="text-xs">25% weight</Badge>
              </div>
              <span className={`text-2xl font-bold ${getScoreColor(score.breakdown.syntax)}`}>
                {score.breakdown.syntax}
              </span>
            </div>
            <Progress value={score.breakdown.syntax} className="h-3" />
            {score.details?.syntaxCoverage && (
              <div className="flex gap-2 text-xs">
                {score.details.syntaxCoverage.PC && <Badge variant="secondary">Passé Composé ✓</Badge>}
                {score.details.syntaxCoverage.FP && <Badge variant="secondary">Futur Proche ✓</Badge>}
                {score.details.syntaxCoverage.Q && <Badge variant="secondary">Questions ✓</Badge>}
                {score.details.syntaxCoverage.C && <Badge variant="secondary">Connectors ✓</Badge>}
              </div>
            )}
          </div>
          
          {/* Conversation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-purple-500" />
                <span className="font-medium">Conversation Skills</span>
                <Badge variant="outline" className="text-xs">30% weight</Badge>
              </div>
              <span className={`text-2xl font-bold ${getScoreColor(score.breakdown.conversation)}`}>
                {score.breakdown.conversation}
              </span>
            </div>
            <Progress value={score.breakdown.conversation} className="h-3" />
            {score.details?.conversationMetrics && (
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div>Comprehension: {score.details.conversationMetrics.comprehension}/50</div>
                <div>Repair: {score.details.conversationMetrics.repair}/30</div>
                <div>Flow: {score.details.conversationMetrics.flow}/20</div>
              </div>
            )}
          </div>
          
          {/* Confidence */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="w-5 h-5 text-amber-500" />
                <span className="font-medium">Confidence</span>
                <Badge variant="outline" className="text-xs">20% weight</Badge>
              </div>
              <span className={`text-2xl font-bold ${getScoreColor(score.breakdown.confidence)}`}>
                {score.breakdown.confidence}
              </span>
            </div>
            <Progress value={score.breakdown.confidence} className="h-3" />
            <p className="text-sm text-muted-foreground">
              Based on self-assessment questionnaire
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <Button onClick={onViewReport} size="lg" className="min-w-48">
          <Download className="w-4 h-4 mr-2" />
          View Detailed Report
        </Button>
        
        {canRetake && onRetake && (
          <Button onClick={onRetake} variant="outline" size="lg" className="min-w-48">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retake Assessment
          </Button>
        )}
        
        {!canRetake && nextRetakeDate && (
          <Button disabled variant="outline" size="lg" className="min-w-48">
            <RefreshCw className="w-4 h-4 mr-2" />
            Available {nextRetakeDate.toLocaleDateString()}
          </Button>
        )}
      </div>
      
      {/* Info Note */}
      <Card className="bg-muted/30">
        <CardContent className="p-6 text-sm text-muted-foreground text-center">
          <p>
            💡 This assessment measured your skills across 3 real-world conversation scenarios.
          </p>
          <p className="mt-2">
            You can retake the official assessment once every 14 days, or practice anytime in the Practice section.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

