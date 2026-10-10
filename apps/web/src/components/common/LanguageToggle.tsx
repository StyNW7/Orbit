import { useId } from 'react';
import { motion } from 'motion/react';
import { Languages } from 'lucide-react';
import { Tooltip } from '@/components/ui/overlays';
import { LOCALES, useI18nStore, useT, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * EN | ID segmented switch. `compact` shows a single button that flips between the two
 * (used in tight headers on phones); the default shows both options with a sliding thumb.
 */
export function LanguageToggle({ className, compact = false, tone = 'default' }: { className?: string; compact?: boolean; tone?: 'default' | 'onDark' }) {
  const { t, locale } = useT();
  const setLocale = useI18nStore((s) => s.setLocale);
  const uid = useId();

  if (compact) {
    const next: Locale = locale === 'en' ? 'id' : 'en';
    return (
      <Tooltip content={t('lang.switch')}>
        <button
          type="button"
          onClick={() => setLocale(next)}
          aria-label={`${t('lang.switch')}: ${LOCALES.find((l) => l.value === next)?.label}`}
          className={cn(
            'flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-[12.5px] font-bold tracking-wide transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]',
            tone === 'onDark' ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
            className,
          )}
        >
          <Languages className="size-[17px]" />
          {locale.toUpperCase()}
        </button>
      </Tooltip>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('lang.label')}
      className={cn(
        'relative inline-flex h-9 shrink-0 items-center rounded-xl border p-0.5',
        tone === 'onDark' ? 'border-white/15 bg-white/5' : 'border-border bg-surface-2',
        className,
      )}
    >
      {LOCALES.map((l) => {
        const active = l.value === locale;
        return (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={l.label}
            title={l.label}
            onClick={() => setLocale(l.value)}
            className={cn(
              'relative z-10 flex h-full min-w-[38px] items-center justify-center rounded-[9px] px-2 text-[12px] font-bold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              active ? (tone === 'onDark' ? 'text-[#0d1512]' : 'text-foreground') : tone === 'onDark' ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId={`lang-thumb-${uid}`}
                className={cn('absolute inset-0 -z-10 rounded-[9px] shadow-[0_1px_3px_rgba(16,23,20,0.12)]', tone === 'onDark' ? 'bg-white' : 'bg-surface')}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            {l.short}
          </button>
        );
      })}
    </div>
  );
}
