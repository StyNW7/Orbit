import { ChartNoAxesCombined, Orbit, Route, Target, Telescope, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
  end?: boolean;
}

/** Five primary destinations — one per core experience. */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/app', label: 'Mission Control', icon: Target, description: 'What to focus on today', end: true },
  { to: '/app/universe', label: 'Universe', icon: Orbit, description: 'Your connected career graph' },
  { to: '/app/journey', label: 'Journey', icon: Route, description: 'Milestones, quests and journal' },
  { to: '/app/discover', label: 'Discover', icon: Telescope, description: 'Jobs, growth, knowledge, people' },
  { to: '/app/progress', label: 'Progress', icon: ChartNoAxesCombined, description: 'Readiness history and timeline' },
];
