import { Suspense, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  BellRing,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  Check,
  CheckCheck,
  Languages,
  LogOut,
  Monitor,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserRound,
} from 'lucide-react';
import { Logo, ReadinessPill } from '@/components/brand/brand';
import { Button } from '@/components/ui/button';
import { Avatar, Kbd, Progress } from '@/components/ui/primitives';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '@/components/ui/overlays';
import { LoadingState } from '@/components/common/states';
import { AgentDrawer } from '@/components/agent/AgentDrawer';
import { CommandPalette } from './CommandPalette';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LanguageToggle } from '@/components/common/LanguageToggle';
import { PRIMARY_NAV } from './nav';
import { useMe, useMissionControl, useNotificationMutations, useNotifications } from '@/hooks/queries';
import { useSessionStore } from '@/stores/session';
import { useUiStore, type ThemePreference } from '@/stores/ui';
import { LOCALES, useI18nStore, useT } from '@/lib/i18n';
import { signOut } from '@/lib/auth';
import { centerOf, cn, relative } from '@/lib/utils';

// Apple keyboards show ⌘ for the command-palette shortcut; everyone else sees Ctrl.
const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';

export function AppShell() {
  const location = useLocation();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const { t } = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCommandOpen]);

  useEffect(() => {
    // Route changes jump to the top instantly; smooth scrolling is for in-page navigation.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-pop">
        {t('shell.skip')}
      </a>
      <Sidebar />
      <div className="lg:pl-[256px]">
        <Header />
        <main id="main" className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">
          <Suspense fallback={<LoadingState label={t('common.loading')} />}>
            <AnimatePresence mode="wait">
              <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
      <MobileNav />
      <AgentDrawer />
      <CommandPalette />
    </div>
  );
}

const secondaryLink = ({ isActive }: { isActive: boolean }) =>
  cn('flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition', isActive ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground');

function Sidebar() {
  const { data: mission } = useMissionControl();
  const user = useSessionStore((s) => s.user);
  const { t } = useT();
  const level = mission?.level;
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[256px] flex-col border-r border-border bg-surface lg:flex" aria-label={t('nav.primary')}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top_left,rgba(10,180,106,0.09),transparent_70%)]" aria-hidden />
      <div className="relative flex h-16 items-center px-5">
        <NavLink to="/app" aria-label={t('shell.home')}>
          <Logo />
        </NavLink>
      </div>
      <nav className="relative flex-1 space-y-0.5 px-3 pt-2">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
                isActive ? 'bg-muted-green text-green-strong dark:text-green' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-active" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-green" />}
                <item.icon className="size-[18px] shrink-0" />
                <span className="min-w-0">
                  <span className="block leading-tight">{t(item.label)}</span>
                  <span className={cn('block truncate text-[11.5px] font-normal leading-tight', isActive ? 'text-green-strong/70 dark:text-green/70' : 'text-subtle-foreground')}>{t(item.description)}</span>
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {mission?.primaryGoal && (
        <div className="relative mx-3 mb-3 overflow-hidden rounded-2xl border border-border bg-surface-2/60 p-3.5">
          <div className="pointer-events-none absolute -right-8 -top-10 size-24 rounded-full bg-[radial-gradient(circle,rgba(251,144,2,0.16),transparent_65%)]" aria-hidden />
          <div className="relative flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t('shell.primaryOrbit')}</p>
            {mission.readiness && <ReadinessPill score={mission.readiness.score} className="px-2 py-0.5 text-[11px]" />}
          </div>
          <p className="relative mt-1.5 truncate text-[14px] font-semibold" title={mission.primaryGoal.role.title}>
            {mission.primaryGoal.role.title}
          </p>
          {level && (
            <div className="relative mt-3">
              <div className="mb-1 flex justify-between text-[11.5px] text-muted-foreground">
                <span>{t('shell.level', { level: level.level })}</span>
                <span className="tabular">
                  {level.xp - level.currentLevelXp}/{level.nextLevelXp - level.currentLevelXp} XP
                </span>
              </div>
              <Progress value={level.progress} tone="gradient" className="h-1.5" label={t('shell.levelProgress')} />
            </div>
          )}
        </div>
      )}

      <div className="relative space-y-0.5 border-t border-border px-3 py-3">
        <NavLink to="/app/profile" className={secondaryLink}>
          <Avatar name={user?.name ?? t('shell.you')} className="size-6 text-[10px]" />
          <span className="truncate">{t('nav.profile')}</span>
        </NavLink>
        <NavLink to="/app/guide" className={secondaryLink}>
          <BookOpenCheck className="size-[18px]" />
          {t('nav.guide')}
        </NavLink>
        <NavLink to="/app/settings" className={secondaryLink}>
          <Settings className="size-[18px]" />
          {t('nav.settings')}
        </NavLink>
      </div>
    </aside>
  );
}

function Header() {
  const openAgent = useUiStore((s) => s.openAgent);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const { t } = useT();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <NavLink to="/app" className="lg:hidden" aria-label={t('shell.home')}>
          <Logo compact />
        </NavLink>
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex size-10 shrink-0 items-center justify-center gap-2.5 rounded-xl border border-border bg-surface text-left text-sm text-subtle-foreground shadow-[0_1px_2px_rgba(16,23,20,0.04)] transition hover:border-border-strong sm:h-10 sm:w-auto sm:min-w-0 sm:max-w-[420px] sm:flex-1 sm:shrink sm:justify-start sm:px-3"
          aria-label={t('shell.searchLabel')}
        >
          <Search className="size-4 shrink-0" />
          <span className="hidden truncate sm:inline">{t('shell.search')}</span>
          <span className="ml-auto hidden items-center gap-1 sm:flex">
            <Kbd>{MOD_KEY}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <LanguageToggle className="hidden md:inline-flex" />
          <LanguageToggle compact className="md:hidden" />
          <ThemeToggle />
          <NotificationsButton />
          <Button variant="gradient" size="md" onClick={() => openAgent()} className="hidden sm:inline-flex" aria-label={t('common.askOrbit')}>
            <Sparkles /> {t('common.askOrbit')}
          </Button>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function NotificationsButton() {
  const { data } = useNotifications();
  const { read, readAll } = useNotificationMutations();
  const navigate = useNavigate();
  const { t } = useT();
  const unread = data?.unread ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative flex size-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
          aria-label={unread ? t('shell.notificationsUnread', { count: unread }) : t('shell.notifications')}
        >
          {unread ? <BellRing className="size-[19px]" /> : <Bell className="size-[19px]" />}
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex min-w-[17px] items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold leading-[17px] text-white">{unread > 9 ? '9+' : unread}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(380px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold">{t('shell.notifications')}</p>
            <p className="text-xs text-muted-foreground">{t('shell.notificationsDesc')}</p>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => readAll.mutate()}>
              <CheckCheck /> {t('shell.markAllRead')}
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
          {(data?.items.length ?? 0) === 0 && (data?.scheduled.length ?? 0) === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-3 size-6 text-subtle-foreground" />
              {t('shell.caughtUp')}
            </div>
          ) : (
            <>
              {data?.items.map((n) => (
                <button
                  key={n.id}
                  className={cn('flex w-full gap-3 border-b border-border px-4 py-3 text-left transition last:border-0 hover:bg-surface-2', n.status === 'DELIVERED' && 'bg-muted-green/40')}
                  onClick={() => {
                    if (n.status === 'DELIVERED') read.mutate(n.id);
                    if (n.actionUrl) navigate(n.actionUrl);
                  }}
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.status === 'DELIVERED' ? 'bg-orange' : 'bg-transparent')} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium leading-snug">{n.title}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{n.message}</span>
                    <span className="mt-1 block text-[11.5px] text-subtle-foreground">{relative(n.scheduledAt)}</span>
                  </span>
                </button>
              ))}
              {data && data.scheduled.length > 0 && (
                <div className="bg-surface-2/60 px-4 py-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <CalendarClock className="size-3.5" /> {t('shell.scheduled')}
                  </p>
                  {data.scheduled.slice(0, 4).map((n) => (
                    <div key={n.id} className="flex items-center justify-between gap-3 py-1 text-[12.5px]">
                      <span className="truncate">{n.title}</span>
                      <span className="shrink-0 text-subtle-foreground">{relative(n.scheduledAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const user = useSessionStore((s) => s.user);
  const { data: me } = useMe();
  const navigate = useNavigate();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const setLocale = useI18nStore((s) => s.setLocale);
  const { t, locale } = useT();
  const themes: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: t('theme.light'), icon: Sun },
    { value: 'dark', label: t('theme.dark'), icon: Moon },
    { value: 'system', label: t('theme.system'), icon: Monitor },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]" aria-label={t('shell.accountMenu')}>
          <Avatar name={me?.user.name ?? user?.name ?? t('shell.you')} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-semibold text-foreground">{me?.user.name ?? user?.name}</span>
          <span className="block truncate">{me?.user.email ?? user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/app/profile')}>
          <UserRound /> {t('shell.profileDna')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/app/guide')}>
          <BookOpenCheck /> {t('shell.howItWorks')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/app/settings')}>
          <Settings /> {t('nav.settings')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5">
          <Languages className="size-3.5" /> {t('lang.label')}
        </DropdownMenuLabel>
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l.value} onSelect={() => setLocale(l.value)}>
            <span className="flex w-6 justify-center text-[11px] font-bold text-muted-foreground">{l.short}</span>
            <span className="flex-1">{l.label}</span>
            {locale === l.value && <Check className="!text-green" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="flex gap-1 px-1.5 py-1" role="radiogroup" aria-label={t('theme.label')}>
          {themes.map((th) => (
            <Tooltip key={th.value} content={th.label}>
              <button
                role="radio"
                aria-checked={theme === th.value}
                aria-label={th.label}
                onClick={(e) => setTheme(th.value, centerOf(e.currentTarget))}
                className={cn('flex h-8 flex-1 items-center justify-center rounded-lg transition', theme === th.value ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:bg-surface-2')}
              >
                <th.icon className="size-4" />
              </button>
            </Tooltip>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void signOut().then(() => navigate('/'));
          }}
        >
          <LogOut /> {t('common.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNav() {
  const openAgent = useUiStore((s) => s.openAgent);
  const { t } = useT();
  return (
    <>
      <button
        onClick={() => openAgent()}
        className="orbit-gradient fixed bottom-[84px] right-4 z-30 flex size-14 items-center justify-center rounded-2xl text-white shadow-[0_12px_32px_-10px_rgba(10,180,106,0.9)] sm:hidden"
        aria-label={t('common.askOrbit')}
      >
        <BrainCircuit className="size-6" />
      </button>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label={t('nav.primaryMobile')}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn('relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition', isActive ? 'text-green-strong dark:text-green' : 'text-muted-foreground')}
            >
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="mobile-nav-active" className="absolute inset-x-5 top-0 h-[2px] rounded-full bg-green" />}
                  <item.icon className="size-5" />
                  <span className="max-w-full truncate px-0.5">{t(item.short ?? item.label)}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
