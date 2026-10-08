import { Suspense, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  BellRing,
  BrainCircuit,
  CalendarClock,
  CheckCheck,
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
import { PRIMARY_NAV } from './nav';
import { useMe, useMissionControl, useNotificationMutations, useNotifications } from '@/hooks/queries';
import { useSessionStore } from '@/stores/session';
import { useUiStore, type ThemePreference } from '@/stores/ui';
import { signOut } from '@/lib/auth';
import { centerOf, cn, relative } from '@/lib/utils';

export function AppShell() {
  const location = useLocation();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

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
        Skip to content
      </a>
      <Sidebar />
      <div className="lg:pl-[252px]">
        <Header />
        <main id="main" className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">
          <Suspense fallback={<LoadingState label="Loading…" />}>
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

function Sidebar() {
  const { data: mission } = useMissionControl();
  const user = useSessionStore((s) => s.user);
  const level = mission?.level;
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-border bg-surface lg:flex" aria-label="Primary">
      <div className="flex h-16 items-center px-5">
        <NavLink to="/app" aria-label="Orbit home">
          <Logo />
        </NavLink>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 pt-2">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition',
                isActive ? 'bg-muted-green text-green-strong dark:text-green' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-active" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-green" />}
                <item.icon className="size-[18px]" />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {mission?.primaryGoal && (
        <div className="mx-3 mb-3 rounded-xl border border-border bg-surface-2/60 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Primary orbit</p>
            {mission.readiness && <ReadinessPill score={mission.readiness.score} className="px-2 py-0.5 text-[11px]" />}
          </div>
          <p className="mt-1.5 truncate text-[14px] font-semibold" title={mission.primaryGoal.role.title}>
            {mission.primaryGoal.role.title}
          </p>
          {level && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11.5px] text-muted-foreground">
                <span>Orbit Level {level.level}</span>
                <span className="tabular">
                  {level.xp - level.currentLevelXp}/{level.nextLevelXp - level.currentLevelXp} XP
                </span>
              </div>
              <Progress value={level.progress} tone="gradient" className="h-1.5" label="Progress to next Orbit Level" />
            </div>
          )}
        </div>
      )}

      <div className="space-y-0.5 border-t border-border px-3 py-3">
        <NavLink
          to="/app/profile"
          className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition', isActive ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground')}
        >
          <Avatar name={user?.name ?? 'You'} className="size-6 text-[10px]" />
          <span className="truncate">Profile</span>
        </NavLink>
        <NavLink
          to="/app/settings"
          className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition', isActive ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground')}
        >
          <Settings className="size-[18px]" />
          Settings
        </NavLink>
      </div>
    </aside>
  );
}

function Header() {
  const openAgent = useUiStore((s) => s.openAgent);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <NavLink to="/app" className="lg:hidden" aria-label="Orbit home">
          <Logo compact />
        </NavLink>
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border bg-surface px-3 text-left text-sm text-subtle-foreground shadow-[0_1px_2px_rgba(16,23,20,0.04)] transition hover:border-border-strong sm:max-w-[420px]"
          aria-label="Search Orbit"
        >
          <Search className="size-4 shrink-0" />
          <span className="truncate">Search skills, jobs, quests, people…</span>
          <span className="ml-auto hidden items-center gap-1 sm:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <NotificationsButton />
          <Button variant="gradient" size="md" onClick={() => openAgent()} className="hidden sm:inline-flex" aria-label="Ask Orbit">
            <Sparkles /> Ask Orbit
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
  const unread = data?.unread ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex size-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-surface-2 hover:text-foreground" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          {unread ? <BellRing className="size-[19px]" /> : <Bell className="size-[19px]" />}
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex min-w-[17px] items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold leading-[17px] text-white">{unread > 9 ? '9+' : unread}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(380px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">Deadlines, reminders and insights</p>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => readAll.mutate()}>
              <CheckCheck /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
          {(data?.items.length ?? 0) === 0 && (data?.scheduled.length ?? 0) === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">You are all caught up. Orbit will remind you about deadlines and events here.</div>
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
                    <CalendarClock className="size-3.5" /> Scheduled reminders
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
  const themes: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]" aria-label="Account menu">
          <Avatar name={me?.user.name ?? user?.name ?? 'You'} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-semibold text-foreground">{me?.user.name ?? user?.name}</span>
          <span className="block truncate">{me?.user.email ?? user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/app/profile')}>
          <UserRound /> Profile & Career DNA
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/app/settings')}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="flex gap-1 px-1.5 py-1" role="radiogroup" aria-label="Theme">
          {themes.map((t) => (
            <Tooltip key={t.value} content={t.label}>
              <button
                role="radio"
                aria-checked={theme === t.value}
                aria-label={`${t.label} theme`}
                onClick={(e) => setTheme(t.value, centerOf(e.currentTarget))}
                className={cn('flex h-8 flex-1 items-center justify-center rounded-lg transition', theme === t.value ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:bg-surface-2')}
              >
                <t.icon className="size-4" />
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
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNav() {
  const openAgent = useUiStore((s) => s.openAgent);
  return (
    <>
      <button
        onClick={() => openAgent()}
        className="orbit-gradient fixed bottom-[84px] right-4 z-30 flex size-14 items-center justify-center rounded-2xl text-white shadow-[0_12px_32px_-10px_rgba(10,180,106,0.9)] sm:hidden"
        aria-label="Ask Orbit"
      >
        <BrainCircuit className="size-6" />
      </button>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label="Primary mobile"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn('flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition', isActive ? 'text-green-strong dark:text-green' : 'text-muted-foreground')}
            >
              <item.icon className="size-5" />
              <span className="truncate">{item.label === 'Mission Control' ? 'Today' : item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
