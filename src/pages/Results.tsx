import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminMode } from "@/hooks/useAdminMode";
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Download, Share2, AlertCircle, Target, ChevronRight, Info } from "lucide-react";

interface SkillScore {
  skill: string;
  score: number;
  fullMark: 10;
  available: boolean;
  description?: string;
  rawValue?: string;
}

interface SessionData {
  fluencyWpm: number | null;
  pronunciationScore: number | null;
  confidenceScore: number | null;
  confidenceQuestionnaireScore: number | null;
  confidenceHonestyFlag: boolean;
  syntaxScore: number | null;
  conversationScore: number | null;
  comprehensionScore: number | null;
  archetype: string | null;
}

// Skill descriptions for the results page
const SKILL_DESCRIPTIONS: Record<string, string> = {
  Pronunciation: "Ability to produce French sounds accurately, especially challenging minimal pairs like 'dessus/dessous' and nasal vowels.",
  Fluency: "Speaking speed and naturalness measured in words per minute (WPM). Target: 80-150 WPM for conversational French.",
  Confidence: "Willingness to express opinions, take risks, and speak without excessive hesitation in French.",
  Syntax: "Grammatical accuracy including verb conjugation, gender agreement, and correct sentence structure.",
  Conversation: "Ability to handle real-world dialogue, respond to unexpected situations, and adapt to misunderstandings.",
  Comprehension: "Understanding of natural spoken French at native speed, including informal speech and varied accents."
};

// Convert WPM to 1-10 scale (target: 80-150 WPM for French)
const wpmToScore = (wpm: number | null): number => {
  if (wpm === null) return 0;
  // Scale: 0 WPM = 1, 120+ WPM = 10
  const score = Math.min(10, Math.max(1, Math.round((wpm / 120) * 10)));
  return score;
};

// Convert pronunciation similarity (0-100) to 1-10 scale
const pronunciationToScore = (similarity: number | null): number => {
  if (similarity === null) return 0;
  return Math.min(10, Math.max(1, Math.round(similarity / 10)));
};

// Convert AI score (0-100) to 1-10 scale
const aiScoreToScale = (score: number | null): number => {
  if (score === null) return 0;
  return Math.min(10, Math.max(1, Math.round(score / 10)));
};

const Results = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const { showDevTools } = useAdminMode();
  
  // Dummy data for demo/preview mode
  const DUMMY_DATA: SessionData = {
    fluencyWpm: 95,
    pronunciationScore: 72,
    confidenceScore: 65,
    confidenceQuestionnaireScore: 70,
    confidenceHonestyFlag: true,
    syntaxScore: 58,
    conversationScore: 48,
    comprehensionScore: 81,
    archetype: "Le Perfectionniste"
  };

  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<SessionData>({
    fluencyWpm: null,
    pronunciationScore: null,
    confidenceScore: null,
    confidenceQuestionnaireScore: null,
    confidenceHonestyFlag: false,
    syntaxScore: null,
    conversationScore: null,
    comprehensionScore: null,
    archetype: null
  });
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      // If no session, use dummy data for demo
      if (!sessionId) {
        setSessionData(DUMMY_DATA);
        setIsDemoMode(true);
        setLoading(false);
        return;
      }

      try {
        // Fetch session info
        const { data: session } = await supabase
          .from("assessment_sessions")
          .select("archetype")
          .eq("id", sessionId)
          .maybeSingle();

        // Fetch fluency recordings for WPM average
        const { data: fluencyRecordings } = await supabase
          .from("fluency_recordings")
          .select("wpm")
          .eq("session_id", sessionId)
          .eq("used_for_scoring", true)
          .not("wpm", "is", null);

        // Calculate average WPM
        let avgWpm: number | null = null;
        if (fluencyRecordings && fluencyRecordings.length > 0) {
          const totalWpm = fluencyRecordings.reduce((sum, r) => sum + (r.wpm || 0), 0);
          avgWpm = Math.round(totalWpm / fluencyRecordings.length);
        }

        // Fetch skill recordings for Confidence, Syntax, and Conversation
        const { data: skillRecordings } = await supabase
          .from("skill_recordings")
          .select("module_type, ai_score")
          .eq("session_id", sessionId)
          .eq("used_for_scoring", true)
          .not("ai_score", "is", null);

        // Fetch confidence questionnaire response
        const { data: questionnaireData } = await supabase
          .from("confidence_questionnaire_responses")
          .select("normalized_score, honesty_flag")
          .eq("session_id", sessionId)
          .maybeSingle();

        // Calculate average scores per module
        const moduleScores: Record<string, number[]> = {};
        if (skillRecordings) {
          for (const recording of skillRecordings) {
            if (!moduleScores[recording.module_type]) {
              moduleScores[recording.module_type] = [];
            }
            if (recording.ai_score !== null) {
              moduleScores[recording.module_type].push(Number(recording.ai_score));
            }
          }
        }

        const getAvgScore = (moduleType: string): number | null => {
          const scores = moduleScores[moduleType];
          if (!scores || scores.length === 0) return null;
          return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        };

        // Confidence now comes exclusively from the questionnaire
        const questionnaireConfidence = questionnaireData?.normalized_score ?? null;
        const combinedConfidenceScore =
          questionnaireConfidence !== null ? Math.round(questionnaireConfidence) : null;

        // TODO: Fetch pronunciation scores when available
        const pronunciationScore: number | null = null;

        // Fetch comprehension scores
        const { data: comprehensionRecordings } = await supabase
          .from("comprehension_recordings")
          .select("ai_score")
          .eq("session_id", sessionId)
          .eq("used_for_scoring", true)
          .not("ai_score", "is", null);
        
        let comprehensionScore: number | null = null;
        if (comprehensionRecordings && comprehensionRecordings.length > 0) {
          const totalScore = comprehensionRecordings.reduce((sum, r) => sum + Number(r.ai_score || 0), 0);
          comprehensionScore = Math.round(totalScore / comprehensionRecordings.length);
        }

        setSessionData({
          fluencyWpm: avgWpm,
          pronunciationScore,
          confidenceScore: combinedConfidenceScore,
          confidenceQuestionnaireScore: questionnaireConfidence,
          confidenceHonestyFlag: questionnaireData?.honesty_flag ?? false,
          syntaxScore: getAvgScore("syntax"),
          conversationScore: getAvgScore("conversation"),
          comprehensionScore,
          archetype: session?.archetype || null
        });
      } catch (error) {
        console.error("Error fetching results:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [sessionId]);

  // Build radar chart data - 6 skills
  const skillData: SkillScore[] = [
    { 
      skill: "Pronunciation", 
      score: pronunciationToScore(sessionData.pronunciationScore), 
      fullMark: 10,
      available: sessionData.pronunciationScore !== null,
      description: SKILL_DESCRIPTIONS.Pronunciation,
      rawValue: sessionData.pronunciationScore !== null ? `${sessionData.pronunciationScore}% similarity` : undefined
    },
    { 
      skill: "Fluency", 
      score: wpmToScore(sessionData.fluencyWpm), 
      fullMark: 10,
      available: sessionData.fluencyWpm !== null,
      description: SKILL_DESCRIPTIONS.Fluency,
      rawValue: sessionData.fluencyWpm !== null ? `${sessionData.fluencyWpm} WPM` : undefined
    },
    { 
      skill: "Confidence", 
      score: aiScoreToScale(sessionData.confidenceScore), 
      fullMark: 10,
      available: sessionData.confidenceScore !== null,
      description: SKILL_DESCRIPTIONS.Confidence,
      rawValue: sessionData.confidenceScore !== null ? `${sessionData.confidenceScore}/100` : undefined
    },
    { 
      skill: "Comprehension", 
      score: aiScoreToScale(sessionData.comprehensionScore), 
      fullMark: 10,
      available: sessionData.comprehensionScore !== null,
      description: SKILL_DESCRIPTIONS.Comprehension,
      rawValue: sessionData.comprehensionScore !== null ? `${sessionData.comprehensionScore}/100` : undefined
    },
    { 
      skill: "Syntax", 
      score: aiScoreToScale(sessionData.syntaxScore), 
      fullMark: 10,
      available: sessionData.syntaxScore !== null,
      description: SKILL_DESCRIPTIONS.Syntax,
      rawValue: sessionData.syntaxScore !== null ? `${sessionData.syntaxScore}/100` : undefined
    },
    { 
      skill: "Conversation", 
      score: aiScoreToScale(sessionData.conversationScore), 
      fullMark: 10,
      available: sessionData.conversationScore !== null,
      description: SKILL_DESCRIPTIONS.Conversation,
      rawValue: sessionData.conversationScore !== null ? `${sessionData.conversationScore}/100` : undefined
    }
  ];

  const availableSkills = skillData.filter(s => s.available);
  const unavailableSkills = skillData.filter(s => !s.available);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="container mx-auto max-w-4xl space-y-8">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${showDevTools ? 'pt-10' : ''}`}>
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-2xl font-bold text-foreground">Your French Diagnostic</h1>
              <p className="text-muted-foreground">
                {isDemoMode ? (
                  <span className="flex items-center gap-2">
                    Demo Mode — Sample Results
                    <Badge variant="secondary" className="text-xs">Preview</Badge>
                  </span>
                ) : (
                  "Results from your assessment"
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-8 lg:col-span-2">
            {/* Spider/Radar Chart */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="font-serif text-xl">Skills Overview</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Your performance across 6 key language skills (1-10 scale)
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={skillData} cx="50%" cy="50%" outerRadius="80%">
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis 
                        dataKey="skill" 
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                      />
                      <PolarRadiusAxis 
                        angle={30} 
                        domain={[0, 10]} 
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        tickCount={6}
                      />
                      <Radar
                        name="Score"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: number, name: string, props: any) => {
                          const item = props.payload;
                          if (!item.available) return ["Not yet assessed", name];
                          return [value + "/10", name];
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Score Details */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="font-serif text-xl">Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Available Skills */}
                {availableSkills.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground">Assessed Skills</h3>
                    {availableSkills.map((skill) => (
                      <div key={skill.skill} className="p-4 rounded-lg bg-muted/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{skill.skill}</span>
                            {skill.rawValue && (
                              <span className="text-xs text-muted-foreground">
                                ({skill.rawValue})
                              </span>
                            )}
                          </div>
                          <Badge variant="default" className="text-lg font-bold">
                            {skill.score}/10
                          </Badge>
                        </div>
                        {skill.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {skill.description}
                          </p>
                        )}
                        {/* Confidence honesty flag note */}
                        {skill.skill === 'Confidence' && sessionData.confidenceHonestyFlag && (
                          <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              You want to be more spontaneous, but under pressure you still avoid speaking sometimes — totally normal.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Unavailable Skills */}
                {unavailableSkills.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Coming Soon</h3>
                    {unavailableSkills.map((skill) => (
                      <div key={skill.skill} className="p-4 rounded-lg bg-muted/10 opacity-50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">{skill.skill}</span>
                          <Badge variant="outline">—</Badge>
                        </div>
                        {skill.description && (
                          <p className="text-xs text-muted-foreground/70 leading-relaxed">
                            {skill.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* No data warning */}
                {availableSkills.length === 0 && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <div>
                      <p className="font-medium">No assessment data found</p>
                      <p className="text-sm opacity-80">
                        Complete the fluency and pronunciation modules to see your results.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Understanding Your Results */}
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  <CardTitle className="font-serif text-xl">Understanding Your Results</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  Your French diagnostic measures 6 key language skills on a scale of 1-10. 
                  Each skill is assessed through specific exercises designed to evaluate different 
                  aspects of your French proficiency.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 rounded-lg bg-muted/20">
                    <div className="font-medium text-foreground mb-1">1-3: Beginner</div>
                    <p className="text-xs">Foundation skills, needs significant practice</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20">
                    <div className="font-medium text-foreground mb-1">4-5: Elementary</div>
                    <p className="text-xs">Basic competency, room for improvement</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20">
                    <div className="font-medium text-foreground mb-1">6-7: Intermediate</div>
                    <p className="text-xs">Good working knowledge, can handle most situations</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20">
                    <div className="font-medium text-foreground mb-1">8-10: Advanced</div>
                    <p className="text-xs">Strong proficiency, near-native competency</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Archetype Card */}
            {sessionData.archetype && (
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <div className="flex items-center gap-2 text-primary">
                    <Target className="h-5 w-5" />
                    <span className="font-mono text-xs uppercase tracking-wider">Your Archetype</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <h3 className="font-serif text-xl font-bold text-foreground capitalize">
                    {sessionData.archetype.replace(/_/g, " ")}
                  </h3>
                </CardContent>
              </Card>
            )}

            {/* Raw Data Debug */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                  Raw Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session ID</span>
                  <span className="text-foreground truncate max-w-[150px]">
                    {sessionId || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg WPM</span>
                  <span className="text-foreground">
                    {sessionData.fluencyWpm ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pronunciation</span>
                  <span className="text-foreground">
                    {sessionData.pronunciationScore !== null 
                      ? `${sessionData.pronunciationScore}%` 
                      : "—"
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confidence</span>
                  <span className="text-foreground">
                    {sessionData.confidenceScore !== null 
                      ? `${sessionData.confidenceScore}/100` 
                      : "—"
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Syntax</span>
                  <span className="text-foreground">
                    {sessionData.syntaxScore !== null 
                      ? `${sessionData.syntaxScore}/100` 
                      : "—"
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conversation</span>
                  <span className="text-foreground">
                    {sessionData.conversationScore !== null 
                      ? `${sessionData.conversationScore}/100` 
                      : "—"
                    }
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg font-serif text-foreground">What's Next?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full group" disabled>
                  View Full Report
                  <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Full report available after all modules complete
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Dev notice */}
      <div className="fixed bottom-4 left-4">
        <Badge variant="outline" className="bg-card text-xs">
          MVP Results - {availableSkills.length}/6 skills assessed
        </Badge>
      </div>
    </div>
  );
};

export default Results;
