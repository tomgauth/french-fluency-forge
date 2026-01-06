/**
 * Debug Panel for Unified Exam
 * Simplified admin/dev panel showing live metrics and controls
 * Visible only in debug mode (Cmd+D or dev users)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Bug, 
  SkipForward, 
  Download, 
  AlertTriangle,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { exportTraceJSON } from '@/lib/scoring/traceExporter';
import { getPersona } from '../conversation/personaLibrary';
import type { ScoringTrace } from '../conversation/types';
import type { ScenarioExecution } from './types';

interface DebugPanelProps {
  currentScenario: number;
  scenarios: ScenarioExecution[];
  trace?: ScoringTrace | null;
  onSkipScenario?: () => void;
  onInjectRepairEvent?: () => void;
}

export function DebugPanel({
  currentScenario,
  scenarios,
  trace,
  onSkipScenario,
  onInjectRepairEvent,
}: DebugPanelProps) {
  
  const currentScenarioData = scenarios[currentScenario - 1];
  const persona = currentScenarioData ? getPersona(currentScenarioData.personaId) : null;
  
  const handleExportTrace = () => {
    if (trace) {
      exportTraceJSON(trace);
    }
  };
  
  // Calculate live metrics
  const allUserTurns = scenarios.flatMap(s => 
    s.conversationHistory.filter(t => t.speaker === 'user')
  );
  
  const totalWords = allUserTurns.reduce((sum, turn) => 
    sum + turn.transcript.split(/\s+/).length, 0
  );
  
  const avgWpm = allUserTurns.length > 0
    ? totalWords / (allUserTurns.length * 10 / 60) // Assume ~10s per turn
    : 0;
  
  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-card border-l border-border shadow-2xl z-[9999] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-yellow-500/10">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-yellow-600" />
          <h3 className="font-bold text-sm">DEBUG PANEL</h3>
          <Badge variant="outline" className="text-xs">Dev Mode</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Cmd+D to toggle
        </p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          
          {/* Current Scenario Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Current Scenario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scenario:</span>
                <Badge variant="secondary">{currentScenario} of 3</Badge>
              </div>
              {currentScenarioData && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID:</span>
                    <span className="font-mono">{currentScenarioData.scenarioId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tier:</span>
                    <Badge variant="outline">Tier {currentScenarioData.tier}</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Persona Info */}
          {persona && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Active Persona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID:</span>
                  <Badge>{persona.id}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium mt-1">{persona.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-1 mt-2 text-[10px]">
                  <div>Coop: {persona.parameters.cooperativeness}</div>
                  <div>Verb: {persona.parameters.verbosity}</div>
                  <div>Policy: {persona.parameters.policy_rigidity}</div>
                  <div>Confuse: {persona.parameters.confusion_rate}</div>
                  <div>Tone: {persona.parameters.emotional_tone}</div>
                  <div>Init: {persona.parameters.initiative}</div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Live Metrics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Live Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Turns:</span>
                <span className="font-mono">{allUserTurns.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg WPM:</span>
                <span className="font-mono">{avgWpm.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Words:</span>
                <span className="font-mono">{totalWords}</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Conversation Transcript */}
          {currentScenarioData && currentScenarioData.conversationHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Transcript (Scenario {currentScenario})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {currentScenarioData.conversationHistory.map((turn, idx) => (
                      <div key={idx} className={`text-xs p-2 rounded ${
                        turn.speaker === 'user' 
                          ? 'bg-blue-500/10 border-l-2 border-blue-500' 
                          : 'bg-green-500/10 border-l-2 border-green-500'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[9px]">
                            {turn.speaker === 'user' ? 'USER' : 'BOT'}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground">
                            Turn {turn.turnNumber}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          {turn.transcript}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
          
          {/* Debug Controls */}
          <Card className="border-yellow-500/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Debug Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {onSkipScenario && (
                <Button 
                  onClick={onSkipScenario} 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                >
                  <SkipForward className="w-3 h-3 mr-2" />
                  Skip to Next Scenario
                </Button>
              )}
              
              {onInjectRepairEvent && (
                <Button 
                  onClick={onInjectRepairEvent} 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                >
                  <AlertTriangle className="w-3 h-3 mr-2" />
                  Inject Repair Event
                </Button>
              )}
              
              {trace && (
                <Button 
                  onClick={handleExportTrace} 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                >
                  <Download className="w-3 h-3 mr-2" />
                  Export Trace JSON
                </Button>
              )}
            </CardContent>
          </Card>
          
          {/* Debug Flags */}
          {trace && trace.debug_flags.length > 0 && (
            <Card className="border-red-500/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Debug Flags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {trace.debug_flags.map((flag, idx) => (
                  <Badge key={idx} variant="destructive" className="text-xs mr-1">
                    {flag}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
          
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Debug Panel Toggle Button
 * Shows in corner to activate debug panel
 */
interface DebugToggleProps {
  isVisible: boolean;
  onClick: () => void;
}

export function DebugToggle({ isVisible, onClick }: DebugToggleProps) {
  return (
    <button
      onClick={onClick}
      className="fixed top-4 right-4 z-[9998] bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg transition-all"
      title="Toggle Debug Panel (Cmd+D)"
    >
      <Bug className="w-3 h-3 inline mr-1" />
      {isVisible ? 'Hide' : 'Show'} Debug
    </button>
  );
}

