/**
 * Enhanced Live Data Viewer with 4-Panel Module Breakdown
 * Shows detailed metrics, tags, and score contributions for calibration
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminMode } from '@/hooks/useAdminMode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  RefreshCw, 
  TrendingUp, 
  MessageSquare, 
  ChevronDown, 
  ChevronUp,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { exportTraceJSON } from '@/lib/scoring/traceExporter';
import { getRecommendations, groupBySeverity } from '@/lib/scoring/debugPlaybook';
import type { ScoringTrace } from '@/components/assessment/conversation/types';

interface EnhancedLiveDataViewerProps {
  sessionId: string;
  moduleType?: 'pronunciation' | 'fluency' | 'confidence' | 'syntax' | 'conversation' | 'comprehension';
}

export function EnhancedLiveDataViewer({ sessionId, moduleType }: EnhancedLiveDataViewerProps) {
  const { isAdmin, isDev } = useAdminMode();
  const [trace, setTrace] = useState<ScoringTrace | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('fluency');

  const shouldShow = isAdmin || isDev;

  const loadTrace = async () => {
    if (!shouldShow) return;
    
    setLoading(true);
    try {
      // Load latest trace for this session
      const { data, error } = await supabase
        .from('scoring_traces')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error loading trace:', error);
        return;
      }

      if (data) {
        setTrace(data.trace_data as unknown as ScoringTrace);
      }
    } catch (error) {
      console.error('Error loading trace:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!shouldShow) return;
    
    loadTrace();

    if (autoRefresh) {
      const interval = setInterval(loadTrace, 3000);
      return () => clearInterval(interval);
    }
  }, [sessionId, autoRefresh, shouldShow]);

  if (!shouldShow) return null;

  if (!trace) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="fixed bottom-24 right-4 z-[9996] w-96 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold">CALIBRATION CONSOLE</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); loadTrace(); }}
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="text-xs text-muted-foreground text-center py-4 px-3">
              No scoring trace available yet. Start recording to see live metrics.
            </p>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  const handleExport = () => {
    if (trace) {
      exportTraceJSON(trace);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="fixed bottom-24 right-4 z-[9996] w-[600px] max-h-[700px] bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 border-b bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold">CALIBRATION CONSOLE</span>
              <Badge variant="secondary" className="text-[9px] h-4">
                {trace.meta.persona_id}
              </Badge>
              <Badge variant="outline" className="text-[9px] h-4">
                {trace.turns.length} turns
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => { e.stopPropagation(); handleExport(); }}
                title="Export trace JSON"
              >
                <Download className="h-3 w-3" />
              </Button>
              <button
                onClick={(e) => { e.stopPropagation(); setAutoRefresh(!autoRefresh); }}
                className="text-[10px] px-2 py-1 rounded hover:bg-muted"
              >
                {autoRefresh ? '🟢 Auto' : '⚪ Manual'}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => { e.stopPropagation(); loadTrace(); }}
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-5 h-9">
              <TabsTrigger value="fluency" className="text-xs">Fluency</TabsTrigger>
              <TabsTrigger value="syntax" className="text-xs">Syntax</TabsTrigger>
              <TabsTrigger value="conversation" className="text-xs">Conv</TabsTrigger>
              <TabsTrigger value="confidence" className="text-xs">Conf</TabsTrigger>
              <TabsTrigger value="debug" className="text-xs">Debug</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[600px] p-4">
              {/* Fluency Panel */}
              <TabsContent value="fluency" className="space-y-3 mt-0">
                <FluencyPanel trace={trace} />
              </TabsContent>

              {/* Syntax Panel */}
              <TabsContent value="syntax" className="space-y-3 mt-0">
                <SyntaxPanel trace={trace} />
              </TabsContent>

              {/* Conversation Panel */}
              <TabsContent value="conversation" className="space-y-3 mt-0">
                <ConversationPanel trace={trace} />
              </TabsContent>

              {/* Confidence Panel */}
              <TabsContent value="confidence" className="space-y-3 mt-0">
                <ConfidencePanel trace={trace} />
              </TabsContent>

              {/* Debug Panel */}
              <TabsContent value="debug" className="space-y-3 mt-0">
                <DebugPanel trace={trace} />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ============================================================================
// Fluency Panel
// ============================================================================

function FluencyPanel({ trace }: { trace: ScoringTrace }) {
  const fluencyScore = trace.scores.fluency;
  const userTurns = trace.turns.filter(t => t.speaker === 'user' && t.fluency_metrics);

  if (!fluencyScore && userTurns.length === 0) {
    return <div className="text-xs text-muted-foreground text-center py-8">No fluency data yet</div>;
  }

  return (
    <div className="space-y-3">
      {fluencyScore && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Fluency Score</span>
              <Badge variant="default" className="text-sm">{fluencyScore.score}/100</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Speed Subscore:</span>
              <span className="font-mono">{fluencyScore.speed}/60</span>
            </div>
            <div className="flex justify-between">
              <span>Pause Subscore:</span>
              <span className="font-mono">{fluencyScore.pause}/40</span>
            </div>
            {fluencyScore.speed_band && (
              <div className="text-[10px] text-muted-foreground mt-2">
                Band: {fluencyScore.speed_band}
              </div>
            )}
            {fluencyScore.pause_explanation && (
              <div className="text-[10px] text-muted-foreground">
                {fluencyScore.pause_explanation}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {userTurns.map((turn, idx) => (
        turn.fluency_metrics && (
          <Card key={idx}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs">Turn {turn.turn} Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-[10px]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">WPM:</span> 
                  <span className="font-mono ml-1">{turn.fluency_metrics.articulation_wpm.toFixed(0)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Words:</span> 
                  <span className="font-mono ml-1">{turn.fluency_metrics.word_count_non_filler}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pauses:</span> 
                  <span className="font-mono ml-1">{turn.fluency_metrics.pause_count}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Long:</span> 
                  <span className="font-mono ml-1">{turn.fluency_metrics.long_pause_count}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max:</span> 
                  <span className="font-mono ml-1">{turn.fluency_metrics.max_pause_sec.toFixed(1)}s</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ratio:</span> 
                  <span className="font-mono ml-1">{(turn.fluency_metrics.pause_ratio * 100).toFixed(0)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      ))}
    </div>
  );
}

// ============================================================================
// Syntax Panel
// ============================================================================

function SyntaxPanel({ trace }: { trace: ScoringTrace }) {
  const syntaxScore = trace.scores.syntax;
  const syntaxTags = trace.turns.flatMap(t => t.syntax_tags || []);

  if (!syntaxScore && syntaxTags.length === 0) {
    return <div className="text-xs text-muted-foreground text-center py-8">No syntax data yet</div>;
  }

  const getIcon = (coverage: number) => {
    if (coverage === 1.0) return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    if (coverage > 0) return <HelpCircle className="h-3 w-3 text-yellow-500" />;
    return <XCircle className="h-3 w-3 text-red-500" />;
  };

  return (
    <div className="space-y-3">
      {syntaxScore && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Syntax Score</span>
              <Badge variant="default" className="text-sm">{syntaxScore.score}/100</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {syntaxScore.coverage && (
              <div className="space-y-1">
                {Object.entries(syntaxScore.coverage).map(([target, cov]) => (
                  <div key={target} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getIcon(cov.coverage_score)}
                      <span className="font-mono">{target}</span>
                    </div>
                    <span className="font-mono text-[10px]">
                      {(() => {
                        const val = syntaxScore[target as keyof typeof syntaxScore];
                        return typeof val === 'number' ? val : '?';
                      })()}/{[25,15,25,15,20][['PC', 'FP', 'OP', 'Q', 'C'].indexOf(target)]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {syntaxTags.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Evidence ({syntaxTags.length} tags)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {syntaxTags.slice(0, 5).map((tag, idx) => (
              <div key={idx} className="text-[10px] p-1 bg-muted/50 rounded">
                <Badge variant="outline" className="text-[8px] mr-1">{tag.target_id}</Badge>
                <span className="font-mono">{tag.snippet}</span>
                <Badge className="text-[8px] ml-1" variant={tag.quality === 'clear' ? 'default' : 'secondary'}>
                  {tag.quality}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Conversation Panel
// ============================================================================

function ConversationPanel({ trace }: { trace: ScoringTrace }) {
  const convScore = trace.scores.conversation;

  if (!convScore) {
    return <div className="text-xs text-muted-foreground text-center py-8">No conversation data yet</div>;
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Conversation Score</span>
            <Badge variant="default" className="text-sm">{convScore.score}/100</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span>Comprehension:</span>
            <span className="font-mono">{convScore.comprehension}/50</span>
          </div>
          <div className="flex justify-between">
            <span>Repair:</span>
            <span className="font-mono">{convScore.repair}/30</span>
          </div>
          <div className="flex justify-between">
            <span>Flow:</span>
            <span className="font-mono">{convScore.flow}/20</span>
          </div>
        </CardContent>
      </Card>

      {convScore.comprehension_metrics && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Comprehension Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>Answer Rate:</span>
              <span className="font-mono">{(convScore.comprehension_metrics.answers_prompt_rate * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Slot Coverage:</span>
              <span className="font-mono">{(convScore.comprehension_metrics.slot_coverage * 100).toFixed(0)}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {convScore.repair_metrics && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Repair Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>Total:</span>
              <span className="font-mono">{convScore.repair_metrics.repair_events_total}</span>
            </div>
            <div className="flex justify-between">
              <span>Resolved:</span>
              <span className="font-mono">{convScore.repair_metrics.repair_events_resolved}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {convScore.flow_metrics && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Flow Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>Questions:</span>
              <span className="font-mono">{convScore.flow_metrics.questions_count}</span>
            </div>
            <div className="flex justify-between">
              <span>Proposals:</span>
              <span className="font-mono">{convScore.flow_metrics.proposals_count}</span>
            </div>
            <div className="flex justify-between">
              <span>Closings:</span>
              <span className="font-mono">{convScore.flow_metrics.closings_count}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Confidence Panel
// ============================================================================

function ConfidencePanel({ trace }: { trace: ScoringTrace }) {
  const confScore = trace.scores.confidence;

  if (!confScore) {
    return <div className="text-xs text-muted-foreground text-center py-8">No confidence data yet</div>;
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Confidence Score</span>
            <Badge variant="default" className="text-sm">{confScore.final}/100</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span>Speaking:</span>
            <span className="font-mono">{confScore.speaking}/100</span>
          </div>
          <div className="flex justify-between">
            <span>Self-Assessment:</span>
            <span className="font-mono">{confScore.self}/100</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-2">
            Final = 50% speaking + 50% self
          </div>
        </CardContent>
      </Card>

      {confScore.rubric && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Rubric Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>Length/Dev:</span>
              <span className="font-mono">{confScore.rubric.length_development}/25</span>
            </div>
            <div className="flex justify-between">
              <span>Assertiveness:</span>
              <span className="font-mono">{confScore.rubric.assertiveness_ownership}/25</span>
            </div>
            <div className="flex justify-between">
              <span>Engagement:</span>
              <span className="font-mono">{confScore.rubric.emotional_engagement}/20</span>
            </div>
            <div className="flex justify-between">
              <span>Clarity:</span>
              <span className="font-mono">{confScore.rubric.clarity_control}/15</span>
            </div>
            <div className="flex justify-between">
              <span>Confidence Lang:</span>
              <span className="font-mono">{confScore.rubric.confidence_language}/15</span>
            </div>
          </CardContent>
        </Card>
      )}

      {confScore.signal_counts && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Signal Counts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>Ownership:</span>
              <span className="font-mono">{confScore.signal_counts.ownership_count}</span>
            </div>
            <div className="flex justify-between">
              <span>Boundary:</span>
              <span className="font-mono">{confScore.signal_counts.boundary_count}</span>
            </div>
            <div className="flex justify-between">
              <span>Engagement:</span>
              <span className="font-mono">{confScore.signal_counts.engagement_count}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Debug Panel
// ============================================================================

function DebugPanel({ trace }: { trace: ScoringTrace }) {
  if (trace.debug_flags.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No debug flags detected</p>
        <p className="text-[10px] text-muted-foreground">All systems nominal</p>
      </div>
    );
  }

  const recommendations = getRecommendations(trace.debug_flags);
  const grouped = groupBySeverity(recommendations);

  return (
    <div className="space-y-3">
      {grouped.errors.map((rec, idx) => (
        <Card key={idx} className="border-red-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              {rec.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[10px]">
            <p>{rec.description}</p>
            <div className="bg-muted/50 p-2 rounded space-y-1">
              <div className="font-semibold">Recommendations:</div>
              {rec.recommendations.map((r, i) => (
                <div key={i} className="text-[9px]">• {r}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {grouped.warnings.map((rec, idx) => (
        <Card key={idx} className="border-yellow-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
              {rec.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[10px]">
            <p>{rec.description}</p>
            <div className="bg-muted/50 p-2 rounded space-y-1">
              <div className="font-semibold">Recommendations:</div>
              {rec.recommendations.map((r, i) => (
                <div key={i} className="text-[9px]">• {r}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {grouped.info.map((rec, idx) => (
        <Card key={idx} className="border-blue-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <HelpCircle className="h-3 w-3 text-blue-500" />
              {rec.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[10px]">
            <p>{rec.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

