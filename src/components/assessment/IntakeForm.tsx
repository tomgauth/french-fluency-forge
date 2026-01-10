import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import SkipButton from "./SkipButton";

type GenderType = Database["public"]["Enums"]["gender_type"];
type AgeBandType = Database["public"]["Enums"]["age_band_type"];
type TrackType = Database["public"]["Enums"]["track_type"];

const GENDER_OPTIONS: { value: GenderType; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not", label: "Prefer not to say" },
];

const AGE_BAND_OPTIONS: { value: AgeBandType; label: string }[] = [
  { value: "18_24", label: "18-24" },
  { value: "25_34", label: "25-34" },
  { value: "35_44", label: "35-44" },
  { value: "45_54", label: "45-54" },
  { value: "55_64", label: "55-64" },
  { value: "65_plus", label: "65+" },
];

const LANGUAGE_OPTIONS = [
  "English",
  "Spanish",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Arabic",
  "Mandarin",
  "Other",
];

const TRACK_OPTIONS: { value: TrackType; label: string; description: string }[] = [
  { 
    value: "small_talk", 
    label: "Small Talk", 
    description: "Casual conversations with neighbors, at the bakery, or in the elevator" 
  },
  { 
    value: "transactions", 
    label: "Transactions", 
    description: "Handling admin, appointments, and getting things done in French" 
  },
  { 
    value: "bilingual_friends", 
    label: "Bilingual Friends", 
    description: "Speaking French with friends who also speak English" 
  },
  { 
    value: "work", 
    label: "Work", 
    description: "Professional French for meetings, emails, and colleagues" 
  },
  { 
    value: "home", 
    label: "Home", 
    description: "French with partner, kids, or around the household" 
  },
  { 
    value: "in_laws", 
    label: "In-Laws", 
    description: "Navigating family gatherings and French-speaking relatives" 
  },
];

interface IntakeFormProps {
  sessionId: string;
  onComplete: () => void;
  onSkip?: () => void;
}

const IntakeForm = ({ sessionId, onComplete, onSkip }: IntakeFormProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [gender, setGender] = useState<GenderType | "">("");
  const [ageBand, setAgeBand] = useState<AgeBandType | "">("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [goals, setGoals] = useState("");
  const [primaryTrack, setPrimaryTrack] = useState<TrackType | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleLanguage = (lang: string) => {
    setLanguages(prev => 
      prev.includes(lang) 
        ? prev.filter(l => l !== lang)
        : [...prev, lang]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gender || !ageBand || !primaryTrack) {
      toast.error("Please complete all required fields");
      return;
    }

    if (languages.length === 0) {
      toast.error("Please select at least one language you speak");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("assessment_sessions")
        .update({
          gender: gender as GenderType,
          age_band: ageBand as AgeBandType,
          languages_spoken: languages,
          goals: goals.trim() || null,
          primary_track: primaryTrack as TrackType,
          status: "consent",
        })
        .eq("id", sessionId);

      if (error) throw error;

      onComplete();
    } catch (error) {
      console.error("Error saving intake:", error);
      toast.error("Failed to save your information. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Let&apos;s Get Started</h1>
          <p className="text-muted-foreground">
            Tell us a bit about yourself so we can personalize your assessment
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Gender */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How do you identify?</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={gender}
                onValueChange={(value) => setGender(value as GenderType)}
                className="grid grid-cols-2 gap-4"
              >
                {GENDER_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={`gender-${option.value}`} />
                    <Label htmlFor={`gender-${option.value}`} className="cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Age Band */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What&apos;s your age range?</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={ageBand}
                onValueChange={(value) => setAgeBand(value as AgeBandType)}
                className="grid grid-cols-3 gap-4"
              >
                {AGE_BAND_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={`age-${option.value}`} />
                    <Label htmlFor={`age-${option.value}`} className="cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Languages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What languages do you speak?</CardTitle>
              <CardDescription>Select all that apply (besides French)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <div key={lang} className="flex items-center space-x-2">
                    <Checkbox
                      id={`lang-${lang}`}
                      checked={languages.includes(lang)}
                      onCheckedChange={() => toggleLanguage(lang)}
                    />
                    <Label htmlFor={`lang-${lang}`} className="cursor-pointer">
                      {lang}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Primary Track */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Where do you most want to improve?</CardTitle>
              <CardDescription>
                Choose the context that matters most to you right now
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={primaryTrack}
                onValueChange={(value) => setPrimaryTrack(value as TrackType)}
                className="space-y-3"
              >
                {TRACK_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    htmlFor={`track-${option.value}`}
                    className={`flex items-start space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                      primaryTrack === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value={option.value} id={`track-${option.value}`} className="mt-1" />
                    <div>
                      <span className="font-medium">
                        {option.label}
                      </span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Goals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What are your French goals?</CardTitle>
              <CardDescription>Optional: Tell us what you&apos;re working towards</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="E.g., I want to feel confident ordering at restaurants, or I need to present at work in French..."
                className="min-h-[100px]"
                maxLength={500}
              />
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Continue to Consent"}
          </Button>
        </form>

        {onSkip && <SkipButton onClick={onSkip} />}
      </div>
    </div>
  );
};

export default IntakeForm;
