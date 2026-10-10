import { BookOpen, BriefcaseBusiness, CalendarDays, GraduationCap, Lightbulb, Route, Target, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';

interface OrbitNode {
  label: MessageKey;
  icon: LucideIcon;
  angle: number;
  tone: 'green' | 'orange' | 'neutral';
}

const RINGS: { size: number; duration: number; reverse?: boolean; nodes: OrbitNode[] }[] = [
  {
    size: 46,
    duration: 46,
    nodes: [
      { label: 'orbitSystem.leadership', icon: Lightbulb, angle: 20, tone: 'green' },
      { label: 'orbitSystem.analytics', icon: Target, angle: 200, tone: 'orange' },
    ],
  },
  {
    size: 70,
    duration: 70,
    reverse: true,
    nodes: [
      { label: 'orbitSystem.internship', icon: BriefcaseBusiness, angle: 110, tone: 'orange' },
      { label: 'orbitSystem.caseStudy', icon: Route, angle: 290, tone: 'green' },
      { label: 'orbitSystem.workshop', icon: CalendarDays, angle: 0, tone: 'neutral' },
    ],
  },
  {
    size: 94,
    duration: 100,
    nodes: [
      { label: 'orbitSystem.roleModel', icon: Users, angle: 60, tone: 'neutral' },
      { label: 'orbitSystem.book', icon: BookOpen, angle: 165, tone: 'neutral' },
      { label: 'orbitSystem.course', icon: GraduationCap, angle: 250, tone: 'green' },
    ],
  },
];

/**
 * Animated Career Universe illustration: you at the centre, skills, quests,
 * opportunities, knowledge and people in orbit. Pure CSS animation.
 */
export function OrbitSystem({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { t } = useT();
  return (
    <div className={cn('relative mx-auto aspect-square w-full', className)} aria-hidden>
      <div className="absolute inset-[18%] rounded-full bg-[#0AB46A]/15 blur-3xl" />
      {RINGS.map((ring, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: `${ring.size}%`, height: `${ring.size}%` }}
        >
          <div className={cn('absolute inset-0 rounded-full border border-dashed', compact ? 'border-white/15' : 'border-[var(--border-strong)]')} />
          <div className="absolute inset-0" style={{ animation: `orbit-spin ${ring.duration}s linear infinite${ring.reverse ? ' reverse' : ''}` }}>
            {ring.nodes.map((n) => {
              const rad = (n.angle * Math.PI) / 180;
              const x = 50 + 50 * Math.cos(rad);
              const y = 50 + 50 * Math.sin(rad);
              return (
                <div key={n.label} className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
                  <div style={{ animation: `orbit-spin ${ring.duration}s linear infinite${ring.reverse ? '' : ' reverse'}` }}>
                    <div
                      className={cn(
                        'flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-[0_8px_20px_-10px_rgba(0,0,0,0.35)] sm:text-[12px]',
                        compact ? 'border-white/10 bg-white/10 text-white backdrop-blur' : 'border-border bg-surface text-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-full',
                          n.tone === 'green' ? 'bg-[#0AB46A] text-white' : n.tone === 'orange' ? 'bg-[#FB9002] text-white' : compact ? 'bg-white/20 text-white' : 'bg-surface-2 text-muted-foreground',
                        )}
                      >
                        <n.icon className="size-3" />
                      </span>
                      {t(n.label)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <div className="relative">
          <div className="absolute inset-0 -m-4 animate-pulse rounded-full bg-[#0AB46A]/25 blur-md" />
          <div className="orbit-gradient relative flex size-16 items-center justify-center rounded-full text-sm font-bold text-white shadow-[0_12px_40px_-8px_rgba(10,180,106,0.9)] sm:size-20 sm:text-base">
            {t('orbitSystem.you')}
          </div>
        </div>
      </div>
    </div>
  );
}
