import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Headphones, 
  ArrowRight, 
  Play, 
  Volume2, 
  Check,
  Loader2,
  RefreshCw,
  VolumeX
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getAssessmentItems, type ComprehensionItem } from './comprehensionItems';

interface ComprehensionModuleProps {
  sessionId: string;
  onComplete: () => void;
}

interface MultiSelectResult {
  score: number;
  feedbackFr: string;
  correctSelections: string[];
  missedSelections: string[];
  incorrectSelections: string[];
}

type ItemPhase = 'ready' | 'playing' | 'played' | 'answering' | 'processing' | 'complete';

export function ComprehensionModule({ sessionId, onComplete }: ComprehensionModuleProps) {
  const { user } = useAuth();
  const [showIntro, setShowIntro] = useState(true);
  const [items] = useState<ComprehensionItem[]>(getAssessmentItems());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemPhase, setItemPhase] = useState<ItemPhase>('ready');
  const [results, setResults] = useState<Record<string, MultiSelectResult>>({});
  const [audioPlayedAt, setAudioPlayedAt] = useState<Record<string, Date>>({});
  const [generatedAudio, setGeneratedAudio] = useState<Record<string, string>>({});
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, Set<string>>>({});
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentItem = items[currentIndex];
  const isLastItem = currentIndex === items.length - 1;

  // Initialize selected options for current item
  useEffect(() => {
    if (currentItem && !selectedOptions[currentItem.id]) {
      setSelectedOptions(prev => ({
        ...prev,
        [currentItem.id]: new Set<string>()
      }));
    }
  }, [currentItem, selectedOptions]);

  // Generate TTS audio for current item
  const generateAudio = useCallback(async () => {
    if (!currentItem || generatedAudio[currentItem.id]) return;
    
    setIsGeneratingAudio(true);
    try {
      const { data, error } = await supabase.functions.invoke('french-tts', {
        body: { 
          text: currentItem.transcript_fr,
          speed: 1.2,  // Slightly fast, natural pace
          stability: 0.35  // More natural variation
        }
      });
      
      if (error) throw error;
      
      // The response is binary audio data (ArrayBuffer or Blob)
      if (data) {
        let audioUrl: string;
        
        if (data instanceof Blob) {
          // Convert Blob to URL
          audioUrl = URL.createObjectURL(data);
        } else if (data instanceof ArrayBuffer) {
          // Convert ArrayBuffer to Blob then URL
          const blob = new Blob([data], { type: 'audio/mpeg' });
          audioUrl = URL.createObjectURL(blob);
        } else if (typeof data === 'object' && data.audioContent) {
          // Legacy format: base64 encoded
          audioUrl = `data:audio/mp3;base64,${data.audioContent}`;
        } else {
          throw new Error('Unexpected audio response format');
        }
        
        setGeneratedAudio(prev => ({ ...prev, [currentItem.id]: audioUrl }));
      } else {
        throw new Error('No audio data received');
      }
    } catch (err) {
      console.error('Error generating audio:', err);
      toast.error('Failed to generate audio');
    } finally {
      setIsGeneratingAudio(false);
    }
  }, [currentItem, generatedAudio]);

  // Pre-generate audio when item changes
  useEffect(() => {
    if (currentItem && !showIntro) {
      generateAudio();
    }
  }, [currentItem, showIntro, generateAudio]);

  const handlePlayAudio = () => {
    if (!currentItem) return;
    
    const audioUrl = generatedAudio[currentItem.id];
    if (!audioUrl) {
      toast.error('Audio not ready yet');
      return;
    }
    
    setItemPhase('playing');
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.onended = () => {
      setAudioPlayedAt(prev => ({ ...prev, [currentItem.id]: new Date() }));
      setItemPhase('answering');
    };
    
    audio.onerror = () => {
      toast.error('Failed to play audio');
      setItemPhase('ready');
    };
    
    audio.play();
  };

  const toggleOption = (optionId: string) => {
    if (!currentItem || itemPhase === 'processing' || itemPhase === 'complete') return;
    
    setSelectedOptions(prev => {
      const currentSet = prev[currentItem.id] || new Set<string>();
      const newSet = new Set(currentSet);
      
      if (newSet.has(optionId)) {
        newSet.delete(optionId);
      } else {
        newSet.add(optionId);
      }
      
      return {
        ...prev,
        [currentItem.id]: newSet
      };
    });
  };

  const handleSubmit = async () => {
    if (!currentItem || !user) return;
    
    const selected = Array.from(selectedOptions[currentItem.id] || []);
    if (selected.length === 0) {
      toast.error('Please select at least one option');
      return;
    }
    
    setItemPhase('processing');
    
    try {
      // Create recording entry
      const { data: recording, error: insertError } = await supabase
        .from('comprehension_recordings')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          item_id: currentItem.id,
          audio_played_at: audioPlayedAt[currentItem.id]?.toISOString(),
          status: 'pending'
        })
        .select('id')
        .single();
      
      if (insertError) throw insertError;
      
      // Analyze comprehension
      const { data, error } = await supabase.functions.invoke('analyze-comprehension', {
        body: {
          selectedOptionIds: selected,
          itemId: currentItem.id,
          recordingId: recording.id,
          itemConfig: {
            correct_option_ids: currentItem.answer_key.correct_option_ids,
            options: currentItem.options
          }
        }
      });
      
      if (error) throw error;
      
      setResults(prev => ({
        ...prev,
        [currentItem.id]: {
          score: data.score,
          feedbackFr: data.feedbackFr,
          correctSelections: data.correctSelections || [],
          missedSelections: data.missedSelections || [],
          incorrectSelections: data.incorrectSelections || []
        }
      }));
      
      setItemPhase('complete');
      
    } catch (err) {
      console.error('Error processing submission:', err);
      toast.error('Failed to process your answers');
      setItemPhase('played');
    }
  };

  const handleNext = () => {
    if (isLastItem) {
      // Lock module and complete
      supabase
        .from('assessment_sessions')
        .update({ 
          comprehension_locked: true, 
          comprehension_locked_at: new Date().toISOString() 
        })
        .eq('id', sessionId)
        .then(() => onComplete());
    } else {
      setCurrentIndex(prev => prev + 1);
      setItemPhase('ready');
    }
  };

  const handleRedo = () => {
    if (!currentItem) return;
    setSelectedOptions(prev => ({
      ...prev,
      [currentItem.id]: new Set<string>()
    }));
    setItemPhase('answering');
  };

  const getButtonVariant = (optionId: string): "default" | "secondary" | "outline" | "destructive" => {
    if (!currentItem) return "outline";
    
    const result = results[currentItem.id];
    const isSelected = selectedOptions[currentItem.id]?.has(optionId) || false;
    const isCorrect = currentItem.answer_key.correct_option_ids.includes(optionId);
    
    if (itemPhase === 'complete' && result) {
      // Show results
      if (isCorrect && isSelected) {
        return "default"; // Green/correct
      } else if (isCorrect && !isSelected) {
        return "outline"; // Missed (could add special styling)
      } else if (!isCorrect && isSelected) {
        return "destructive"; // Wrong selection
      }
      return "outline";
    }
    
    // During selection
    return isSelected ? "secondary" : "outline";
  };

  // Intro screen
  if (showIntro) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Headphones className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Listening Comprehension</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground">
              Listen to French audio passages and select all statements that are true. There may be more than one correct answer.
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">How it works:</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Click play to hear the French audio passage</li>
                <li>• Select all statements that are true based on what you heard</li>
                <li>• You can select multiple options</li>
                <li>• Click submit when you're ready</li>
              </ul>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <strong>Tip:</strong> Listen carefully - you can play the audio as many times as you need before submitting.
              </p>
            </div>

            <div className="text-center pt-4">
              <Button size="lg" onClick={() => setShowIntro(false)} className="gap-2">
                Start Listening Test
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentItem) {
    return <div>Loading...</div>;
  }

  const result = results[currentItem.id];
  const hasPlayed = !!audioPlayedAt[currentItem.id];
  const isAudioReady = !!generatedAudio[currentItem.id];
  const selectedCount = selectedOptions[currentItem.id]?.size || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Item {currentIndex + 1} of {items.length}</span>
        <Badge variant="outline" className="gap-1">
          <Headphones className="h-3 w-3" />
          {currentItem.cefr_level}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{currentItem.prompt.fr}</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">{currentItem.prompt.en}</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Audio section */}
          <div className="bg-muted/30 rounded-lg p-6 text-center space-y-4">
            {itemPhase === 'ready' && (
              <>
                {isGeneratingAudio ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Preparing audio...</span>
                  </div>
                ) : !isAudioReady ? (
                  <Button onClick={generateAudio} variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Load Audio
                  </Button>
                ) : (
                  <Button 
                    size="lg" 
                    onClick={handlePlayAudio}
                    className="gap-2"
                  >
                    <Play className="h-5 w-5" />
                    Play Audio
                  </Button>
                )}
              </>
            )}
            
            {itemPhase === 'playing' && (
              <div className="flex items-center justify-center gap-3">
                <Volume2 className="h-6 w-6 text-primary animate-pulse" />
                <span className="text-lg">Playing audio...</span>
              </div>
            )}
            
            {(itemPhase === 'answering' || itemPhase === 'processing' || itemPhase === 'complete') && hasPlayed && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <VolumeX className="h-5 w-5" />
                <span className="text-sm">Audio played</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePlayAudio}
                  className="ml-2"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Replay
                </Button>
              </div>
            )}
          </div>

          {/* Multi-select options */}
          {(itemPhase === 'answering' || itemPhase === 'processing' || itemPhase === 'complete') && hasPlayed && (
            <div className="space-y-4">
              <div className="text-center text-sm text-muted-foreground">
                Select all statements that are true. You can select multiple options.
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {currentItem.options.map(option => (
                  <Button 
                    key={option.id}
                    variant={getButtonVariant(option.id)}
                    onClick={() => toggleOption(option.id)}
                    disabled={itemPhase === 'processing' || itemPhase === 'complete'}
                    className="h-auto min-h-[80px] py-3 px-4 text-sm whitespace-normal break-words"
                  >
                    {option.fr}
                  </Button>
                ))}
              </div>
              
              {itemPhase !== 'complete' && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedCount} option{selectedCount !== 1 ? 's' : ''} selected
                  </span>
                  <Button 
                    onClick={handleSubmit}
                    disabled={selectedCount === 0 || itemPhase === 'processing'}
                    className="gap-2"
                  >
                    {itemPhase === 'processing' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Submit
                        <Check className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Processing state */}
          {itemPhase === 'processing' && (
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Analyzing your answers...</span>
            </div>
          )}

          {/* Result */}
          {itemPhase === 'complete' && result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
                <span className="font-medium">Score</span>
                <Badge variant="default" className="text-lg px-3">
                  {Math.round(result.score)}/100
                </Badge>
              </div>
              
              <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                <div className="font-medium text-sm">Feedback:</div>
                <p className="text-muted-foreground">{result.feedbackFr}</p>
              </div>
              
              {/* Show which options were correct/incorrect */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {currentItem.options.map(option => {
                  const isCorrect = currentItem.answer_key.correct_option_ids.includes(option.id);
                  const wasSelected = selectedOptions[currentItem.id]?.has(option.id) || false;
                  const isCorrectlySelected = isCorrect && wasSelected;
                  const isMissed = isCorrect && !wasSelected;
                  const isIncorrectlySelected = !isCorrect && wasSelected;
                  
                  return (
                    <div
                      key={option.id}
                      className={`p-3 rounded-lg border-2 ${
                        isCorrectlySelected
                          ? 'bg-green-500/20 border-green-500'
                          : isMissed
                          ? 'bg-yellow-500/20 border-yellow-500'
                          : isIncorrectlySelected
                          ? 'bg-red-500/20 border-red-500'
                          : 'bg-muted/30 border-border'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isCorrectlySelected && <span className="text-green-600">✓</span>}
                        {isMissed && <span className="text-yellow-600">!</span>}
                        {isIncorrectlySelected && <span className="text-red-600">✗</span>}
                        <span className="text-sm">{option.fr}</span>
                      </div>
                    </div>
                  );
                })}
                </div>
              
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleRedo} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button onClick={handleNext} className="flex-1 gap-2">
                  {isLastItem ? (
                    <>
                      Complete
                      <Check className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Next Item
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
