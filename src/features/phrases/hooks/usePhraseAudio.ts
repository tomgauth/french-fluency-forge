/**
 * usePhraseAudio Hook
 * Manages audio playback for phrases with loading, error, and caching
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { generatePhraseAudio, getAudioUrl, revokeAudioUrl } from '../utils/audioGeneration';
import { getAudioPublicUrl, audioExists } from '../services/audioStorage';

export interface UsePhraseAudioOptions {
  phraseId: string;
  text: string; // French text to generate audio from
  audioUrl?: string; // Pre-existing audio URL (from database)
  autoPlay?: boolean;
}

export interface UsePhraseAudioReturn {
  audioUrl: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  duration: number | null;
  play: () => Promise<void>;
  pause: () => void;
  replay: () => Promise<void>;
  load: () => Promise<void>;
}

export function usePhraseAudio({
  phraseId,
  text,
  audioUrl: providedAudioUrl,
  autoPlay = false,
}: UsePhraseAudioOptions): UsePhraseAudioReturn {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        revokeAudioUrl(objectUrlRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Load audio
  const load = useCallback(async () => {
    if (audioRef.current) return; // Already loaded
    if (!text && !providedAudioUrl) {
      setError('No text or audio URL provided');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      let url: string;
      let blob: Blob | null = null;

      // Try provided URL first (skip mock URLs that don't exist)
      if (providedAudioUrl && !providedAudioUrl.startsWith('/mock/')) {
        url = providedAudioUrl;
      } else if (text) {
        // Check if audio exists in storage
        const exists = await audioExists(phraseId);
        if (exists) {
          url = getAudioPublicUrl(phraseId);
        } else {
          // Generate on-demand
          blob = await generatePhraseAudio(text);
          url = getAudioUrl(blob);
          objectUrlRef.current = url;
        }
      } else {
        throw new Error('No audio source available');
      }

      // Create audio element
      const audio = new Audio(url);
      
      // Handle iOS Safari restrictions
      audio.preload = 'auto';
      
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
        setIsLoading(false);
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        setError('Failed to load audio');
        setIsLoading(false);
      });

      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
      audio.addEventListener('ended', () => setIsPlaying(false));

      audioRef.current = audio;

      if (autoPlay) {
        // iOS Safari requires user gesture for autoplay
        try {
          await audio.play();
        } catch (err) {
          console.warn('Autoplay blocked:', err);
          setError('Please click play to start audio');
        }
      }
    } catch (err) {
      console.error('Error loading audio:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audio');
      setIsLoading(false);
    }
  }, [phraseId, text, providedAudioUrl, autoPlay]);

  // Play audio
  const play = useCallback(async () => {
    if (!audioRef.current) {
      await load();
    }

    if (audioRef.current) {
      try {
        await audioRef.current.play();
      } catch (err) {
        console.error('Error playing audio:', err);
        setError('Failed to play audio. Please try again.');
      }
    }
  }, [load]);

  // Pause audio
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  // Replay audio
  const replay = useCallback(async () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      await play();
    } else {
      await load();
      await play();
    }
  }, [load, play]);

  // Auto-load if URL is provided
  useEffect(() => {
    if (providedAudioUrl && !audioRef.current) {
      load();
    }
  }, [providedAudioUrl, load]);

  return {
    audioUrl,
    isPlaying,
    isLoading,
    error,
    duration,
    play,
    pause,
    replay,
    load,
  };
}

