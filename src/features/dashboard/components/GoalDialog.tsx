/**
 * Goal Dialog Component
 * Create/edit goals with lock-in functionality
 */

import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Lock } from 'lucide-react';
import type { Goal, GoalType, DimensionKey, MetricKey } from '../types';

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: Goal; // For editing
  onSave: (goal: Goal) => void;
}

export function GoalDialog({ open, onOpenChange, goal, onSave }: GoalDialogProps) {
  const [name, setName] = useState(goal?.name || '');
  const [description, setDescription] = useState(goal?.description || '');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(goal?.acceptanceCriteria || '');
  const [deadline, setDeadline] = useState(goal?.deadline || '');
  const [type, setType] = useState<GoalType>(goal?.type || 'skill');
  const [dimension, setDimension] = useState<DimensionKey>(goal?.dimension || 'pronunciation');
  const [targetScore, setTargetScore] = useState(goal?.targetScore?.toString() || '85');
  const [metric, setMetric] = useState<MetricKey>(goal?.metric || 'overall');
  const [targetValue, setTargetValue] = useState(goal?.targetValue?.toString() || '100');
  const [locked, setLocked] = useState(goal?.locked || false);

  // Reset form when goal prop changes (for editing)
  useEffect(() => {
    setName(goal?.name || '');
    setDescription(goal?.description || '');
    setAcceptanceCriteria(goal?.acceptanceCriteria || '');
    setDeadline(goal?.deadline || '');
    setType(goal?.type || 'skill');
    setDimension(goal?.dimension || 'pronunciation');
    setTargetScore(goal?.targetScore?.toString() || '85');
    setMetric(goal?.metric || 'overall');
    setTargetValue(goal?.targetValue?.toString() || '100');
    setLocked(goal?.locked || false);
  }, [goal, open]);

  const handleSave = () => {
    const newGoal: Goal = {
      id: goal?.id || `goal-${Date.now()}`,
      name,
      description,
      acceptanceCriteria,
      deadline,
      type,
      locked,
      createdAt: goal?.createdAt || new Date().toISOString(),
      ...(type === 'skill' && {
        dimension,
        targetScore: parseInt(targetScore) || 85,
      }),
      ...(type === 'volume' && {
        metric,
        targetValue: parseInt(targetValue) || 100,
      }),
    };

    onSave(newGoal);
    onOpenChange(false);
  };

  const isReadOnly = goal?.locked || false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goal ? 'Edit Goal' : 'Create Goal'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="name">Goal Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isReadOnly}
              placeholder="e.g., Fluent phone conversations"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isReadOnly}
              rows={3}
              placeholder="What does success look like?"
            />
          </div>

          {/* Acceptance Criteria */}
          <div>
            <Label htmlFor="criteria">Acceptance Criteria</Label>
            <Textarea
              id="criteria"
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              disabled={isReadOnly}
              rows={2}
              placeholder="How will you know you've achieved it?"
            />
          </div>

          {/* Deadline */}
          <div>
            <Label htmlFor="deadline">Deadline</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={isReadOnly}
            />
          </div>

          {/* Type */}
          <div>
            <Label htmlFor="type">Goal Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as GoalType)} disabled={isReadOnly}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skill">Skill Target</SelectItem>
                <SelectItem value="volume">Volume Target</SelectItem>
                <SelectItem value="freeform">Freeform</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Skill Type Fields */}
          {type === 'skill' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dimension">Dimension</Label>
                <Select
                  value={dimension}
                  onValueChange={(v) => setDimension(v as DimensionKey)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger id="dimension">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pronunciation">Pronunciation</SelectItem>
                    <SelectItem value="fluency">Fluency</SelectItem>
                    <SelectItem value="confidence">Confidence</SelectItem>
                    <SelectItem value="syntax">Syntax</SelectItem>
                    <SelectItem value="conversation">Conversation</SelectItem>
                    <SelectItem value="comprehension">Comprehension</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="targetScore">Target Score (0-100)</Label>
                <Input
                  id="targetScore"
                  type="number"
                  min="0"
                  max="100"
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          )}

          {/* Volume Type Fields */}
          {type === 'volume' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="metric">Metric</Label>
                <Select
                  value={metric}
                  onValueChange={(v) => setMetric(v as MetricKey)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger id="metric">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overall">Overall</SelectItem>
                    <SelectItem value="ai_words_spoken">AI Words Spoken</SelectItem>
                    <SelectItem value="phrases_known_recall">Phrases (Recall)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="targetValue">Target Value</Label>
                <Input
                  id="targetValue"
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          )}

          {/* Lock-in Toggle */}
          {!isReadOnly && (
            <div className="flex items-center justify-between p-4 border rounded-md">
              <div>
                <Label htmlFor="locked" className="cursor-pointer">
                  Lock-in Goal
                </Label>
                <p className="text-xs text-muted-foreground">
                  Locked goals can only be changed by your coach
                </p>
              </div>
              <Switch
                id="locked"
                checked={locked}
                onCheckedChange={setLocked}
              />
            </div>
          )}

          {isReadOnly && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Locked-in — only your coach can unlock
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {!isReadOnly && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!name || !deadline}>
                {goal ? 'Save Changes' : 'Create Goal'}
              </Button>
            </>
          )}
          {isReadOnly && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

