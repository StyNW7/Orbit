import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Dna,
  Flag,
  GraduationCap,
  Languages,
  Layers,
  MessagesSquare,
  Network,
  Orbit as OrbitIcon,
  Rocket,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Telescope,
  TrendingUp,
  Upload,
  Users,
  Zap,
} from 'lucide-react';
import { Logo, ReadinessRing } from '@/components/brand/brand';
import { Button } from '@/components/ui/button';
import { Badge, Progress } from '@/components/ui/primitives';
import { useSessionStore } from '@/stores/session';
import { useT, type MessageKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { OrbitSystem } from './OrbitSystem';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LanguageToggle } from '@/components/common/LanguageToggle';

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

function SectionHead({ eyebrow, title, description, center = true }: { eyebrow: string; title: ReactNode; description?: string; center?: boolean }) {
  return (
    <Reveal className={cn('mb-12 max-w-2xl', center && 'mx-auto text-center')}>
      <p className="inline-flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-green-strong dark:text-green">
        <span className="h-px w-5 bg-current opacity-60" aria-hidden />
        {eyebrow}
        <span className="h-px w-5 bg-current opacity-60" aria-hidden />
      </p>
      <h2 className="mt-3 text-[32px] font-bold leading-[1.15] sm:text-[42px]">{title}</h2>
      {description && <p className="mt-4 text-[16px] text-muted-foreground sm:text-[17px]">{description}</p>}
    </Reveal>
  );
}

const LANDING_SECTIONS: { id: string; label: MessageKey }[] = [
  { id: 'how', label: 'landing.nav.how' },
  { id: 'universe', label: 'landing.nav.universe' },
  { id: 'capabilities', label: 'landing.nav.capabilities' },
  { id: 'agent', label: 'landing.nav.agent' },
  { id: 'faq', label: 'landing.nav.faq' },
];

/** Header state: whether the page has scrolled, and which section is under the nav (scroll-spy). */
function useLandingScroll() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      // A thin band just below the sticky header decides which section is "current".
      { rootMargin: '-72px 0px -70% 0px' },
    );
    const sections = LANDING_SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => Boolean(el));
    sections.forEach((el) => observer.observe(el));
    const clearAtTop = () => window.scrollY < (sections[0]?.offsetTop ?? 0) - 120 && setActive(null);
    window.addEventListener('scroll', clearAtTop, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', clearAtTop);
      observer.disconnect();
    };
  }, []);
  return { scrolled, active };
}

export default function LandingPage() {
  const authed = Boolean(useSessionStore((s) => s.token));
  const { scrolled, active } = useLandingScroll();
  const { t } = useT();
  return (
    // overflow-x-clip (not hidden) keeps the page from becoming its own scroll container, so the sticky nav works.
    <div className="min-h-dvh overflow-x-clip bg-background">
      {/* Nav — sticky; gains a border and shadow once the page scrolls */}
      <header
        className={cn(
          'sticky top-0 z-40 border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300',
          scrolled ? 'border-border bg-background/85 shadow-[0_8px_24px_-18px_rgba(16,23,20,0.35)]' : 'border-transparent bg-background/60',
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 sm:px-6 lg:gap-6">
          <Link
            to="/"
            aria-label={t('shell.home')}
            onClick={(e) => {
              // Already on the landing page: glide back to the top instead of re-navigating.
              e.preventDefault();
              window.scrollTo({ top: 0 });
              history.replaceState(null, '', '/');
            }}
          >
            <Logo />
          </Link>
          <nav className="hidden items-center gap-0.5 text-[14px] font-medium lg:flex" aria-label={t('landing.navLabel')}>
            {LANDING_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={active === section.id ? 'location' : undefined}
                className={cn('relative rounded-lg px-3 py-1.5 transition-colors', active === section.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {t(section.label)}
                {active === section.id && <motion.span layoutId="landing-nav-active" className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-green" transition={{ duration: 0.25 }} />}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <LanguageToggle className="hidden sm:inline-flex" />
            <LanguageToggle compact className="sm:hidden" />
            <ThemeToggle />
            {authed ? (
              <Button asChild>
                <Link to="/app">
                  {t('landing.openOrbit')} <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild className="hidden md:inline-flex">
                  <Link to="/signin">{t('common.signIn')}</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup">{t('landing.buildMyOrbit')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] bg-[radial-gradient(ellipse_70%_60%_at_70%_20%,rgba(10,180,106,0.14),transparent_60%),radial-gradient(ellipse_50%_40%_at_95%_50%,rgba(251,144,2,0.11),transparent_60%)]" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] opacity-50 grid-dots [mask-image:radial-gradient(ellipse_60%_55%_at_50%_30%,black,transparent)]" aria-hidden />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Badge tone="green" className="rounded-full px-3 py-1 text-[12.5px]">
                <Sparkles /> {t('landing.badge')}
              </Badge>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-6 text-[42px] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-[58px] lg:text-[64px]">
              {t('landing.heroTitleA')} <span className="orbit-gradient-text">{t('landing.heroTitleB')}</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]">
              {t('landing.heroBodyA')} <span className="font-semibold text-foreground">{t('landing.heroBodyB')}</span>
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" variant="gradient" asChild>
                <Link to={authed ? '/app' : '/signup'}>
                  {t('landing.buildMyOrbit')} <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href="#how">{t('landing.explore')}</a>
              </Button>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-green" /> {t('landing.trust.confirm')}
              </span>
              <span className="flex items-center gap-1.5">
                <ChartNoAxesCombined className="size-4 text-green" /> {t('landing.trust.explainable')}
              </span>
              <span className="flex items-center gap-1.5">
                <BrainCircuit className="size-4 text-green" /> {t('landing.trust.stack')}
              </span>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.7 }} className="relative mx-auto w-full max-w-[540px]">
            <OrbitSystem />
            <div className="absolute -left-2 top-6 hidden animate-float sm:block">
              <div className="card flex items-center gap-3 p-3 pr-4 backdrop-blur">
                <ReadinessRing score={74} size={56} stroke={6} showBand={false} />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t('landing.float.readiness')}</p>
                  <p className="text-[14px] font-bold">{t('landing.float.role')}</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-2 bottom-8 hidden max-w-[240px] sm:block" style={{ animation: 'float 7s ease-in-out infinite 1s' }}>
              <div className="card p-3.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-orange-strong dark:text-orange">
                  <Sparkles className="size-3.5" /> {t('landing.float.nba')}
                </p>
                <p className="mt-1 text-[14px] font-semibold leading-snug">{t('landing.float.nbaTitle')}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{t('landing.float.nbaImpact')}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats strip */}
        <div className="relative mx-auto max-w-[1200px] px-4 pb-16 sm:px-6">
          <Reveal>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-card md:grid-cols-4">
              {(
                [
                  ['5', 'landing.stats.roles', Compass],
                  ['6', 'landing.stats.signals', Target],
                  ['14', 'landing.stats.tools', BrainCircuit],
                  ['2', 'landing.stats.languages', Languages],
                ] as const
              ).map(([value, label, Icon]) => (
                <div key={label} className="flex items-center gap-3.5 bg-surface px-5 py-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted-green text-green-strong dark:text-green">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <dt className="sr-only">{t(label)}</dt>
                    <dd className="font-display text-[26px] font-extrabold leading-none tabular">{value}</dd>
                    <dd className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{t(label)}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-border bg-surface py-20 sm:py-24">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <SectionHead eyebrow={t('landing.problem.eyebrow')} title={t('landing.problem.title')} description={t('landing.problem.desc')} />
          <div className="grid gap-4 md:grid-cols-3">
            {(
              [
                { icon: CircleHelp, q: 'landing.problem.q1', a: 'landing.problem.a1' },
                { icon: Compass, q: 'landing.problem.q2', a: 'landing.problem.a2' },
                { icon: Target, q: 'landing.problem.q3', a: 'landing.problem.a3' },
              ] as const
            ).map((c, i) => (
              <Reveal key={c.q} delay={i * 0.08}>
                <div className="card h-full p-6 transition hover:-translate-y-0.5 hover:shadow-pop">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-muted-orange text-orange-strong dark:text-orange">
                    <c.icon className="size-5" />
                  </div>
                  <p className="mt-4 font-display text-[18px] font-semibold">“{t(c.q)}”</p>
                  <p className="mt-2 text-[14.5px] text-muted-foreground">{t(c.a)}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2}>
            <p className="mx-auto mt-12 max-w-2xl text-center font-display text-[20px] font-semibold leading-snug sm:text-[24px]">
              {t('landing.problem.punchA')} <span className="orbit-gradient-text">{t('landing.problem.punchB')}</span> {t('landing.problem.punchC')}
            </p>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <SectionHead eyebrow={t('landing.how.eyebrow')} title={t('landing.how.title')} description={t('landing.how.desc')} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { icon: Dna, k: 's1' },
                { icon: Network, k: 's2' },
                { icon: Telescope, k: 's3' },
                { icon: Target, k: 's4' },
                { icon: Route, k: 's5' },
                { icon: Zap, k: 's6' },
                { icon: TrendingUp, k: 's7' },
                { icon: OrbitIcon, k: 's8' },
              ] as const
            ).map((s, i) => (
              <Reveal key={s.k} delay={(i % 4) * 0.06}>
                <div className="card group relative h-full p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
                  <span className="absolute right-4 top-4 font-display text-[13px] font-bold text-subtle-foreground tabular">{String(i + 1).padStart(2, '0')}</span>
                  <div className={cn('flex size-10 items-center justify-center rounded-xl transition group-hover:scale-105', i < 4 ? 'bg-muted-green text-green-strong dark:text-green' : 'bg-muted-orange text-orange-strong dark:text-orange')}>
                    <s.icon className="size-5" />
                  </div>
                  <p className="mt-4 font-semibold">{t(`landing.how.${s.k}` as MessageKey)}</p>
                  <p className="mt-1 text-[14px] text-muted-foreground">{t(`landing.how.${s.k}d` as MessageKey)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Universe preview */}
      <section id="universe" className="relative scroll-mt-20 overflow-hidden bg-[#0d1512] py-20 text-white sm:py-28">
        <div className="pointer-events-none absolute -left-32 top-10 size-[420px] rounded-full bg-[#0AB46A]/15 blur-[110px]" aria-hidden />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[#5fe0a0]">{t('landing.universe.eyebrow')}</p>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.15] text-white sm:text-[42px]">{t('landing.universe.title')}</h2>
            <p className="mt-4 text-[17px] text-white/65">{t('landing.universe.desc')}</p>
            <ul className="mt-8 space-y-3 text-[15px] text-white/80">
              {(['landing.universe.b1', 'landing.universe.b2', 'landing.universe.b3'] as const).map((k) => (
                <li key={k} className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#0AB46A]/20 text-[#5fe0a0]">
                    <Check className="size-3.5" />
                  </span>
                  {t(k)}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1} className="relative">
            <UniversePreview />
          </Reveal>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <SectionHead eyebrow={t('landing.cap.eyebrow')} title={t('landing.cap.title')} description={t('landing.cap.desc')} />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(
              [
                { icon: Dna, k: 'c1', tone: 'green' },
                { icon: Network, k: 'c2', tone: 'green' },
                { icon: Telescope, k: 'c3', tone: 'orange' },
                { icon: Route, k: 'c4', tone: 'orange' },
                { icon: BrainCircuit, k: 'c5', tone: 'green' },
              ] as const
            ).map((c, i) => (
              <Reveal key={c.k} delay={(i % 3) * 0.07} className={i === 4 ? 'md:col-span-2 lg:col-span-1' : undefined}>
                <div className="card group h-full p-6 transition hover:-translate-y-0.5 hover:shadow-pop">
                  <div className={cn('flex size-11 items-center justify-center rounded-xl transition group-hover:scale-105', c.tone === 'green' ? 'bg-muted-green text-green-strong dark:text-green' : 'bg-muted-orange text-orange-strong dark:text-orange')}>
                    <c.icon className="size-5" />
                  </div>
                  <p className="mt-4 font-display text-[19px] font-semibold">{t(`landing.cap.${c.k}` as MessageKey)}</p>
                  <p className="mt-2 text-[14.5px] text-muted-foreground">{t(`landing.cap.${c.k}d` as MessageKey)}</p>
                </div>
              </Reveal>
            ))}
            <Reveal delay={0.14} className="hidden lg:block">
              <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-xl bg-[#0f1a15] p-6 text-white shadow-pop">
                <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-[#0AB46A]/35 blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute -bottom-16 left-6 size-40 rounded-full bg-[#FB9002]/25 blur-3xl" aria-hidden />
                <p className="relative font-display text-[20px] font-semibold leading-snug">{t('landing.cap.desc')}</p>
                <Button variant="gradient" asChild className="relative mt-6 w-fit">
                  <Link to={authed ? '/app' : '/signup'}>
                    {t('landing.buildMyOrbit')} <ArrowRight />
                  </Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Journey + Opportunity */}
      <section className="border-y border-border bg-surface py-20 sm:py-28">
        <div className="mx-auto grid max-w-[1200px] gap-6 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <div className="card h-full p-6 sm:p-8">
              <Badge tone="green">
                <Route /> {t('landing.journey.badge')}
              </Badge>
              <h3 className="mt-4 text-[26px] font-bold leading-tight">{t('landing.journey.title')}</h3>
              <p className="mt-2 text-muted-foreground">{t('landing.journey.desc')}</p>
              <div className="mt-6 space-y-3">
                {(
                  [
                    ['landing.journey.m1', 100],
                    ['landing.journey.m2', 60],
                    ['landing.journey.m3', 35],
                    ['landing.journey.m4', 25],
                    ['landing.journey.m5', 10],
                    ['landing.journey.m6', 0],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-3">
                    <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-white', v === 100 ? 'bg-green' : v > 0 ? 'bg-orange' : 'bg-border-strong')}>
                      {v === 100 ? <Check className="size-3.5" /> : <Flag className="size-3" />}
                    </span>
                    <span className="w-36 shrink-0 truncate text-[14px] font-medium sm:w-40">{t(k)}</span>
                    <Progress value={v} tone={v === 100 ? 'green' : 'gradient'} className="h-1.5" />
                    <span className="w-10 text-right text-[12.5px] tabular text-muted-foreground">{v}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="card h-full p-6 sm:p-8">
              <Badge tone="orange">
                <BriefcaseBusiness /> {t('landing.opp.badge')}
              </Badge>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[22px] font-bold leading-tight">{t('landing.opp.title')}</h3>
                  <p className="text-muted-foreground">{t('landing.opp.meta')}</p>
                </div>
                <ReadinessRing score={87} size={86} stroke={8} showBand={false} label={t('job.matchLabel')} />
              </div>
              <div className="mt-5 space-y-3">
                {(
                  [
                    ['enum.jobMatch.roleAlignment', 92],
                    ['enum.jobMatch.skillMatch', 81],
                    ['enum.jobMatch.experienceMatch', 78],
                    ['enum.jobMatch.preferenceMatch', 96],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="font-medium">{t(k)}</span>
                      <span className="font-semibold tabular">{v}%</span>
                    </div>
                    <Progress value={v} className="h-1.5" />
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 text-[13.5px] sm:grid-cols-2">
                <div className="rounded-xl bg-muted-green/60 p-3">
                  <p className="font-semibold">{t('landing.opp.why')}</p>
                  <p className="text-muted-foreground">{t('landing.opp.whyList')}</p>
                </div>
                <div className="rounded-xl bg-muted-orange/60 p-3">
                  <p className="font-semibold">{t('landing.opp.missing')}</p>
                  <p className="text-muted-foreground">SQL · Product Analytics</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Agent + progress */}
      <section id="agent" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <SectionHead eyebrow={t('landing.agent.eyebrow')} title={t('landing.agent.title')} description={t('landing.agent.desc')} />
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <Reveal>
              <div className="card p-5 sm:p-6">
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-br-md bg-green px-4 py-2.5 text-[14px] text-white">{t('landing.agent.question')}</div>
                </div>
                <div className="mt-4 flex gap-3">
                  <span className="orbit-gradient flex size-7 shrink-0 items-center justify-center rounded-lg text-white">
                    <Sparkles className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-border bg-surface p-4 text-[14px]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{t('landing.agent.insight')}</p>
                    <p className="mt-1">{t('landing.agent.insightText')}</p>
                    <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{t('landing.agent.nba')}</p>
                    <p className="mt-1 font-semibold">{t('landing.agent.nbaText')}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {['get_user_context', 'analyze_career_gap', 'find_opportunities'].map((tool) => (
                        <span key={tool} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="ml-10 mt-3 rounded-xl border border-green/30 bg-muted-green/50 p-3.5">
                  <p className="text-[13.5px] font-semibold">{t('landing.agent.cardTitle')}</p>
                  <p className="text-[12.5px] text-muted-foreground">{t('landing.agent.cardDesc')}</p>
                  <div className="mt-2.5 flex gap-2">
                    <span className="inline-flex h-8 items-center rounded-lg bg-green px-3 text-[13px] font-medium text-white">{t('common.addToJourney')}</span>
                    <span className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium text-muted-foreground">{t('common.notNow')}</span>
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="card flex h-full flex-col p-6">
                <Badge tone="green" className="w-fit">
                  <ChartNoAxesCombined /> {t('landing.progress.badge')}
                </Badge>
                <p className="mt-4 font-display text-[40px] font-bold leading-none">
                  81<span className="text-[20px] text-muted-foreground">%</span>
                </p>
                <p className="text-muted-foreground">{t('landing.progress.caption')}</p>
                <div className="mt-4 h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[52, 55, 59, 61, 64, 68, 71, 74, 77, 81].map((v, i) => ({ i, v }))}>
                      <defs>
                        <linearGradient id="landingFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0AB46A" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#0AB46A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke="#0AB46A" strokeWidth={3} fill="url(#landingFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <ol className="mt-4 space-y-2 border-l-2 border-border pl-4 text-[13.5px]">
                  {(
                    [
                      ['landing.progress.t1m', 'landing.progress.t1'],
                      ['landing.progress.t2m', 'landing.progress.t2'],
                      ['landing.progress.t3m', 'landing.progress.t3'],
                    ] as const
                  ).map(([m, k]) => (
                    <li key={k} className="relative">
                      <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-green" />
                      <span className="font-semibold">{t(m)}</span> <span className="text-muted-foreground">· {t(k)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Get started */}
      <section className="border-y border-border bg-surface py-20 sm:py-24">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <SectionHead eyebrow={t('landing.start.eyebrow')} title={t('landing.start.title')} />
          <ol className="relative grid gap-4 md:grid-cols-3">
            <div className="pointer-events-none absolute left-[16%] right-[16%] top-[42px] hidden h-px border-t-2 border-dashed border-border-strong md:block" aria-hidden />
            {(
              [
                { icon: Upload, k: 's1' },
                { icon: Dna, k: 's2' },
                { icon: Rocket, k: 's3' },
              ] as const
            ).map((s, i) => (
              <Reveal key={s.k} delay={i * 0.08}>
                <li className="relative flex h-full flex-col items-center rounded-2xl p-4 text-center">
                  <span className="relative flex size-[84px] items-center justify-center rounded-full border border-border bg-background shadow-card">
                    <span className="orbit-gradient flex size-14 items-center justify-center rounded-full text-white">
                      <s.icon className="size-6" />
                    </span>
                    <span className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-foreground font-display text-[13px] font-bold text-background">{i + 1}</span>
                  </span>
                  <p className="mt-5 font-display text-[18px] font-semibold">{t(`landing.start.${s.k}` as MessageKey)}</p>
                  <p className="mt-1.5 max-w-xs text-[14.5px] text-muted-foreground">{t(`landing.start.${s.k}d` as MessageKey)}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-[820px] px-4 sm:px-6">
          <SectionHead eyebrow={t('landing.faq.eyebrow')} title={t('landing.faq.title')} />
          <Reveal>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
              {([1, 2, 3, 4, 5, 6] as const).map((n) => (
                <FaqItem key={n} q={t(`landing.faq.q${n}` as MessageKey)} a={t(`landing.faq.a${n}` as MessageKey)} defaultOpen={n === 1} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <Reveal>
          <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl bg-[#0d1512] px-6 py-16 text-center sm:px-12 sm:py-20">
            <div className="absolute -left-20 -top-24 size-72 rounded-full bg-[#0AB46A]/30 blur-[90px]" aria-hidden />
            <div className="absolute -bottom-24 -right-16 size-72 rounded-full bg-[#FB9002]/25 blur-[90px]" aria-hidden />
            <div className="absolute inset-0 opacity-20 grid-dots [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-[32px] font-bold leading-tight text-white sm:text-[46px]">{t('landing.cta.title')}</h2>
              <p className="mx-auto mt-4 max-w-xl text-[17px] text-white/65">{t('landing.cta.desc')}</p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Button size="lg" variant="gradient" asChild>
                  <Link to={authed ? '/app' : '/signup'}>
                    {t('landing.buildMyOrbit')} <ArrowRight />
                  </Link>
                </Button>
                {!authed && (
                  <Button size="lg" variant="secondary" asChild className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                    <Link to="/signin">{t('landing.cta.demo')}</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div>
            <Logo />
            <p className="mt-2 text-[13px] text-muted-foreground">{t('landing.footer.tagline')}</p>
            <p className="mt-1 text-[12px] text-subtle-foreground">{t('landing.footer.rights')}</p>
          </div>
          <div className="flex flex-col gap-4 md:items-end">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Layers className="size-4" /> React · NestJS · PostgreSQL + pgvector
              </span>
              <span className="flex items-center gap-1.5">
                <BrainCircuit className="size-4" /> Langflow · IBM Granite
              </span>
            </div>
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <GraduationCap className="size-4" /> {t('landing.footer.hackathon')}
            </span>
            <LanguageToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}

function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-surface-2/60 sm:px-6">
        <span className="font-display text-[16px] font-semibold">{q}</span>
        <ChevronDown className={cn('size-5 shrink-0 text-muted-foreground transition-transform duration-300', open && 'rotate-180 text-green')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-muted-foreground sm:px-6">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Static, lightweight illustration of the Career Universe for the landing page. */
function UniversePreview() {
  const { t } = useT();
  const nodes = [
    { x: 50, y: 50, r: 20, c: '#0AB46A', l: t('orbitSystem.you') },
    { x: 78, y: 26, r: 13, c: '#e8efeb', l: 'Product Manager' },
    { x: 24, y: 24, r: 9, c: '#0AB46A', l: t('orbitSystem.leadership') },
    { x: 18, y: 56, r: 8, c: '#0AB46A', l: 'React' },
    { x: 70, y: 66, r: 11, c: '#FB9002', l: 'Product Analytics', gap: true },
    { x: 88, y: 52, r: 8, c: '#FB9002', l: 'SQL' },
    { x: 40, y: 82, r: 8, c: '#F59E0B', l: t('orbitSystem.internship') },
    { x: 66, y: 88, r: 7, c: '#5B8FC7', l: 'Lean Analytics' },
    { x: 30, y: 38, r: 7, c: '#51C868', l: t('orbitSystem.caseStudy') },
    { x: 86, y: 80, r: 7, c: '#A48BE0', l: t('orbitSystem.roleModel') },
    { x: 54, y: 16, r: 7, c: '#5E7A70', l: 'Hackathon' },
  ];
  const edges: [number, number][] = [
    [0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [0, 4], [6, 0], [7, 4], [8, 4], [0, 8], [9, 1], [0, 10], [6, 5], [1, 2],
  ];
  return (
    <div className="relative">
      <svg viewBox="0 0 100 100" className="w-full" role="img" aria-label={t('landing.universe.preview')}>
        {edges.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke={b === 4 || a === 4 ? 'rgba(251,144,2,0.45)' : 'rgba(255,255,255,0.14)'} strokeWidth={0.35} />
        ))}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.r / 4} fill={n.c} />
            {n.gap && <circle cx={n.x} cy={n.y} r={n.r / 4 + 1.2} fill="none" stroke="#FB9002" strokeOpacity={0.5} strokeWidth={0.4} />}
            <text x={n.x} y={n.y + n.r / 4 + 3.2} textAnchor="middle" fontSize={2.6} fontWeight={600} fill="rgba(255,255,255,0.82)">
              {n.l}
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-0 right-0 w-[min(260px,70%)] rounded-2xl border border-white/10 bg-[#151e1a]/95 p-4 shadow-pop backdrop-blur">
        <Badge tone="orange">{t('landing.universe.gapBadge')}</Badge>
        <p className="mt-2 font-display text-[17px] font-bold">Product Analytics</p>
        <div className="mt-2 space-y-1 text-[12.5px] text-white/65">
          <p>{t('landing.universe.gapLevels')}</p>
          <p>{t('landing.universe.gapJobs')}</p>
          <p className="flex items-center gap-3 text-white/80">
            <span className="flex items-center gap-1">
              <GraduationCap className="size-3.5" /> 3
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="size-3.5" /> 2
            </span>
            <span className="flex items-center gap-1">
              <Search className="size-3.5" /> 4
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3.5" /> 1
            </span>
            <span className="flex items-center gap-1">
              <MessagesSquare className="size-3.5" /> 1
            </span>
          </p>
        </div>
        <span className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-lg bg-[#0AB46A] text-[13px] font-medium text-white">{t('common.addToJourney')}</span>
      </div>
    </div>
  );
}
