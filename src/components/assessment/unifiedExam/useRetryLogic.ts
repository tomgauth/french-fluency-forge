/**
 * Retry Logic for Unified Exam
 * 14-day cooldown for official assessments
 * 
 * NOTE: This is a stub implementation. The unified_exam_sessions table
 * and related database functions need to be created via migration
 * before this functionality can be fully implemented.
 */

import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';

interface RetryStatus {
  canTakeOfficial: boolean;
  nextAvailableDate: Date | null;
  lastOfficialExam: Date | null;
  daysUntilNext: number;
  totalOfficialExams: number;
  loading: boolean;
}

/**
 * Hook to check if user can take official exam
 * Currently returns default values as database structures are not yet created
 */
export function useRetryLogic(user: User | null): RetryStatus {
  const [status, setStatus] = useState<RetryStatus>({
    canTakeOfficial: true, // Default to allowing exam
    nextAvailableDate: null,
    lastOfficialExam: null,
    daysUntilNext: 0,
    totalOfficialExams: 0,
    loading: false,
  });
  
  useEffect(() => {
    // Stub: In production, would check database for retry eligibility
    // For now, always allow taking the exam
    if (user) {
      setStatus(prev => ({ ...prev, canTakeOfficial: true, loading: false }));
    }
  }, [user]);
  
  return status;
}

/**
 * Create new unified exam session
 * Stub implementation - returns mock ID
 */
export async function createUnifiedExamSession(
  userId: string,
  sessionId: string,
  isOfficial: boolean = true
): Promise<string | null> {
  // Stub: Would create entry in unified_exam_sessions table
  console.log('createUnifiedExamSession called (stub)', { userId, sessionId, isOfficial });
  return `exam_${Date.now()}`;
}

/**
 * Update unified exam session with results
 * Stub implementation
 */
export async function updateUnifiedExamSession(
  examId: string,
  updates: {
    scenario_1_id?: string;
    scenario_2_id?: string;
    scenario_3_id?: string;
    persona_1_id?: string;
    persona_2_id?: string;
    persona_3_id?: string;
    tier_1?: number;
    tier_2?: number;
    tier_3?: number;
    conversation_transcript?: unknown[];
    fluency_score?: number;
    syntax_score?: number;
    conversation_score?: number;
    confidence_score?: number;
    overall_score?: number;
    proficiency_level?: string;
    duration_seconds?: number;
    completed_at?: string;
    trace_id?: string;
  }
): Promise<boolean> {
  // Stub: Would update unified_exam_sessions table
  console.log('updateUnifiedExamSession called (stub)', { examId, updates });
  return true;
}

/**
 * Get user's exam history
 * Stub implementation - returns empty array
 */
export async function getUserExamHistory(userId: string): Promise<{
  id: string;
  overall_score: number;
  proficiency_level: string;
  completed_at: string;
  is_official: boolean;
}[]> {
  // Stub: Would query unified_exam_sessions table
  console.log('getUserExamHistory called (stub)', { userId });
  return [];
}

/**
 * Format retry message for UI
 */
export function formatRetryMessage(status: RetryStatus): string {
  if (status.canTakeOfficial) {
    return 'You can take an official assessment now';
  }
  
  if (status.daysUntilNext > 0) {
    if (status.daysUntilNext === 1) {
      return 'Next official assessment available tomorrow';
    }
    return `Next official assessment available in ${status.daysUntilNext} days`;
  }
  
  if (status.nextAvailableDate) {
    return `Next official assessment: ${status.nextAvailableDate.toLocaleDateString()}`;
  }
  
  return 'Checking availability...';
}
