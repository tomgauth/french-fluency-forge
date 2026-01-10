/**
 * Dashboard Data Hook
 * Combines real assessment data with mock data
 * V0-CORE: Habits and Goals now persist to database
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchUserAssessments,
  getBaselineAndCurrent,
} from '../data/assessmentData';
import {
  generateMockHabits,
  generateMockHabitGrid,
  generateMockGoals,
  generateMockPhraseStats,
  generateMockAIMetrics,
  generateMockBadges,
  getPlanFeatures,
  calculateTotalPoints,
} from '../data/mockData';
import { generateTimelineSeries } from '../data/projections';
import type {
  DashboardData,
  DashboardLoadingState,
  MetricKey,
  TimeRange,
  Habit,
  HabitCell,
  Goal,
  Badge,
} from '../types';

// Database row types
interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  frequency: 'daily' | 'weekly';
  source: 'system' | 'personal';
  intensity: number | null;
  created_at: string;
}

interface HabitCellRow {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  status: 'done' | 'missed' | 'na' | 'future';
  intensity: number | null;
}

interface GoalRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  acceptance_criteria: string | null;
  deadline: string | null;
  goal_type: 'skill' | 'volume' | 'freeform';
  locked: boolean;
  dimension: string | null;
  target_score: number | null;
  metric: string | null;
  target_value: number | null;
  created_at: string;
}

// Convert database row to frontend type
function habitRowToHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    frequency: row.frequency,
    source: row.source,
    intensity: row.intensity ?? undefined,
    createdAt: row.created_at,
  };
}

function habitCellRowToHabitCell(row: HabitCellRow): HabitCell {
  return {
    habitId: row.habit_id,
    date: row.date,
    status: row.status,
    intensity: row.intensity ?? undefined,
  };
}

function goalRowToGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    acceptanceCriteria: row.acceptance_criteria || '',
    deadline: row.deadline || '',
    type: row.goal_type,
    locked: row.locked,
    createdAt: row.created_at,
    dimension: row.dimension as Goal['dimension'],
    targetScore: row.target_score ?? undefined,
    metric: row.metric as Goal['metric'],
    targetValue: row.target_value ?? undefined,
  };
}

export function useDashboardData(viewingUserId?: string) {
  const { user } = useAuth();
  const targetUserId = viewingUserId || user?.id;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<DashboardLoadingState>({
    assessments: true,
    habits: true,
    goals: true,
    phrases: true,
    aiMetrics: true,
    badges: true,
  });
  const [error, setError] = useState<string | null>(null);

  // Local state for mock data (will persist to DB later)
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitGrid, setHabitGrid] = useState<HabitCell[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    if (!targetUserId) return;
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  const loadDashboardData = useCallback(async () => {
    if (!targetUserId || !user) return;

    try {
      setLoading(prev => ({ ...prev, assessments: true, habits: true, goals: true }));

      // Fetch real assessment data
      let assessments = await fetchUserAssessments(targetUserId);
      
      // IF NO REAL ASSESSMENTS, USE MOCK HISTORY FOR DEMO
      if (assessments.length === 0) {
        const { generateMockAssessmentHistory } = await import('../data/mockData');
        assessments = generateMockAssessmentHistory();
      }
      
      const { baseline, current } = getBaselineAndCurrent(assessments);

      // ========================================
      // V0-CORE: Fetch habits from database
      // ========================================
      let loadedHabits: Habit[] = [];
      let loadedHabitGrid: HabitCell[] = [];
      
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: true });
      
      if (habitsError) {
        console.error('Error fetching habits:', habitsError);
        // Fall back to mock data if table doesn't exist yet
        loadedHabits = generateMockHabits();
        loadedHabitGrid = generateMockHabitGrid(loadedHabits);
      } else if (habitsData && habitsData.length > 0) {
        loadedHabits = habitsData.map((row: HabitRow) => habitRowToHabit(row));
        
        // Fetch habit cells for these habits
        const habitIds = loadedHabits.map(h => h.id);
        const { data: cellsData, error: cellsError } = await supabase
          .from('habit_cells')
          .select('*')
          .in('habit_id', habitIds);
        
        if (cellsError) {
          console.error('Error fetching habit cells:', cellsError);
          loadedHabitGrid = generateMockHabitGrid(loadedHabits);
        } else {
          loadedHabitGrid = (cellsData || []).map((row: HabitCellRow) => habitCellRowToHabitCell(row));
        }
      } else {
        // No habits in DB, use mock data for demo
        loadedHabits = generateMockHabits();
        loadedHabitGrid = generateMockHabitGrid(loadedHabits);
      }

      // ========================================
      // V0-CORE: Fetch goals from database
      // ========================================
      let loadedGoals: Goal[] = [];
      
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: true });
      
      if (goalsError) {
        console.error('Error fetching goals:', goalsError);
        // Fall back to mock data if table doesn't exist yet
        loadedGoals = generateMockGoals();
      } else if (goalsData && goalsData.length > 0) {
        loadedGoals = goalsData.map((row: GoalRow) => goalRowToGoal(row));
      } else {
        // No goals in DB, use mock data for demo
        loadedGoals = generateMockGoals();
      }

      const mockPhrases = generateMockPhraseStats();
      const mockAIMetrics = generateMockAIMetrics();
      const mockBadges = generateMockBadges();

      // Check if user has completed first assessment
      if (current) {
        mockBadges.find((b) => b.id === 'badge-first-assessment')!.unlocked = true;
      }

      setHabits(loadedHabits);
      setHabitGrid(loadedHabitGrid);
      setGoals(loadedGoals);
      setBadges(mockBadges);

      // Generate timeline series for overall metric
      const timelineSeries = generateTimelineSeries(assessments, 'overall', 90);

      // Build complete dashboard data
      const dashboardData: DashboardData = {
        member: {
          id: targetUserId,
          name: user.email?.split('@')[0] || 'Member',
          email: user.email || '',
          plan: '3090', // Mock for now, can read from app_accounts later
          features: getPlanFeatures('3090'),
        },
        assessments: {
          baseline,
          current,
          history: assessments,
        },
        timeline: [
          {
            metric: 'overall',
            ...timelineSeries,
          },
        ],
        habits: loadedHabits,
        habitGrid: loadedHabitGrid,
        goals: loadedGoals,
        phrases: mockPhrases,
        aiMetrics: mockAIMetrics,
        badges: mockBadges,
        points: calculateTotalPoints(mockBadges),
      };

      setData(dashboardData);
      setLoading({
        assessments: false,
        habits: false,
        goals: false,
        phrases: false,
        aiMetrics: false,
        badges: false,
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
      setLoading({
        assessments: false,
        habits: false,
        goals: false,
        phrases: false,
        aiMetrics: false,
        badges: false,
      });
    }
  }, [targetUserId, user]);

  // ========================================
  // V0-CORE: Database-persisted action methods
  // ========================================

  // Update a habit cell (daily completion tracking)
  const updateHabitCell = async (habitId: string, date: string, status: HabitCell['status'], intensity?: number) => {
    if (!targetUserId) return;

    // Optimistic update
    setHabitGrid((prev) =>
      prev.map((cell) =>
        cell.habitId === habitId && cell.date === date
          ? { ...cell, status, intensity }
          : cell
      )
    );

    // Persist to database using upsert
    const { error } = await supabase
      .from('habit_cells')
      .upsert({
        habit_id: habitId,
        user_id: targetUserId,
        date,
        status,
        intensity: intensity ?? null,
      }, {
        onConflict: 'habit_id,date'
      });

    if (error) {
      console.error('Error updating habit cell:', error);
      // Could revert optimistic update here if needed
    }
  };

  // Add a new habit
  const addHabit = async (habit: Omit<Habit, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => {
    if (!targetUserId) return;

    // Insert into database
    const { data: newHabit, error } = await supabase
      .from('habits')
      .insert({
        user_id: targetUserId,
        name: habit.name,
        frequency: habit.frequency,
        source: habit.source,
        intensity: habit.intensity ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding habit:', error);
      return;
    }

    if (newHabit) {
      // Add to local state
      const convertedHabit = habitRowToHabit(newHabit as HabitRow);
      setHabits((prev) => [...prev, convertedHabit]);
    }
  };

  // Delete a habit
  const deleteHabit = async (habitId: string) => {
    if (!targetUserId) return;

    // Delete from database (will cascade to habit_cells)
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', habitId)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('Error deleting habit:', error);
      return;
    }

    // Remove from local state
    setHabits((prev) => prev.filter(h => h.id !== habitId));
    setHabitGrid((prev) => prev.filter(c => c.habitId !== habitId));
  };

  // Add a new goal
  const addGoal = async (goal: Omit<Goal, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => {
    if (!targetUserId) return;

    // Insert into database
    const { data: newGoal, error } = await supabase
      .from('goals')
      .insert({
        user_id: targetUserId,
        name: goal.name,
        description: goal.description || null,
        acceptance_criteria: goal.acceptanceCriteria || null,
        deadline: goal.deadline || null,
        goal_type: goal.type,
        locked: goal.locked,
        dimension: goal.dimension || null,
        target_score: goal.targetScore ?? null,
        metric: goal.metric || null,
        target_value: goal.targetValue ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding goal:', error);
      return;
    }

    if (newGoal) {
      // Add to local state
      const convertedGoal = goalRowToGoal(newGoal as GoalRow);
      setGoals((prev) => [...prev, convertedGoal]);
    }
  };

  // Update a goal
  const updateGoal = async (goalId: string, updates: Partial<Goal>) => {
    if (!targetUserId) return;

    // Optimistic update
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, ...updates } : g))
    );

    // Persist to database
    const { error } = await supabase
      .from('goals')
      .update({
        name: updates.name,
        description: updates.description,
        acceptance_criteria: updates.acceptanceCriteria,
        deadline: updates.deadline,
        goal_type: updates.type,
        locked: updates.locked,
        dimension: updates.dimension,
        target_score: updates.targetScore,
        metric: updates.metric,
        target_value: updates.targetValue,
      })
      .eq('id', goalId)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('Error updating goal:', error);
    }
  };

  // Delete a goal
  const deleteGoal = async (goalId: string) => {
    if (!targetUserId) return;

    // Delete from database
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('Error deleting goal:', error);
      return;
    }

    // Remove from local state
    setGoals((prev) => prev.filter(g => g.id !== goalId));
  };

  const unlockBadge = (badgeId: string) => {
    setBadges((prev) =>
      prev.map((b) =>
        b.id === badgeId
          ? { ...b, unlocked: true, unlockedAt: new Date().toISOString() }
          : b
      )
    );
  };

  return {
    data,
    loading,
    error,
    habits,
    habitGrid,
    goals,
    badges,
    actions: {
      updateHabitCell,
      addHabit,
      deleteHabit,
      addGoal,
      updateGoal,
      deleteGoal,
      unlockBadge,
      refresh: loadDashboardData,
    },
  };
}

