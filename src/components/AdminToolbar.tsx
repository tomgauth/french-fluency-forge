import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminMode } from '@/hooks/useAdminMode';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Settings, 
  SkipForward, 
  Play, 
  RotateCcw,
  Database,
  ChevronDown,
  Zap,
  Phone,
  LayoutDashboard
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type SessionStatus = 'intake' | 'consent' | 'quiz' | 'mic_check' | 'assessment' | 'processing' | 'completed';
// 4 assessment modules:
// A. Pronunciation - pronunciation exercises
// B. Comprehension - listening comprehension
// C. Confidence - confidence questionnaire only
// D. Speech test - open-ended prompt for fluency, syntax, conversation skills
type AssessmentPhase = 'pronunciation' | 'comprehension' | 'confidence' | 'conversation';

const STATUS_OPTIONS: { value: SessionStatus; label: string }[] = [
  { value: 'intake', label: 'Intake Form' },
  { value: 'consent', label: 'Consent Form' },
  { value: 'quiz', label: 'Personality Quiz' },
  { value: 'mic_check', label: 'Mic Check' },
  { value: 'assessment', label: 'Assessment Modules' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
];

const MODULE_OPTIONS: { value: AssessmentPhase; label: string; icon: string }[] = [
  { value: 'pronunciation', label: 'Pronunciation', icon: '🗣️' },
  { value: 'comprehension', label: 'Comprehension', icon: '👂' },
  { value: 'confidence', label: 'Confidence', icon: '🧠' },
  { value: 'conversation', label: 'Speech Test', icon: '🎙️' },
];

export function AdminToolbar() {
  const { user } = useAuth();
  const { isAdmin, isDev } = useAdminMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentSession, setCurrentSession] = useState<any>(null);

  // Determine visibility (calculated after all hooks)
  const shouldShow = isAdmin || isDev;

  const jumpToStatus = async (status: SessionStatus) => {
    if (!user) {
      toast.error('Please login first');
      return;
    }

    try {
      const { data: existingSession } = await supabase
        .from('assessment_sessions')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        await supabase
          .from('assessment_sessions')
          .update({ status })
          .eq('id', existingSession.id);
      } else {
        await supabase
          .from('assessment_sessions')
          .insert({ user_id: user.id, status });
      }

      toast.success(`Jumped to ${status}`);
      
      if (location.pathname === '/assessment') {
        window.location.reload();
      } else {
        navigate('/assessment');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to jump');
    }
  };

  const jumpToModule = async (module: AssessmentPhase) => {
    if (!user) {
      toast.error('Please login first');
      return;
    }

    try {
      sessionStorage.setItem('dev_assessment_phase', module);
      
      const { data: existingSession } = await supabase
        .from('assessment_sessions')
        .select('id, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        if (existingSession.status !== 'assessment') {
          await supabase
            .from('assessment_sessions')
            .update({ status: 'assessment' })
            .eq('id', existingSession.id);
        }
      } else {
        await supabase
          .from('assessment_sessions')
          .insert({ user_id: user.id, status: 'assessment' });
      }

      toast.success(`Jumping to ${module}...`);
      
      if (location.pathname === '/assessment') {
        window.location.reload();
      } else {
        navigate('/assessment');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to jump to module');
    }
  };

  const resetSession = async () => {
    if (!user) {
      toast.error('Please login first');
      return;
    }

    if (!confirm('Reset current session? This will create a fresh session.')) {
      return;
    }

    try {
      await supabase
        .from('assessment_sessions')
        .insert({ user_id: user.id, status: 'intake' });

      toast.success('New session created');
      navigate('/assessment');
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to reset session');
    }
  };

  // Hide if not admin/dev
  if (!shouldShow) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9997] bg-amber-600 text-white shadow-lg">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <Zap className="h-4 w-4" />
          <span className="text-sm font-bold">ADMIN MODE</span>
          {user && (
            <Badge variant="secondary" className="text-[10px] bg-amber-700 text-white">
              {user.email}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Jump to Status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="h-7 text-xs bg-amber-700 hover:bg-amber-800">
                <SkipForward className="h-3 w-3 mr-1" />
                Jump to Stage
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Assessment Stages</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map(opt => (
                <DropdownMenuItem key={opt.value} onClick={() => jumpToStatus(opt.value)}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Jump to Module */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="h-7 text-xs bg-amber-700 hover:bg-amber-800">
                <Play className="h-3 w-3 mr-1" />
                Jump to Module
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Assessment Modules</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {MODULE_OPTIONS.map(opt => (
                <DropdownMenuItem key={opt.value} onClick={() => jumpToModule(opt.value)}>
                  <span className="mr-2">{opt.icon}</span>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Reset Session */}
          <Button 
            variant="secondary" 
            size="sm" 
            className="h-7 text-xs bg-amber-700 hover:bg-amber-800"
            onClick={resetSession}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            New Session
          </Button>

          {/* Sales Copilot */}
          <Button 
            variant="secondary" 
            size="sm" 
            className="h-7 text-xs bg-amber-700 hover:bg-amber-800"
            onClick={() => navigate('/admin/sales-copilot')}
          >
            <Phone className="h-3 w-3 mr-1" />
            Sales Copilot
          </Button>

          {/* Dashboard */}
          <Button 
            variant="secondary" 
            size="sm" 
            className="h-7 text-xs bg-amber-700 hover:bg-amber-800"
            onClick={() => navigate('/dashboard')}
          >
            <LayoutDashboard className="h-3 w-3 mr-1" />
            Dashboard
          </Button>

          {/* Current Location */}
          <Badge variant="secondary" className="text-[10px] bg-amber-800">
            {location.pathname}
          </Badge>
        </div>
      </div>
    </div>
  );
}
