/**
 * 6-Dimension Radar Card
 * Shows baseline vs current on radar chart
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { AssessmentSnapshot } from '../types';

interface RadarCardProps {
  baseline?: AssessmentSnapshot;
  current?: AssessmentSnapshot;
}

export function RadarCard({ baseline, current }: RadarCardProps) {
  if (!current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Skill Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <p>Complete assessment to see your skill profile</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for radar chart
  const data = [
    {
      dimension: 'Pronunciation',
      baseline: baseline?.dimensions.pronunciation || 0,
      current: current.dimensions.pronunciation,
      fullMark: 100,
    },
    {
      dimension: 'Fluency',
      baseline: baseline?.dimensions.fluency || 0,
      current: current.dimensions.fluency,
      fullMark: 100,
    },
    {
      dimension: 'Confidence',
      baseline: baseline?.dimensions.confidence || 0,
      current: current.dimensions.confidence,
      fullMark: 100,
    },
    {
      dimension: 'Syntax',
      baseline: baseline?.dimensions.syntax || 0,
      current: current.dimensions.syntax,
      fullMark: 100,
    },
    {
      dimension: 'Speech Test',
      baseline: baseline?.dimensions.conversation || 0,
      current: current.dimensions.conversation,
      fullMark: 100,
    },
    {
      dimension: 'Comprehension',
      baseline: baseline?.dimensions.comprehension || 0,
      current: current.dimensions.comprehension,
      fullMark: 100,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Skill Profile</CardTitle>
        {baseline && (
          <p className="text-sm text-muted-foreground">
            Baseline vs Current
          </p>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="dimension" />
            <PolarRadiusAxis angle={90} domain={[0, 100]} />
            {baseline && (
              <Radar
                name="Baseline"
                dataKey="baseline"
                stroke="#94a3b8"
                fill="#94a3b8"
                fillOpacity={0.2}
              />
            )}
            <Radar
              name="Current"
              dataKey="current"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.4}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
