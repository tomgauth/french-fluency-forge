/**
 * Voice Controller
 * Handles recording, transcription, and TTS playback for unified exam
 */

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { RecordingState } from './types';

interface VoiceControllerProps {
  onUserTurn: (transcript: string) => void;
  onBotTurn: (text: string) => Promise<void>;
  disabled?: boolean;
}

export function useVoiceController({ onUserTurn, onBotTurn, disabled }: VoiceControllerProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [currentBotAudio, setCurrentBotAudio] = useState<HTMLAudioElement | null>(null);
  
  // ============================================================================
  // Recording Control
  // ============================================================================
  
  const startRecording = async () => {
    if (disabled || recordingState !== 'idle') return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      // Start visualizing
      visualizeAudio();
      
      // Set up recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Transcribe
        await transcribeAudio(audioBlob);
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecordingState('recording');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone');
      setRecordingState('error');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingState('processing');
      setAudioLevel(0);
    }
  };
  
  const toggleRecording = () => {
    if (recordingState === 'idle') {
      startRecording();
    } else if (recordingState === 'recording') {
      stopRecording();
    }
  };
  
  // ============================================================================
  // Audio Visualization
  // ============================================================================
  
  const visualizeAudio = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateLevel = () => {
      if (recordingState !== 'recording' || !analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(Math.min(100, average));
      
      requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  };
  
  // ============================================================================
  // Transcription
  // ============================================================================
  
  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(audioBlob);
      const audioBase64 = await base64Promise;
      
      // Call conversation-agent for transcription
      const { data, error } = await supabase.functions.invoke('conversation-agent', {
        body: {
          action: 'transcribe',
          audioBase64,
        },
      });
      
      if (error) throw error;
      
      if (data?.transcript) {
        setRecordingState('idle');
        onUserTurn(data.transcript);
      } else {
        throw new Error('No transcript returned');
      }
      
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Could not transcribe audio. Please try again.');
      setRecordingState('error');
      
      // Return to idle after error
      setTimeout(() => setRecordingState('idle'), 2000);
    }
  };
  
  // ============================================================================
  // ElevenLabs TTS Playback
  // ============================================================================
  
  const speakText = async (text: string): Promise<void> => {
    setRecordingState('bot_speaking');
    
    try {
      // Call ElevenLabs TTS
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text,
          voice: 'french_voice', // ElevenLabs voice ID
        },
      });
      
      if (error) throw error;
      
      if (data?.audioUrl) {
        // Play audio
        const audio = new Audio(data.audioUrl);
        setCurrentBotAudio(audio);
        
        return new Promise((resolve, reject) => {
          audio.onended = () => {
            setRecordingState('idle');
            setCurrentBotAudio(null);
            resolve();
          };
          
          audio.onerror = (e) => {
            console.error('Audio playback error:', e);
            setRecordingState('idle');
            reject(e);
          };
          
          audio.play();
        });
      }
      
      // Fallback: No audio, just wait
      await new Promise(resolve => setTimeout(resolve, text.length * 50)); // ~50ms per char
      setRecordingState('idle');
      
    } catch (error) {
      console.error('TTS error:', error);
      toast.error('Could not play audio response');
      setRecordingState('idle');
    }
  };
  
  // ============================================================================
  // Cleanup
  // ============================================================================
  
  useEffect(() => {
    return () => {
      // Stop any ongoing recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      // Stop any playing audio
      if (currentBotAudio) {
        currentBotAudio.pause();
        currentBotAudio.currentTime = 0;
      }
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  // ============================================================================
  // Return API
  // ============================================================================
  
  return {
    recordingState,
    audioLevel,
    startRecording,
    stopRecording,
    toggleRecording,
    speakText,
    isRecording: recordingState === 'recording',
    isBotSpeaking: recordingState === 'bot_speaking',
    isProcessing: recordingState === 'processing',
    canRecord: recordingState === 'idle' && !disabled,
  };
}

// ============================================================================
// Visual Waveform Component
// ============================================================================

interface WaveformVisualizerProps {
  audioLevel: number;
  isActive: boolean;
}

export function WaveformVisualizer({ audioLevel, isActive }: WaveformVisualizerProps) {
  const bars = Array.from({ length: 20 }, (_, i) => i);
  
  return (
    <div className="flex items-center justify-center gap-1 h-16">
      {bars.map((i) => {
        const height = isActive 
          ? Math.max(8, (audioLevel / 100) * 64 * (0.5 + Math.random() * 0.5))
          : 8;
        
        return (
          <div
            key={i}
            className="w-1 bg-primary rounded-full transition-all duration-100"
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
}

