import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Archetype, AxisKey, Badge, getEarnedBadges } from "./quizConfig";
import { Share2, Download, Instagram, Facebook, MessageCircle, Link, Mic, MessageSquare, CheckCircle, AlertTriangle, Plus, Image, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { FeedbackDialog } from "./FeedbackDialog";
import { ExportDialog } from "./export";

interface AxisResult {
  raw: number;
  normalized: number;
  label: string;
}

interface Props {
  archetype: Archetype;
  axes: {
    control_flow: AxisResult;
    accuracy_expressiveness: AxisResult;
    security_risk: AxisResult;
  };
  consistencyGap?: number;
  sessionId?: string | null;
  onContinue: () => void;
}

const axisLabels: Record<AxisKey, [string, string]> = {
  control_flow: ['Control', 'Flow'],
  accuracy_expressiveness: ['Accuracy', 'Expressiveness'],
  security_risk: ['Security', 'Risk'],
};

// Color pairs: [leftColor, rightColor] - darker when dominant, lighter when not
const axisColors: Record<AxisKey, { left: [string, string]; right: [string, string] }> = {
  // Control = Slate/Steel Blue, Flow = Teal/Cyan
  control_flow: {
    left: ['#475569', '#94a3b8'],   // Slate: dark, light
    right: ['#0d9488', '#5eead4'],  // Teal: dark, light
  },
  // Accuracy = Indigo/Deep Blue, Expressiveness = Amber/Orange
  accuracy_expressiveness: {
    left: ['#4338ca', '#a5b4fc'],   // Indigo: dark, light
    right: ['#d97706', '#fcd34d'],  // Amber: dark, light
  },
  // Security = Emerald/Green, Risk = Rose/Red-Pink
  security_risk: {
    left: ['#059669', '#6ee7b7'],   // Emerald: dark, light
    right: ['#e11d48', '#fda4af'],  // Rose: dark, light
  },
};

function AxisBar({ axisKey, result }: { axisKey: AxisKey; result: AxisResult }) {
  const [leftLabel, rightLabel] = axisLabels[axisKey];
  const colors = axisColors[axisKey];
  // Clamp position between 8% and 92% for visual buffer
  const clampedPosition = Math.max(8, Math.min(92, result.normalized));
  
  // Determine which side is dominant (darker)
  const leaningLeft = result.normalized < 50;
  const leftColor = leaningLeft ? colors.left[0] : colors.left[1];
  const rightColor = leaningLeft ? colors.right[1] : colors.right[0];
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-medium">
        <span style={{ color: leftColor, fontWeight: leaningLeft ? 600 : 400 }}>
          {leftLabel}
        </span>
        <span style={{ color: rightColor, fontWeight: !leaningLeft ? 600 : 400 }}>
          {rightLabel}
        </span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden">
        {/* Left side - from start to marker */}
        <div 
          className="absolute inset-y-0 left-0 rounded-l-full"
          style={{ 
            width: `${clampedPosition}%`,
            backgroundColor: leftColor,
          }}
        />
        {/* Right side - from marker to end */}
        <div 
          className="absolute inset-y-0 right-0 rounded-r-full"
          style={{ 
            width: `${100 - clampedPosition}%`,
            backgroundColor: rightColor,
          }}
        />
        {/* Position marker */}
        <motion.div
          initial={{ left: '50%' }}
          animate={{ left: `${clampedPosition}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-background rounded-full border-2 border-foreground/20 shadow-lg z-10"
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">{result.label}</p>
    </div>
  );
}

function BadgeCard({ badge }: { badge: Badge }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20"
    >
      <span className="text-2xl">{badge.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{badge.name}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{badge.description}</p>
      </div>
    </motion.div>
  );
}

export function PersonalityResult({ archetype, axes, consistencyGap, sessionId, onContinue }: Props) {
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [hasShownAutoPopup, setHasShownAutoPopup] = useState(false);

  // Get earned badges based on normalized axis scores
  const earnedBadges = getEarnedBadges({
    control_flow: axes.control_flow.normalized,
    accuracy_expressiveness: axes.accuracy_expressiveness.normalized,
    security_risk: axes.security_risk.normalized,
  });

  // Auto-show feedback popup after 20 seconds
  useEffect(() => {
    if (hasShownAutoPopup) return;
    
    const timer = setTimeout(() => {
      setFeedbackDialogOpen(true);
      setHasShownAutoPopup(true);
    }, 20000);

    return () => clearTimeout(timer);
  }, [hasShownAutoPopup]);

  const showEncouragement = archetype.encouragement && 
    (axes.control_flow.normalized < 40 || axes.accuracy_expressiveness.normalized < 40 || axes.security_risk.normalized < 40);
  
  const showConsistencyNote = consistencyGap && consistencyGap > 0.3;

  const shareText = `I just discovered I'm "${archetype.name}" ${archetype.emoji} in my French learning journey! Take the personality test to find yours:`;
  const shareUrl = typeof window !== 'undefined' ? window.location.origin + '/assessment' : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    toast.success("Link copied to clipboard!");
  };

  const handleShareInstagram = () => {
    navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
    toast.success("Text copied! Paste it in your Instagram story or post.");
  };

  const handleShareFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(fbUrl, '_blank', 'width=600,height=400');
  };

  const handleShareWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
    window.open(waUrl, '_blank');
  };

  const handleExportPDF = () => {
    const content = `
My French Learning Personality
==============================

${archetype.emoji} ${archetype.name}
${archetype.signature}

YOUR 3-AXIS PROFILE
-------------------
• Control ↔ Flow: ${axes.control_flow.label} (${Math.round(axes.control_flow.normalized)}%)
• Accuracy ↔ Expressiveness: ${axes.accuracy_expressiveness.label} (${Math.round(axes.accuracy_expressiveness.normalized)}%)
• Security ↔ Risk: ${axes.security_risk.label} (${Math.round(axes.security_risk.normalized)}%)

${earnedBadges.length > 0 ? `BADGES EARNED\n-------------\n${earnedBadges.map(b => `${b.icon} ${b.name}: ${b.description}`).join('\n')}\n` : ''}

ABOUT YOU
---------
${archetype.description}

✨ YOUR STRENGTHS
${archetype.strengths}

🔍 HIDDEN BOTTLENECK
${archetype.bottleneck}

🚀 FASTEST PATH
${archetype.fastestPath}

⚠️ DANGER PATH
${archetype.dangerPath}

RECOMMENDATIONS
---------------
✅ Keep doing:
${archetype.recommendations.keep.map(k => `• ${k}`).join('\n')}

➕ Add next:
${archetype.recommendations.add.map(a => `• ${a}`).join('\n')}

⚠️ Watch out for:
${archetype.recommendations.watchOut}

${archetype.encouragement ? `💡 ${archetype.encouragement}` : ''}

---
Take the test: ${shareUrl}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${archetype.name.replace(/\s+/g, '-').toLowerCase()}-personality.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Your results have been downloaded!");
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="text-6xl mb-4"
            >
              {archetype.emoji}
            </motion.div>
            <h1 className="text-2xl font-bold mb-2">Your Learning Personality</h1>
            <h2 className="text-xl text-primary font-semibold">{archetype.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{archetype.signature}</p>
          </div>

          {/* Earned Badges */}
          {earnedBadges.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-3"
            >
              <h3 className="font-semibold text-center text-sm text-muted-foreground uppercase tracking-wide">
                Badges Earned
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {earnedBadges.map((badge, i) => (
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                  >
                    <BadgeCard badge={badge} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Axis Bars */}
          <div className="p-6 rounded-2xl border border-border bg-card space-y-6">
            <h3 className="font-semibold text-center mb-4">Your 3-Axis Profile</h3>
            <AxisBar axisKey="control_flow" result={axes.control_flow} />
            <AxisBar axisKey="accuracy_expressiveness" result={axes.accuracy_expressiveness} />
            <AxisBar axisKey="security_risk" result={axes.security_risk} />
          </div>

          {/* Long Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="p-6 rounded-2xl border border-border bg-card"
          >
            <h3 className="font-semibold mb-5">About You</h3>
            <div className="space-y-4">
              {archetype.description.split('. ').reduce((acc: string[][], sentence, i, arr) => {
                // Group sentences into paragraphs of 2-3 sentences
                const lastGroup = acc[acc.length - 1];
                if (!lastGroup || lastGroup.length >= 2) {
                  acc.push([sentence + (i < arr.length - 1 ? '.' : '')]);
                } else {
                  lastGroup.push(sentence + (i < arr.length - 1 ? '.' : ''));
                }
                return acc;
              }, []).map((sentences, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                  {sentences.join(' ')}
                </p>
              ))}
            </div>
          </motion.div>

          {/* Archetype Card - Strengths & Bottleneck */}
          <div className="grid gap-4 sm:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="p-4 rounded-xl bg-green-500/10 border border-green-500/20"
            >
              <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">✨ Your Strengths</h4>
              <p className="text-sm">{archetype.strengths}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
            >
              <h4 className="font-semibold text-amber-600 dark:text-amber-400 mb-2">🔍 Hidden Bottleneck</h4>
              <p className="text-sm">{archetype.bottleneck}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20"
            >
              <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">🚀 Fastest Path</h4>
              <p className="text-sm">{archetype.fastestPath}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="p-4 rounded-xl bg-red-500/10 border border-red-500/20"
            >
              <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">⚠️ Danger Path</h4>
              <p className="text-sm">{archetype.dangerPath}</p>
            </motion.div>
          </div>

          {/* Recommendations Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="p-6 rounded-2xl border border-border bg-card space-y-5"
          >
            <h3 className="font-semibold text-center">Your Personalized Recommendations</h3>
            
            {/* Keep Doing */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <h4 className="font-medium text-sm">Keep doing</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {archetype.recommendations.keep.map((item, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-green-500/10 text-green-700 dark:text-green-300 text-xs font-medium"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Add Next */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Plus className="h-4 w-4" />
                <h4 className="font-medium text-sm">Add next</h4>
              </div>
              <ul className="space-y-2">
                {archetype.recommendations.add.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Watch Out */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-medium text-sm text-amber-600 dark:text-amber-400">Watch out for</h4>
                  <p className="text-sm text-muted-foreground mt-1">{archetype.recommendations.watchOut}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Encouragement Note */}
          {showEncouragement && archetype.encouragement && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-center"
            >
              <p className="text-sm font-medium">{archetype.encouragement}</p>
            </motion.div>
          )}

          {/* Consistency Note */}
          {showConsistencyNote && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
              className="p-4 rounded-xl bg-muted text-center"
            >
              <p className="text-sm text-muted-foreground">
                You <em>want</em> to be more spontaneous, but under pressure you default to control. 
                That's normal — we'll train the bridge.
              </p>
            </motion.div>
          )}

          {/* Share & Export Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex flex-wrap justify-center gap-3"
          >
            <Button 
              variant="default" 
              size="lg" 
              className="gap-2" 
              onClick={() => setExportDialogOpen(true)}
            >
              <Image className="h-4 w-4" />
              Share to IG/FB
            </Button>

            <Button 
              variant="outline" 
              size="lg" 
              className="gap-2" 
              onClick={() => setExportDialogOpen(true)}
            >
              <FileText className="h-4 w-4" />
              Download PDF
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="lg" className="gap-2">
                  <Share2 className="h-4 w-4" />
                  Quick Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48 bg-popover">
                <DropdownMenuItem onClick={handleShareInstagram} className="gap-2 cursor-pointer">
                  <Instagram className="h-4 w-4" />
                  Instagram
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareFacebook} className="gap-2 cursor-pointer">
                  <Facebook className="h-4 w-4" />
                  Facebook
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareWhatsApp} className="gap-2 cursor-pointer">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
                  <Link className="h-4 w-4" />
                  Copy Link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              variant="ghost" 
              size="lg" 
              className="gap-2" 
              onClick={() => setFeedbackDialogOpen(true)}
            >
              <MessageSquare className="h-4 w-4" />
              Give Feedback
            </Button>
          </motion.div>

          {/* Export Dialog */}
          <ExportDialog
            open={exportDialogOpen}
            onOpenChange={setExportDialogOpen}
            data={{
              archetype,
              axes,
              badges: earnedBadges,
              shareUrl: shareUrl || 'https://yoursite.com/assessment',
            }}
          />

          {/* Feedback Dialog */}
          <FeedbackDialog
            open={feedbackDialogOpen}
            onOpenChange={setFeedbackDialogOpen}
            sessionId={sessionId ?? null}
            archetypeName={archetype.name}
            archetypeEmoji={archetype.emoji}
          />

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85 }}
            className="space-y-2"
          >
            <button
              onClick={onContinue}
              className="w-full py-4 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-lg shadow-lg shadow-primary/30 hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <Mic className="h-5 w-5" />
              Continue to Fluency Assessment
            </button>
            <p className="text-center text-sm text-muted-foreground">
              Takes ~10 minutes • Microphone needed
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
