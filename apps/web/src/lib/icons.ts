import {
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  Code,
  Compass,
  FileText,
  Flag,
  FolderKanban,
  GraduationCap,
  Medal,
  PenTool,
  Route,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { NodeType } from '@orbit/shared';

export const ROLE_ICONS: Record<string, LucideIcon> = {
  compass: Compass,
  code: Code,
  'brain-circuit': BrainCircuit,
  'chart-no-axes-combined': ChartNoAxesCombined,
  'pen-tool': PenTool,
  'briefcase-business': BriefcaseBusiness,
};

export const roleIcon = (name: string | undefined): LucideIcon => (name && ROLE_ICONS[name]) || BriefcaseBusiness;

/** Career Universe node palette — green = what you have, orange = what is ahead. */
export const NODE_STYLE: Record<NodeType, { color: string; icon: LucideIcon }> = {
  USER: { color: '#0AB46A', icon: UserRound },
  CAREER_ROLE: { color: '#15201B', icon: Target },
  GOAL: { color: '#088F54', icon: Flag },
  QUEST: { color: '#51C868', icon: Route },
  SKILL: { color: '#0AB46A', icon: Sparkles },
  GAP: { color: '#FB9002', icon: Target },
  EXPERIENCE: { color: '#5E7A70', icon: BriefcaseBusiness },
  PROJECT: { color: '#4F6B61', icon: FolderKanban },
  COMPETITION: { color: '#6C8A7F', icon: Trophy },
  CERTIFICATION: { color: '#7C968C', icon: Medal },
  OPPORTUNITY: { color: '#F59E0B', icon: BriefcaseBusiness },
  EVENT: { color: '#FDBA4D', icon: CalendarDays },
  COURSE: { color: '#3E7CB1', icon: GraduationCap },
  BOOK: { color: '#5B8FC7', icon: BookOpen },
  PAPER: { color: '#7AA5D6', icon: FileText },
  MENTOR: { color: '#8B6FD6', icon: Users },
  ROLE_MODEL: { color: '#A48BE0', icon: Users },
};
