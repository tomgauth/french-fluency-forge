import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bug, X, ChevronRight, ChevronDown, Mic, Brain, Volume2, Headphones, PanelRightOpen, PanelRightClose } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminMode } from "@/hooks/useAdminMode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Database } from "@/integrations/supabase/types";

type SessionStatus = Database["public"]["Enums"]["session_status"];
type AssessmentPhase = "pronunciation" | "comprehension" | "confidence" | "conversation";

const mainRoutes = [
  { path: "/", label: "Home" },
  { path: "/login", label: "Login" },
  { path: "/signup", label: "Signup" },
  { path: "/activate", label: "Activate" },
  { path: "/results", label: "Results" },
  { path: "/admin/systemeio-products", label: "Admin Products" },
  { path: "/dev", label: "Dev Preview" },
  { path: "/dev/pronunciation-test", label: "🧪 Pronunciation QA" },
];

const assessmentPhases: { status: SessionStatus; label: string }[] = [
  { status: "intake", label: "Intake Form" },
  { status: "consent", label: "Consent Form" },
  { status: "quiz", label: "Personality Quiz" },
  { status: "mic_check", label: "Mic Check" },
  { status: "assessment", label: "Assessment" },
  { status: "processing", label: "Processing" },
];

// 4 Dimensions with their sub-tests
const dimensions: {
  id: AssessmentPhase;
  label: string;
  icon: React.ReactNode;
  subtests: { id: string; label: string }[];
}[] = [
  {
    id: "pronunciation",
    label: "Pronunciation",
    icon: <Mic className="h-4 w-4" />,
    subtests: [
      { id: "reading", label: "Reading Aloud (3 items)" },
      { id: "pronR-1", label: "  → /y/ vs /u/" },
      { id: "pronR-2", label: "  → Nasal vowels" },
      { id: "pronR-3", label: "  → /s/ vs /z/" },
      { id: "repeat", label: "Listen & Repeat (2 items)" },
      { id: "pronE-1", label: "  → Position words" },
      { id: "pronE-2", label: "  → Liaisons" },
      { id: "minimalPairs", label: "Minimal Pairs Game (6 items)" },
    ],
  },
  {
    id: "confidence",
    label: "Confidence",
    icon: <Brain className="h-4 w-4" />,
    subtests: [
      { id: "sliders", label: "Slider Questions (3)" },
      { id: "likert", label: "Likert Questions (3)" },
      { id: "scenarios", label: "Scenario Questions (2)" },
      { id: "tradeoffs", label: "Tradeoff Questions (2)" },
    ],
  },
  {
    id: "conversation",
    label: "Speech Test",
    icon: <Volume2 className="h-4 w-4" />,
    subtests: [
      { id: "prompt", label: "Open-ended prompt (20s–2m)" },
      { id: "fluency", label: "Fluency (WPM)" },
      { id: "syntax", label: "Syntax scoring" },
      { id: "conversation", label: "Conversation patterns" },
    ],
  },
  {
    id: "comprehension",
    label: "Comprehension",
    icon: <Headphones className="h-4 w-4" />,
    subtests: [
      { id: "L1", label: "L1: Boulangerie" },
      { id: "L2", label: "L2: Running late" },
      { id: "L3", label: "L3: Restaurant booking" },
      { id: "L4", label: "L4: Bus" },
      { id: "L5", label: "L5: Doctor" },
      { id: "L6", label: "L6: Travel" },
    ],
  },
];

export function DevNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assessmentExpanded, setAssessmentExpanded] = useState(false);
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isDev } = useAdminMode();

  // Determine visibility (calculated after all hooks)
  const shouldShow = isDev || isAdmin;

  const jumpToPhase = async (status: SessionStatus) => {
    if (!user) {
      toast.error("Login first to access assessment phases");
      return;
    }

    try {
      const { data: existingSession } = await supabase
        .from("assessment_sessions")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        await supabase
          .from("assessment_sessions")
          .update({ status })
          .eq("id", existingSession.id);
      } else {
        await supabase
          .from("assessment_sessions")
          .insert({ user_id: user.id, status });
      }

      toast.success(`Jumping to ${status}`);
      
      if (location.pathname === "/assessment") {
        window.location.reload();
      } else {
        window.location.href = "/assessment";
      }
    } catch (error) {
      console.error("Error jumping to phase:", error);
      toast.error("Failed to jump to phase");
    }
  };

  const jumpToAssessmentPhase = async (phase: AssessmentPhase) => {
    if (!user) {
      toast.error("Login first");
      return;
    }

    // Store the desired phase in sessionStorage so Assessment.tsx can read it
    sessionStorage.setItem("dev_assessment_phase", phase);
    
    // Ensure we're in assessment status
    const { data: existingSession } = await supabase
      .from("assessment_sessions")
      .select("id, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSession) {
      if (existingSession.status !== "assessment") {
        await supabase
          .from("assessment_sessions")
          .update({ status: "assessment" })
          .eq("id", existingSession.id);
      }
    } else {
      await supabase
        .from("assessment_sessions")
        .insert({ user_id: user.id, status: "assessment" });
    }

    toast.success(`Jumping to ${phase}`);
    
    if (location.pathname === "/assessment") {
      window.location.reload();
    } else {
      navigate("/assessment");
    }
  };

  const toggleDimension = (id: string) => {
    setExpandedDimensions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Hide if not admin/dev
  if (!shouldShow) return null;

  return (
    <>
      {/* Floating Bug Button */}
      <div className="fixed bottom-4 right-4 z-[9999]">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-14 right-0 bg-popover border border-border rounded-lg shadow-xl p-2 min-w-[220px] max-h-[70vh] overflow-y-auto"
            >
              {/* Toggle Sidebar */}
              <button
                onClick={() => {
                  setSidebarOpen(!sidebarOpen);
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full hover:bg-muted mb-1 text-amber-500 font-medium"
              >
                {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                {sidebarOpen ? "Hide Sidebar" : "Show Dimension Sidebar"}
              </button>

              <div className="border-t border-border my-1" />

              {/* Main Routes */}
              {mainRoutes.map((route) => (
                <Link
                  key={route.path}
                  to={route.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    location.pathname === route.path
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <ChevronRight className="h-3 w-3" />
                  {route.label}
                </Link>
              ))}

              {/* Assessment Accordion */}
              <div className="border-t border-border mt-2 pt-2">
                <button
                  onClick={() => setAssessmentExpanded(!assessmentExpanded)}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm transition-colors ${
                    location.pathname === "/assessment"
                      ? "bg-primary/20 text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <ChevronRight className="h-3 w-3" />
                    Assessment Flow
                  </span>
                  <ChevronDown 
                    className={`h-3 w-3 transition-transform ${assessmentExpanded ? "rotate-180" : ""}`} 
                  />
                </button>

                <AnimatePresence>
                  {assessmentExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-4 space-y-1 mt-1">
                        {assessmentPhases.map((phase) => (
                          <button
                            key={phase.status}
                            onClick={() => {
                              jumpToPhase(phase.status);
                              setIsOpen(false);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs w-full text-left hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {phase.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="h-12 w-12 rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-colors flex items-center justify-center"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Bug className="h-5 w-5" />}
        </button>
      </div>

      {/* Right Sidebar - Dimensions */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed right-0 top-0 h-screen w-72 bg-card border-l border-border shadow-xl z-[9998] flex flex-col"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-lg">Assessment Dimensions</h2>
              <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 p-2">
              <div className="space-y-1">
                {dimensions.map((dim) => (
                  <div key={dim.id} className="rounded-lg overflow-hidden">
                    {/* Dimension Header */}
                    <div className="flex items-center">
                      <button
                        onClick={() => jumpToAssessmentPhase(dim.id)}
                        className="flex-1 flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-primary/10 transition-colors text-left"
                      >
                        {dim.icon}
                        {dim.label}
                      </button>
                      <button
                        onClick={() => toggleDimension(dim.id)}
                        className="p-2 hover:bg-muted rounded"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            expandedDimensions.has(dim.id) ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </div>

                    {/* Sub-tests */}
                    <AnimatePresence>
                      {expandedDimensions.has(dim.id) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pl-6 pb-2 space-y-0.5">
                            {dim.subtests.map((sub) => (
                              <div
                                key={sub.id}
                                className="text-xs text-muted-foreground py-1 px-2 rounded hover:bg-muted/50 cursor-default"
                              >
                                {sub.label}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>

              {/* Quick Jump Section */}
              <div className="border-t border-border mt-4 pt-4">
                <p className="text-xs font-medium text-muted-foreground px-3 mb-2">QUICK JUMP</p>
                <div className="grid grid-cols-2 gap-1 px-2">
                  {dimensions.map((dim) => (
                    <Button
                      key={dim.id}
                      variant="outline"
                      size="sm"
                      onClick={() => jumpToAssessmentPhase(dim.id)}
                      className="text-xs h-8"
                    >
                      {dim.icon}
                      <span className="ml-1 truncate">{dim.label.slice(0, 6)}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </ScrollArea>

            <div className="p-3 border-t border-border bg-muted/50 text-[10px] text-muted-foreground">
              Dev mode only • Click dimension to jump
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
