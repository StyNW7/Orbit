import { ChartNoAxesCombined, Orbit, Route, Target, Telescope, type LucideIcon } from 'lucide-react';
import type { MessageKey } from '@/lib/i18n';

export interface NavItem {
  to: string;
  label: MessageKey;
  /** Short label for the mobile tab bar. */
  short?: MessageKey;
  icon: LucideIcon;
  description: MessageKey;
  end?: boolean;
}

/** Five primary destinations — one per core experience. */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/app', label: 'nav.mission', short: 'nav.missionShort', icon: Target, description: 'nav.missionDesc', end: true },
  { to: '/app/universe', label: 'nav.universe', icon: Orbit, description: 'nav.universeDesc' },
  { to: '/app/journey', label: 'nav.journey', icon: Route, description: 'nav.journeyDesc' },
  { to: '/app/discover', label: 'nav.discover', icon: Telescope, description: 'nav.discoverDesc' },
  { to: '/app/progress', label: 'nav.progress', icon: ChartNoAxesCombined, description: 'nav.progressDesc' },
];
