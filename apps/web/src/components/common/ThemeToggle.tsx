import { AnimatePresence, motion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { Tooltip } from '@/components/ui/overlays';
import { useResolvedTheme, useUiStore } from '@/stores/ui';
import { useT } from '@/lib/i18n';
import { centerOf, cn } from '@/lib/utils';

/**
 * One-click light/dark switch. "System" stays available in the account menu and Settings;
 * clicking here always pins an explicit choice.
 */
export function ThemeToggle({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'onDark' }) {
  const resolved = useResolvedTheme();
  const setTheme = useUiStore((s) => s.setTheme);
  const { t } = useT();
  const next = resolved === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? t('theme.switchToDark') : t('theme.switchToLight');

  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={(e) => setTheme(next, centerOf(e.currentTarget))}
        aria-label={label}
        className={cn(
          'relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]',
          tone === 'onDark' ? 'text-white/75 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
          className,
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={resolved}
            initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex"
          >
            {resolved === 'dark' ? <Moon className="size-[19px]" /> : <Sun className="size-[19px]" />}
          </motion.span>
        </AnimatePresence>
      </button>
    </Tooltip>
  );
}
