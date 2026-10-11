import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, RefreshCw, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/primitives';
import { errorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-green-strong dark:text-green">{eyebrow}</div>}
        <h1 className="text-[28px] font-bold leading-tight sm:text-[34px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ icon: Icon, title, action, className }: { icon?: LucideIcon; title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="flex items-center gap-2 text-[17px] font-semibold">
        {Icon && <Icon className="size-[18px] text-green" />}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-16', className)}
    >
      <div className="relative mb-4">
        <div className="absolute inset-0 -m-3 rounded-full bg-muted-green blur-xl" aria-hidden />
        <div className="relative flex size-12 items-center justify-center rounded-2xl border border-border bg-surface shadow-card">
          <Icon className="size-5 text-green" />
        </div>
      </div>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const { t } = useT();
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-muted-danger">
        <AlertTriangle className="size-5 text-danger" />
      </div>
      <h3 className="font-semibold">{t('state.errorTitle')}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw /> {t('common.tryAgain')}
        </Button>
      )}
    </div>
  );
}

/** Loading state that names the real operation being performed. */
export function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground', className)} role="status">
      <OrbitLoader />
      <span>{label}</span>
    </div>
  );
}

export function OrbitLoader({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex size-9', className)} aria-hidden>
      <span className="absolute inset-0 rounded-full border-2 border-border" />
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-green" style={{ animationDuration: '0.9s' }} />
      <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full bg-orange" style={{ animationDuration: '1.6s', transformOrigin: '50% calc(50% + 18px)' }} />
    </span>
  );
}

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('card space-y-3 p-5', className)} aria-hidden>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function StatTile({ icon: Icon, label, value, hint, tone = 'green' }: { icon: LucideIcon; label: string; value: ReactNode; hint?: string; tone?: 'green' | 'orange' | 'neutral' }) {
  return (
    <div className="card flex items-center gap-3.5 p-4">
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          tone === 'green' ? 'bg-muted-green text-green-strong dark:text-green' : tone === 'orange' ? 'bg-muted-orange text-orange-strong dark:text-orange' : 'bg-surface-2 text-muted-foreground',
        )}
      >
        <Icon className="size-[18px]" />
      </div>
      <div className="min-w-0">
        <div className="font-display text-[22px] font-bold leading-none tabular">{value}</div>
        <div className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground" title={label}>
          {label}
        </div>
        {hint && <div className="truncate text-[11.5px] text-subtle-foreground">{hint}</div>}
      </div>
    </div>
  );
}

/** Horizontal labelled score bar (match components, readiness categories). */
export function ScoreBar({ label, value, tone = 'green', detail }: { label: string; value: number; tone?: 'green' | 'orange' | 'gradient'; detail?: string }) {
  const bar = tone === 'orange' ? 'bg-orange' : tone === 'gradient' ? 'orbit-gradient' : 'bg-green';
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="font-semibold tabular">{Math.round(value)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div className={cn('h-full rounded-full', bar)} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      {detail && <p className="mt-1 text-[12px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function FadeIn({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}
