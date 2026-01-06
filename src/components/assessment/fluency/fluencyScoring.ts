// Fluency Scoring (v2 - Enhanced with Calibration Console support)
// Goal: speed + control of long pauses. False starts & repetitions are NOT penalized.

import { FRENCH_FILLERS } from './fluencyFillers';

/** Word timestamp from Whisper verbose_json */
export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

/** Detected pause */
export interface PauseInfo {
  start: number;
  duration: number;
  end: number;
}

/** Enhanced fluency metrics with all intermediate values for debugging */
export interface FluencyMetrics {
  // Word counts
  wordCount: number;              // Excludes fillers
  word_count_non_filler: number;  // Alias for consistency
  totalWordCount: number;         // Including fillers
  fillerCount: number;
  fillerRatio: number;            // fillers / total_words (tracked only)
  
  // Time measurements
  speakingTime: number;           // Seconds between first and last non-filler word
  speaking_time_sec: number;      // Alias for consistency
  totalDuration?: number;         // Total recording time (if available)
  
  // WPM calculations
  articulationWpm: number;        // word_count / (speaking_time/60)
  articulation_wpm: number;       // Alias for consistency
  grossWpm?: number;              // word_count / (total_time/60) - optional
  gross_wpm?: number;             // Alias for consistency
  
  // Pause metrics
  pauseCount: number;             // All pauses > 0.3s
  pause_count: number;            // Alias for consistency
  longPauseCount: number;         // Gaps > 1.2s
  long_pause_count: number;       // Alias for consistency
  maxPause: number;               // Longest pause in seconds
  max_pause_sec: number;          // Alias for consistency
  pauseRatio: number;             // total_silence / total_duration
  pause_ratio: number;            // Alias for consistency
  totalPauseDuration: number;     // Sum of all pauses > 0.3s
  pause_total_sec: number;        // Alias for consistency
  pauseList?: PauseInfo[];        // Detailed pause information
  pause_list?: PauseInfo[];       // Alias for consistency
}

/** Enhanced fluency score with debug information */
export interface FluencyScore {
  total: number;                  // 0-100
  score: number;                  // Alias for consistency
  speedSubscore: number;          // 0-60
  speed: number;                  // Alias for consistency
  pauseSubscore: number;          // 0-40
  pause: number;                  // Alias for consistency
  metrics: FluencyMetrics;
  
  // Debug info
  speed_band?: string;            // e.g., "110-140 WPM"
  pause_explanation?: string;
  debug_flags?: string[];
}

// Pause thresholds
const PAUSE_THRESHOLD = 0.3;       // seconds - minimum gap to count as pause
const LONG_PAUSE_THRESHOLD = 1.2;  // seconds - long pause threshold
const MAX_PAUSE_CAP = 2.5;         // seconds - cap for max pause scoring

// Speed bands for scoring (articulation WPM)
const SPEED_BANDS = [
  { min: 0, max: 45, score: 10 },
  { min: 45, max: 65, score: 25 },
  { min: 65, max: 85, score: 40 },
  { min: 85, max: 110, score: 55 },
  { min: 110, max: 140, score: 60 },
];

// Calculate speed subscore (0-60) based on articulation WPM
export function calculateSpeedSubscore(articulationWpm: number): number {
  // Clamp to reasonable bounds
  if (articulationWpm <= 0) return 0;
  if (articulationWpm >= 140) return 60;

  // Find the band and interpolate
  for (let i = 0; i < SPEED_BANDS.length; i++) {
    const band = SPEED_BANDS[i];
    if (articulationWpm >= band.min && articulationWpm < band.max) {
      // Interpolate within the band
      const bandRange = band.max - band.min;
      const position = (articulationWpm - band.min) / bandRange;
      
      // Get the previous band's score (or 0 for first band)
      const prevScore = i > 0 ? SPEED_BANDS[i - 1].score : 0;
      const scoreRange = band.score - prevScore;
      
      return Math.round(prevScore + position * scoreRange);
    }
  }
  
  return 60; // Max score
}

// Calculate pause control subscore (0-40)
export function calculatePauseSubscore(
  longPauseCount: number,
  maxPause: number,
  pauseRatio: number
): number {
  let score = 40;
  
  // -5 for each long pause (>1.2s), cap at -20
  const longPausePenalty = Math.min(longPauseCount * 5, 20);
  score -= longPausePenalty;
  
  // -10 if max pause > 2.5s
  if (maxPause > 2.5) {
    score -= 10;
  }
  
  // -10 if pause ratio > 0.35
  if (pauseRatio > 0.35) {
    score -= 10;
  }
  
  return Math.max(0, score);
}

// Calculate total fluency score (enhanced)
export function calculateFluencyScore(metrics: FluencyMetrics): FluencyScore {
  const speedSubscore = calculateSpeedSubscore(metrics.articulationWpm);
  const pauseSubscore = calculatePauseSubscore(
    metrics.longPauseCount,
    metrics.maxPause,
    metrics.pauseRatio
  );
  
  const total = speedSubscore + pauseSubscore;
  
  // Determine speed band for debugging
  const speed_band = getSpeedBand(metrics.articulationWpm);
  
  // Generate pause explanation
  const pause_explanation = generatePauseExplanation(
    metrics.longPauseCount,
    metrics.maxPause,
    metrics.pauseRatio
  );
  
  // Collect debug flags
  const debug_flags: string[] = [];
  
  return {
    total,
    score: total, // Alias
    speedSubscore,
    speed: speedSubscore, // Alias
    pauseSubscore,
    pause: pauseSubscore, // Alias
    metrics,
    speed_band,
    pause_explanation,
    debug_flags,
  };
}

/**
 * Get speed band description
 */
function getSpeedBand(wpm: number): string {
  for (const band of SPEED_BANDS) {
    if (wpm >= band.min && wpm < band.max) {
      return `${band.min}-${band.max} WPM`;
    }
  }
  return '140+ WPM';
}

/**
 * Generate pause explanation
 */
function generatePauseExplanation(
  longPauseCount: number,
  maxPause: number,
  pauseRatio: number
): string {
  const parts: string[] = [];
  
  if (longPauseCount > 0) {
    parts.push(`${longPauseCount} long pause${longPauseCount > 1 ? 's' : ''} (>${LONG_PAUSE_THRESHOLD}s)`);
  }
  
  if (maxPause > MAX_PAUSE_CAP) {
    parts.push(`max pause ${maxPause.toFixed(1)}s (>${MAX_PAUSE_CAP}s penalty)`);
  }
  
  if (pauseRatio > 0.35) {
    parts.push(`pause ratio ${(pauseRatio * 100).toFixed(0)}% (>35% penalty)`);
  }
  
  if (parts.length === 0) {
    return 'Good pause control';
  }
  
  return parts.join('; ');
}

// ============================================================================
// Enhanced Metrics Calculation from Word Timestamps
// ============================================================================

/**
 * Calculate enhanced fluency metrics from word timestamps
 * Supports Whisper verbose_json format
 */
export function calculateMetricsFromTimestamps(
  words: WordTimestamp[],
  totalDuration?: number
): {
  metrics: FluencyMetrics;
  debug_flags: string[];
} {
  const debug_flags: string[] = [];
  
  // Check if we have word timestamps
  if (!words || words.length === 0) {
    debug_flags.push('asr_word_timestamps_missing');
    // Return minimal metrics
    return {
      metrics: createEmptyMetrics(),
      debug_flags,
    };
  }
  
  // Filter out fillers
  const nonFillerWords = words.filter(w => 
    !FRENCH_FILLERS.some(filler => 
      w.word.toLowerCase().trim() === filler.toLowerCase()
    )
  );
  
  const fillerCount = words.length - nonFillerWords.length;
  const fillerRatio = words.length > 0 ? fillerCount / words.length : 0;
  
  // Check if filler filtering removed too much
  if (fillerRatio > 0.3) {
    debug_flags.push('filler_filter_removed_too_much');
  }
  
  // Calculate speaking time (first to last non-filler word)
  let speakingTime = 0;
  if (nonFillerWords.length > 0) {
    const firstWord = nonFillerWords[0];
    const lastWord = nonFillerWords[nonFillerWords.length - 1];
    speakingTime = lastWord.end - firstWord.start;
  }
  
  // Calculate WPM
  const articulationWpm = speakingTime > 0 
    ? (nonFillerWords.length / (speakingTime / 60))
    : 0;
  
  const grossWpm = totalDuration && totalDuration > 0
    ? (nonFillerWords.length / (totalDuration / 60))
    : undefined;
  
  // Detect pauses
  const pauseList: PauseInfo[] = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > PAUSE_THRESHOLD) {
      pauseList.push({
        start: words[i - 1].end,
        duration: gap,
        end: words[i].start,
      });
    }
  }
  
  const pauseCount = pauseList.length;
  const longPauseCount = pauseList.filter(p => p.duration > LONG_PAUSE_THRESHOLD).length;
  const maxPause = pauseList.length > 0
    ? Math.max(...pauseList.map(p => p.duration))
    : 0;
  
  const totalPauseDuration = pauseList.reduce((sum, p) => sum + p.duration, 0);
  
  // Calculate pause ratio
  const totalTime = totalDuration || (speakingTime + totalPauseDuration);
  const pauseRatio = totalTime > 0 ? totalPauseDuration / totalTime : 0;
  
  const metrics: FluencyMetrics = {
    wordCount: nonFillerWords.length,
    word_count_non_filler: nonFillerWords.length,
    totalWordCount: words.length,
    fillerCount,
    fillerRatio,
    
    speakingTime,
    speaking_time_sec: speakingTime,
    totalDuration,
    
    articulationWpm,
    articulation_wpm: articulationWpm,
    grossWpm,
    gross_wpm: grossWpm,
    
    pauseCount,
    pause_count: pauseCount,
    longPauseCount,
    long_pause_count: longPauseCount,
    maxPause,
    max_pause_sec: maxPause,
    pauseRatio,
    pause_ratio: pauseRatio,
    totalPauseDuration,
    pause_total_sec: totalPauseDuration,
    pauseList,
    pause_list: pauseList,
  };
  
  return {
    metrics,
    debug_flags,
  };
}

/**
 * Create empty metrics (fallback)
 */
function createEmptyMetrics(): FluencyMetrics {
  return {
    wordCount: 0,
    word_count_non_filler: 0,
    totalWordCount: 0,
    fillerCount: 0,
    fillerRatio: 0,
    
    speakingTime: 0,
    speaking_time_sec: 0,
    
    articulationWpm: 0,
    articulation_wpm: 0,
    
    pauseCount: 0,
    pause_count: 0,
    longPauseCount: 0,
    long_pause_count: 0,
    maxPause: 0,
    max_pause_sec: 0,
    pauseRatio: 0,
    pause_ratio: 0,
    totalPauseDuration: 0,
    pause_total_sec: 0,
  };
}

/**
 * Calculate fluency score from word timestamps (convenience function)
 */
export function scoreFluencyFromTimestamps(
  words: WordTimestamp[],
  totalDuration?: number
): FluencyScore {
  const { metrics, debug_flags } = calculateMetricsFromTimestamps(words, totalDuration);
  const score = calculateFluencyScore(metrics);
  
  return {
    ...score,
    debug_flags: [...(score.debug_flags || []), ...debug_flags],
  };
}
