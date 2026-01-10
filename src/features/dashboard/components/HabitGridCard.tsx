/**
 * Habit Tracker Grid Card
 * Custom grid with clickable cells and streak tracking
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { calculateCurrentStreak } from '../data/mockData';
import type { Habit, HabitCell, HabitFrequency, HabitCellStatus, TimeRange } from '../types';

interface HabitGridCardProps {
  habits: Habit[];
  habitGrid: HabitCell[];
  range: TimeRange;
  onCellToggle: (habitId: string, date: string, status: HabitCellStatus, intensity?: number) => void;
  onAddHabit: (habit: Habit) => void;
  onBadgeUnlock: (badgeId: string) => void;
}

export function HabitGridCard({
  habits,
  habitGrid,
  range,
  onCellToggle,
  onAddHabit,
  onBadgeUnlock,
}: HabitGridCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitFrequency, setNewHabitFrequency] = useState<HabitFrequency>('daily');

  // Get days to show based on range
  const getDaysCount = () => {
    switch (range) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
      default:
        return 30;
    }
  };

  const daysCount = getDaysCount();
  const today = new Date();
  const dates: string[] = [];

  for (let i = daysCount - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  const handleCellClick = (habitId: string, date: string, currentStatus: HabitCellStatus) => {
    const todayStr = today.toISOString().split('T')[0];
    const isFuture = date > todayStr;

    if (isFuture) {
      toast.error("You can't track future progress yet!");
      return;
    }

    // Cycle through states: na → done → missed → na
    let newStatus: HabitCellStatus;
    let intensity: number | undefined;

    switch (currentStatus) {
      case 'na':
        newStatus = 'done';
        intensity = 1; // Fixed intensity - solid green
        break;
      case 'done':
        newStatus = 'missed';
        intensity = undefined;
        break;
      case 'missed':
        newStatus = 'na';
        intensity = undefined;
        break;
      default:
        newStatus = 'na';
    }

    onCellToggle(habitId, date, newStatus, intensity);

    // Life Demonstration Feature: Logic for 3-day streak unlock
    if (newStatus === 'done') {
      // Find the habit grid cells for this habit
      const habitCells = habitGrid
        .filter(c => c.habitId === habitId)
        .sort((a, b) => b.date.localeCompare(a.date));
      
      // Update the current cell status in our local copy for checking
      const updatedCells = habitCells.map(c => 
        c.date === date ? { ...c, status: newStatus } : c
      );

      // Check for 3 days in a row (including today/the clicked day)
      let streakCount = 0;
      let hasThreeDayStreak = false;
      
      // Sort all "done" cells by date
      const doneDates = updatedCells
        .filter(c => c.status === 'done')
        .map(c => c.date)
        .sort((a, b) => b.localeCompare(a));

      for (let i = 0; i < doneDates.length - 2; i++) {
        const d1 = new Date(doneDates[i]);
        const d2 = new Date(doneDates[i+1]);
        const d3 = new Date(doneDates[i+2]);
        
        const diff1 = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        const diff2 = Math.round((d3.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diff1 === 1 && diff2 === 1) {
          hasThreeDayStreak = true;
          break;
        }
      }

      if (hasThreeDayStreak) {
        onBadgeUnlock('badge-streak-3');
        toast.success('🎉 3-Day Streak Unlock!', {
          description: "You've been consistent for 3 days! Momentum is building.",
        });
      }
    }
  };

  const handleAddHabit = () => {
    if (!newHabitName.trim()) return;

    const newHabit: Habit = {
      id: `habit-${Date.now()}`,
      name: newHabitName,
      frequency: newHabitFrequency,
      source: 'personal',
      createdAt: new Date().toISOString(),
    };

    onAddHabit(newHabit);
    setDialogOpen(false);
    setNewHabitName('');
    setNewHabitFrequency('daily');
    
    toast.success('Practice added to your momentum tracker!');
  };

  const getCellColor = (status: HabitCellStatus, _intensity?: number) => {
    switch (status) {
      case 'done':
        return 'rgb(34, 197, 94)'; // solid green
      case 'missed':
        return 'rgb(239, 68, 68)'; // red
      case 'na':
        return 'rgb(148, 163, 184)'; // gray
      case 'future':
        return 'rgb(226, 232, 240)'; // light gray
    }
  };

  const currentStreak = calculateCurrentStreak(habitGrid);

  return (
    <>
      <Card className="border-border bg-card shadow-sm overflow-hidden w-full">
        <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-serif">Daily Momentum</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                  <Flame className="w-3 h-3 fill-orange-500" />
                  <span className="text-xs font-bold uppercase tracking-tight">
                    {currentStreak} day streak
                  </span>
                </div>
              </div>
            </div>
            <Button onClick={() => setDialogOpen(true)} size="sm" variant="ghost" className="hover:bg-primary/10 hover:text-primary">
              <Plus className="w-4 h-4 mr-2" />
              Add Practice
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {habits.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
              <p className="font-medium">Build consistency by tracking your daily practices</p>
              <Button variant="outline" onClick={() => setDialogOpen(true)} className="mt-4">
                Set Your First Habit
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto pb-4 custom-scrollbar">
              <div className="inline-block min-w-full px-1">
                {/* Day Headers */}
                <div className="flex mb-3">
                  <div className="w-52 flex-shrink-0 pr-4" />
                  {dates.map((date) => {
                    const d = new Date(date);
                    const isToday = date === today.toISOString().split('T')[0];
                    return (
                      <div
                        key={date}
                        className={`w-6 text-center text-[10px] font-bold uppercase tracking-tighter flex-shrink-0 ${
                          isToday ? 'text-primary' : 'text-muted-foreground/60'
                        }`}
                      >
                        {d.getDate()}
                      </div>
                    );
                  })}
                </div>

                {/* Habit Rows */}
                {habits.map((habit) => (
                  <div key={habit.id} className="flex items-center mb-3 group">
                    <div className="w-52 flex-shrink-0 pr-4">
                      <p className="text-sm font-medium text-foreground leading-tight truncate" title={habit.name}>
                        {habit.name}
                      </p>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 mt-1 h-4">
                        {habit.frequency}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {dates.map((date) => {
                        const cell = habitGrid.find(
                          (c) => c.habitId === habit.id && c.date === date
                        );
                        const status = cell?.status || 'na';

                        return (
                          <div
                            key={date}
                            className="w-5 h-5 flex-shrink-0 cursor-pointer transition-all hover:scale-125 hover:z-10"
                            onClick={() => handleCellClick(habit.id, date, status)}
                            title={`${date}: ${status}`}
                          >
                            <div
                              className="w-full h-full rounded-sm border border-border/30 transition-all duration-150 hover:border-border"
                              style={{
                                backgroundColor: getCellColor(status, cell?.intensity),
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Habit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Habit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="habitName">Habit Name</Label>
              <Input
                id="habitName"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                placeholder="e.g., Morning phrases session"
              />
            </div>
            <div>
              <Label htmlFor="frequency">Frequency</Label>
              <Select
                value={newHabitFrequency}
                onValueChange={(v) => setNewHabitFrequency(v as HabitFrequency)}
              >
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddHabit} disabled={!newHabitName.trim()}>
              Add Habit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

