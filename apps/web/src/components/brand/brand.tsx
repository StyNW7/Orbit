import { useEffect, useId, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { bandKey } from '@/lib/i18n/labels';

/** Orbit mark: a core, an orbit path and an orange "next step" planet. */
export function OrbitMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8', className)} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0AB46A" />
      <g className={animated ? 'origin-center animate-orbit-spin' : undefined} style={{ transformBox: 'fill-box' }}>
        <ellipse cx="32" cy="32" rx="22" ry="9" transform="rotate(-28 32 32)" stroke="#fff" strokeOpacity=".55" strokeWidth="3" fill="none" />
        <circle cx="50" cy="21" r="5" fill="#FB9002" />
      </g>
      <circle cx="32" cy="32" r="9" fill="#fff" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <OrbitMark />
      {!compact && <span className="font-display text-[19px] font-bold tracking-tight text-foreground">Orbit</span>}
    </span>
  );
}

/** Animated number for readiness, XP and other metrics. */
export function AnimatedNumber({ value, decimals = 0, className, suffix = '' }: { value: number; decimals?: number; className?: string; suffix?: string }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${v.toFixed(decimals)}${suffix}`);
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [mv, value]);
  return <motion.span className={cn('tabular', className)}>{text}</motion.span>;
}

/** Career Readiness gauge with the Orbit gradient. */
export function ReadinessRing({
  score,
  size = 168,
  stroke = 12,
  label,
  showBand = true,
  className,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  showBand?: boolean;
  className?: string;
}) {
  const id = useId();
  const { t } = useT();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setDrawn(Math.max(0, Math.min(100, score))));
    return () => cancelAnimationFrame(t);
  }, [score]);
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t('readiness.percent', { label: label ?? t('readiness.label'), score: Math.round(score) })}>
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0AB46A" />
            <stop offset="55%" stopColor="#51C868" />
            <stop offset="100%" stopColor="#FB9002" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#g-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (drawn / 100) * c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display font-bold leading-none tracking-tight" style={{ fontSize: size * 0.24 }}>
          <AnimatedNumber value={score} />
          <span className="text-[0.5em] font-semibold text-muted-foreground">%</span>
        </span>
        {showBand && size >= 120 && <span className="mt-1.5 text-[12px] font-medium text-muted-foreground">{t(bandKey(score))}</span>}
      </div>
    </div>
  );
}

/** Small inline readiness pill. */
export function ReadinessPill({ score, className }: { score: number; className?: string }) {
  const { t } = useT();
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-muted-green px-2.5 py-1 text-xs font-semibold text-green-strong dark:text-green', className)}>
      <span className="size-1.5 rounded-full bg-green" />
      <span className="tabular">{t('readiness.pill', { score: Math.round(score) })}</span>
    </span>
  );
}
