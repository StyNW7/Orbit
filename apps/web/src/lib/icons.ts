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

/**
 * Career Universe node palette — green/teal = what you have, orange/amber = what is ahead,
 * blue = knowledge, violet = people. Every type keeps a distinct hue so the legend stays readable.
 */
export const NODE_STYLE: Record<NodeType, { color: string; icon: LucideIcon }> = {
  USER: { color: '#0AB46A', icon: UserRound },
  CAREER_ROLE: { color: '#15201B', icon: Target },
  GOAL: { color: '#05603A', icon: Flag },
  QUEST: { color: '#14B8A6', icon: Route },
  SKILL: { color: '#5CC98A', icon: Sparkles },
  GAP: { color: '#EF5A2A', icon: Target },
  EXPERIENCE: { color: '#5E7A70', icon: BriefcaseBusiness },
  PROJECT: { color: '#4F6B61', icon: FolderKanban },
  COMPETITION: { color: '#6C8A7F', icon: Trophy },
  CERTIFICATION: { color: '#7C968C', icon: Medal },
  OPPORTUNITY: { color: '#FB9002', icon: BriefcaseBusiness },
  EVENT: { color: '#E3B008', icon: CalendarDays },
  COURSE: { color: '#3E7CB1', icon: GraduationCap },
  BOOK: { color: '#5B8FC7', icon: BookOpen },
  PAPER: { color: '#7AA5D6', icon: FileText },
  MENTOR: { color: '#8B6FD6', icon: Users },
  ROLE_MODEL: { color: '#A48BE0', icon: Users },
};

/** Dark-canvas overrides: near-black and slate tones are lifted so every node stays visible. */
const DARK_NODE_COLOR: Partial<Record<NodeType, string>> = {
  CAREER_ROLE: '#E8EFEB',
  GOAL: '#A7EBC6',
  QUEST: '#2DD4BF',
  SKILL: '#4ADE80',
  GAP: '#FF7043',
  EVENT: '#FACC15',
  EXPERIENCE: '#8FA79E',
  PROJECT: '#7F9A90',
  COMPETITION: '#A3BBB1',
  CERTIFICATION: '#B4C7BF',
  COURSE: '#5B9BD5',
  BOOK: '#7AAAE0',
  PAPER: '#9BBEE6',
};

export function nodeColor(type: NodeType, dark: boolean): string {
  return (dark && DARK_NODE_COLOR[type]) || NODE_STYLE[type].color;
}

/** Readable foreground (icon/text) for a solid node-colour chip. */
export function onNodeColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? '#101714' : '#FFFFFF';
}
