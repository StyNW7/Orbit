import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Check,
  CircleHelp,
  Compass,
  Dna,
  Flag,
  GraduationCap,
  Layers,
  MessagesSquare,
  Network,
  Orbit as OrbitIcon,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Telescope,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { Logo, ReadinessRing } from '@/components/brand/brand';
import { Button } from '@/components/ui/button';
import { Badge, Progress } from '@/components/ui/primitives';
import { useSessionStore } from '@/stores/session';
import { cn } from '@/lib/utils';
import { OrbitSystem } from './OrbitSystem';
import { ThemeToggle } from '@/components/common/ThemeToggle';

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
      <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-green-strong dark:text-green">{eyebrow}</p>
      <h2 className="mt-3 text-[32px] font-bold leading-[1.15] sm:text-[42px]">{title}</h2>
      {description && <p className="mt-4 text-[16px] text-muted-foreground sm:text-[17px]">{description}</p>}
    </Reveal>
  );
}

const LANDING_SECTIONS = [
  { id: 'how', label: 'How it works' },
  { id: 'universe', label: 'Career Universe' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'agent', label: 'Orbit Agent' },
] as const;

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
  return (
    // overflow-x-clip (not hidden) keeps the page from becoming its own scroll container, so the sticky nav works.
    <div className="min-h-dvh overflow-x-clip bg-background">
      {/* Nav — sticky; gains a border and shadow once the page scrolls */}
      <header
        className={cn(
          'sticky top-0 z-40 border-b backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300',
          scrolled ? 'border-border bg-background/85 shadow-[0_8px_24px_-18px_rgba(16,23,20,0.35)]' : 'border-transparent bg-background/60',
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 sm:px-6">
          <Link
            to="/"
            aria-label="Orbit home"
            onClick={(e) => {
              // Already on the landing page: glide back to the top instead of re-navigating.
              e.preventDefault();
              window.scrollTo({ top: 0 });
              history.replaceState(null, '', '/');
            }}
          >
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 text-[14px] font-medium md:flex" aria-label="Landing">
            {LANDING_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={active === section.id ? 'location' : undefined}
                className={cn(
                  'relative rounded-lg px-3 py-1.5 transition-colors',
                  active === section.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {section.label}
                {active === section.id && (
                  <motion.span layoutId="landing-nav-active" className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-green" transition={{ duration: 0.25 }} />
                )}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {authed ? (
              <Button asChild>
                <Link to="/app">
                  Open Orbit <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild className="hidden sm:inline-flex">
                  <Link to="/signin">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup">Build My Orbit</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(ellipse_70%_60%_at_70%_20%,rgba(10,180,106,0.13),transparent_60%),radial-gradient(ellipse_50%_40%_at_95%_50%,rgba(251,144,2,0.10),transparent_60%)]" aria-hidden />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-20">
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Badge tone="green" className="rounded-full px-3 py-1 text-[12.5px]">
                <Sparkles /> Agentic Career & Personal Growth Platform
              </Badge>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-6 text-[44px] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-[60px] lg:text-[64px]">
              Your career is <span className="orbit-gradient-text">not a straight line.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mt-6 max-w-xl text-[18px] leading-relaxed text-muted-foreground">
              It is an orbit of skills, experiences, people, knowledge, and opportunities. <span className="font-semibold text-foreground">Orbit connects them and shows you where to go next.</span>
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" variant="gradient" asChild>
                <Link to={authed ? '/app' : '/signup'}>
                  Build My Orbit <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href="#how">Explore How It Works</a>
              </Button>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-green" /> Asks before it changes anything
              </span>
              <span className="flex items-center gap-1.5">
                <ChartNoAxesCombined className="size-4 text-green" /> Explainable readiness score
              </span>
              <span className="flex items-center gap-1.5">
                <BrainCircuit className="size-4 text-green" /> Langflow + IBM Granite
              </span>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.7 }} className="relative mx-auto w-full max-w-[540px]">
            <OrbitSystem />
            <div className="absolute -left-2 top-6 hidden animate-float sm:block">
              <div className="card flex items-center gap-3 p-3 pr-4">
                <ReadinessRing score={74} size={56} stroke={6} showBand={false} />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Readiness</p>
                  <p className="text-[14px] font-bold">Product Manager</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-2 bottom-8 hidden max-w-[240px] sm:block" style={{ animation: 'float 7s ease-in-out infinite 1s' }}>
              <div className="card p-3.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-orange-strong dark:text-orange">
                  <Sparkles className="size-3.5" /> Next best action
                </p>
                <p className="mt-1 text-[14px] font-semibold leading-snug">Complete Product Analytics Foundations</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">Career Readiness +4.2 estimated</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-border bg-surface py-20 sm:py-24">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <SectionHead eyebrow="The problem" title="Career preparation is fragmented." description="Job boards, course platforms, papers, notes and chatbots — each holds a piece. None of them knows you, or what you should do first." />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: CircleHelp, q: 'Which skills am I actually missing?', a: 'Orbit compares you with your target role and ranks gaps by impact.' },
              { icon: Compass, q: 'Internship first, or a competition?', a: 'Orbit weighs deadlines, readiness and your journey to prioritise.' },
              { icon: Target, q: 'What should I do this week?', a: 'Orbit Agent turns everything it knows into one next best action.' },
            ].map((c, i) => (
              <Reveal key={c.q} delay={i * 0.08}>
                <div className="card h-full p-6">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-muted-orange text-orange-strong dark:text-orange">
                    <c.icon className="size-5" />
                  </div>
                  <p className="mt-4 font-display text-[18px] font-semibold">“{c.q}”</p>
                  <p className="mt-2 text-[14.5px] text-muted-foreground">{c.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2}>
            <p className="mx-auto mt-12 max-w-2xl text-center font-display text-[20px] font-semibold leading-snug sm:text-[24px]">
              The problem isn’t a lack of information. It’s knowing <span className="orbit-gradient-text">what matters for you</span> — and what to do first.
            </p>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <SectionHead eyebrow="How Orbit works" title="One loop that keeps adapting to you" description="Every action feeds back into your long-term career memory, so recommendations get sharper as you grow." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Dna, t: 'Understand me', d: 'CV, goals and preferences become your Career DNA.' },
              { icon: Network, t: 'Map my universe', d: 'Skills, experiences and opportunities, connected.' },
              { icon: Telescope, t: 'Discover opportunities', d: 'Jobs, courses, events, books, papers and people.' },
              { icon: Target, t: 'Identify my gaps', d: 'Deterministic gap analysis against your target role.' },
              { icon: Route, t: 'Build my journey', d: 'Milestones and quests generated from your gaps.' },
              { icon: Zap, t: 'Take action', d: 'Tasks, evidence and applications — one step at a time.' },
              { icon: TrendingUp, t: 'Track my progress', d: 'Readiness history, XP, streaks and a living timeline.' },
              { icon: OrbitIcon, t: 'Adapt my journey', d: 'New context from notes and interviews reshapes the plan.' },
            ].map((s, i) => (
              <Reveal key={s.t} delay={(i % 4) * 0.06}>
                <div className="card group relative h-full p-5 transition hover:-translate-y-0.5">
                  <span className="absolute right-4 top-4 font-display text-[13px] font-bold text-subtle-foreground tabular">{String(i + 1).padStart(2, '0')}</span>
                  <div className={cn('flex size-10 items-center justify-center rounded-xl', i < 4 ? 'bg-muted-green text-green-strong dark:text-green' : 'bg-muted-orange text-orange-strong dark:text-orange')}>
                    <s.icon className="size-5" />
                  </div>
                  <p className="mt-4 font-semibold">{s.t}</p>
                  <p className="mt-1 text-[14px] text-muted-foreground">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Universe preview */}
      <section id="universe" className="scroll-mt-20 bg-[#0d1512] py-20 text-white sm:py-28">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[#5fe0a0]">Career Universe</p>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.15] text-white sm:text-[42px]">See everything that connects to your career.</h2>
            <p className="mt-4 text-[17px] text-white/65">
              A living knowledge graph of your skills, gaps, experiences, quests, opportunities, books, papers and people. Click any node to see why it matters — and what to do about it.
            </p>
            <ul className="mt-8 space-y-3 text-[15px] text-white/80">
              {['Gaps glow orange until your quests close them', 'Every recommendation is connected to a reason', 'Search, filter, zoom and drag — your career, explorable'].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-[#0AB46A]/20 text-[#5fe0a0]">
                    <Check className="size-3.5" />
                  </span>
                  {t}
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
          <SectionHead eyebrow="Five core capabilities" title="Everything supports one question" description="How career-ready are you — and what should you do next?" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Dna, t: 'Career Intelligence', d: 'Career DNA, strengths, gaps and a deterministic readiness score across six weighted categories.', tone: 'green' },
              { icon: Network, t: 'Career Universe', d: 'A connected graph of everything in your career, stored in PostgreSQL and rendered with Sigma.js.', tone: 'green' },
              { icon: Telescope, t: 'Opportunity Intelligence', d: 'Hybrid matching — structured filters + pgvector similarity + explainable scoring.', tone: 'orange' },
              { icon: Route, t: 'Adaptive Career Journey', d: 'Milestones, quests, tasks and evidence. Progress updates XP, your Universe and readiness.', tone: 'orange' },
              { icon: BrainCircuit, t: 'Orbit Career Agent', d: 'One orchestrator agent in Langflow with 14 tools, long-term memory and human-in-the-loop actions.', tone: 'green' },
            ].map((c, i) => (
              <Reveal key={c.t} delay={(i % 3) * 0.07} className={i === 4 ? 'md:col-span-2 lg:col-span-1' : undefined}>
                <div className="card h-full p-6 transition hover:-translate-y-0.5">
                  <div className={cn('flex size-11 items-center justify-center rounded-xl', c.tone === 'green' ? 'bg-muted-green text-green-strong dark:text-green' : 'bg-muted-orange text-orange-strong dark:text-orange')}>
                    <c.icon className="size-5" />
                  </div>
                  <p className="mt-4 font-display text-[19px] font-semibold">{c.t}</p>
                  <p className="mt-2 text-[14.5px] text-muted-foreground">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Journey + Opportunity */}
      <section className="border-y border-border bg-surface py-20 sm:py-28">
        <div className="mx-auto grid max-w-[1200px] gap-6 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <div className="card h-full p-6 sm:p-8">
              <Badge tone="green">
                <Route /> Agentic Career Journey
              </Badge>
              <h3 className="mt-4 text-[26px] font-bold leading-tight">Turn ambition into action</h3>
              <p className="mt-2 text-muted-foreground">Gaps become milestones. Milestones become quests. Quests become evidence.</p>
              <div className="mt-6 space-y-3">
                {[
                  { t: 'Product Foundation', v: 100 },
                  { t: 'Product Analytics', v: 60 },
                  { t: 'Portfolio', v: 35 },
                  { t: 'Experience', v: 25 },
                  { t: 'Interview Readiness', v: 10 },
                  { t: 'Job Ready', v: 0 },
                ].map((m) => (
                  <div key={m.t} className="flex items-center gap-3">
                    <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-white', m.v === 100 ? 'bg-green' : m.v > 0 ? 'bg-orange' : 'bg-border-strong')}>
                      {m.v === 100 ? <Check className="size-3.5" /> : <Flag className="size-3" />}
                    </span>
                    <span className="w-40 shrink-0 truncate text-[14px] font-medium">{m.t}</span>
                    <Progress value={m.v} tone={m.v === 100 ? 'green' : 'gradient'} className="h-1.5" />
                    <span className="w-10 text-right text-[12.5px] tabular text-muted-foreground">{m.v}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="card h-full p-6 sm:p-8">
              <Badge tone="orange">
                <BriefcaseBusiness /> Opportunity Intelligence
              </Badge>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[22px] font-bold leading-tight">Product Management Intern</h3>
                  <p className="text-muted-foreground">Fintech · Jakarta · Hybrid</p>
                </div>
                <ReadinessRing score={87} size={86} stroke={8} showBand={false} />
              </div>
              <div className="mt-5 space-y-3">
                {[
                  { l: 'Role Alignment', v: 92 },
                  { l: 'Skill Match', v: 81 },
                  { l: 'Experience Match', v: 78 },
                  { l: 'Preference Match', v: 96 },
                ].map((r) => (
                  <div key={r.l}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="font-medium">{r.l}</span>
                      <span className="font-semibold tabular">{r.v}%</span>
                    </div>
                    <Progress value={r.v} className="h-1.5" />
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 text-[13.5px] sm:grid-cols-2">
                <div className="rounded-xl bg-muted-green/60 p-3">
                  <p className="font-semibold">Why you match</p>
                  <p className="text-muted-foreground">Leadership · Technical Background · Project Experience</p>
                </div>
                <div className="rounded-xl bg-muted-orange/60 p-3">
                  <p className="font-semibold">Missing</p>
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
          <SectionHead eyebrow="Orbit Career Agent" title="Not a chatbot. A career agent." description="Orbit uses your profile, journey, gaps, applications and deadlines — then proposes actions you confirm with one click." />
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <Reveal>
              <div className="card p-5 sm:p-6">
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-br-md bg-green px-4 py-2.5 text-[14px] text-white">What should I focus on this week?</div>
                </div>
                <div className="mt-4 flex gap-3">
                  <span className="orbit-gradient flex size-7 shrink-0 items-center justify-center rounded-lg text-white">
                    <Sparkles className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-border bg-surface p-4 text-[14px]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Insight</p>
                    <p className="mt-1">Product Analytics is your largest Product Manager gap — it appears in 7 of your top 10 matching roles.</p>
                    <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Next best action</p>
                    <p className="mt-1 font-semibold">Complete SQL Analytics Foundations before Friday’s internship deadline.</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {['get_user_context', 'analyze_career_gap', 'find_opportunities'].map((t) => (
                        <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="ml-10 mt-3 rounded-xl border border-green/30 bg-muted-green/50 p-3.5">
                  <p className="text-[13.5px] font-semibold">Add Product Analytics to Journey</p>
                  <p className="text-[12.5px] text-muted-foreground">Creates “Product Analytics Foundations” · 4 tasks · 150 XP</p>
                  <div className="mt-2.5 flex gap-2">
                    <span className="inline-flex h-8 items-center rounded-lg bg-green px-3 text-[13px] font-medium text-white">Add to Journey</span>
                    <span className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium text-muted-foreground">Not now</span>
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="card flex h-full flex-col p-6">
                <Badge tone="green" className="w-fit">
                  <ChartNoAxesCombined /> Progress visualization
                </Badge>
                <p className="mt-4 font-display text-[40px] font-bold leading-none">
                  81<span className="text-[20px] text-muted-foreground">%</span>
                </p>
                <p className="text-muted-foreground">Readiness, up from 52% in five months</p>
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
                  {[
                    ['March', 'Completed Product Analytics'],
                    ['April', 'Built first product case study'],
                    ['August', 'Started a product internship'],
                  ].map(([m, t]) => (
                    <li key={t} className="relative">
                      <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-green" />
                      <span className="font-semibold">{m}</span> <span className="text-muted-foreground">· {t}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <Reveal>
          <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl bg-[#0d1512] px-6 py-16 text-center sm:px-12 sm:py-20">
            <div className="absolute -left-20 -top-24 size-72 rounded-full bg-[#0AB46A]/30 blur-[90px]" aria-hidden />
            <div className="absolute -bottom-24 -right-16 size-72 rounded-full bg-[#FB9002]/25 blur-[90px]" aria-hidden />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-[34px] font-bold leading-tight text-white sm:text-[46px]">Build your path. Become career-ready.</h2>
              <p className="mx-auto mt-4 max-w-xl text-[17px] text-white/65">Orbit understands where you are, connects what can help you grow, and shows you what to do next.</p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Button size="lg" variant="gradient" asChild>
                  <Link to={authed ? '/app' : '/signup'}>
                    Build My Orbit <ArrowRight />
                  </Link>
                </Button>
                {!authed && (
                  <Button size="lg" variant="secondary" asChild className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                    <Link to="/signin">Try the demo account</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo />
            <p className="mt-2 text-[13px] text-muted-foreground">Build Your Path. Become Career-Ready.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Layers className="size-4" /> React · NestJS · PostgreSQL + pgvector
            </span>
            <span className="flex items-center gap-1.5">
              <BrainCircuit className="size-4" /> Langflow · IBM Granite
            </span>
            <span className="flex items-center gap-1.5">
              <GraduationCap className="size-4" /> IBM SkillsBuild Hackathon 2026 · Education & Future of Work
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Static, lightweight illustration of the Career Universe for the landing page. */
function UniversePreview() {
  const nodes = [
    { x: 50, y: 50, r: 20, c: '#0AB46A', l: 'You' },
    { x: 78, y: 26, r: 13, c: '#e8efeb', l: 'Product Manager', dark: true },
    { x: 24, y: 24, r: 9, c: '#0AB46A', l: 'Leadership' },
    { x: 18, y: 56, r: 8, c: '#0AB46A', l: 'React' },
    { x: 70, y: 66, r: 11, c: '#FB9002', l: 'Product Analytics' },
    { x: 88, y: 52, r: 8, c: '#FB9002', l: 'SQL' },
    { x: 40, y: 82, r: 8, c: '#F59E0B', l: 'PM Internship' },
    { x: 66, y: 88, r: 7, c: '#5B8FC7', l: 'Lean Analytics' },
    { x: 30, y: 38, r: 7, c: '#51C868', l: 'Case Study' },
    { x: 86, y: 80, r: 7, c: '#A48BE0', l: 'Role model' },
    { x: 54, y: 16, r: 7, c: '#5E7A70', l: 'Hackathon' },
  ];
  const edges: [number, number][] = [
    [0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [0, 4], [6, 0], [7, 4], [8, 4], [0, 8], [9, 1], [0, 10], [6, 5], [1, 2],
  ];
  return (
    <div className="relative">
      <svg viewBox="0 0 100 100" className="w-full" role="img" aria-label="Career Universe preview">
        {edges.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke={b === 4 || a === 4 ? 'rgba(251,144,2,0.45)' : 'rgba(255,255,255,0.14)'} strokeWidth={0.35} />
        ))}
        {nodes.map((n) => (
          <g key={n.l}>
            <circle cx={n.x} cy={n.y} r={n.r / 4} fill={n.c} />
            {n.l === 'Product Analytics' && <circle cx={n.x} cy={n.y} r={n.r / 4 + 1.2} fill="none" stroke="#FB9002" strokeOpacity={0.5} strokeWidth={0.4} />}
            <text x={n.x} y={n.y + n.r / 4 + 3.2} textAnchor="middle" fontSize={2.6} fontWeight={600} fill="rgba(255,255,255,0.82)">
              {n.l}
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-0 right-0 w-[min(260px,70%)] rounded-2xl border border-white/10 bg-[#151e1a]/95 p-4 shadow-pop backdrop-blur">
        <Badge tone="orange">Skill gap</Badge>
        <p className="mt-2 font-display text-[17px] font-bold">Product Analytics</p>
        <div className="mt-2 space-y-1 text-[12.5px] text-white/65">
          <p>Current: Beginner · Required: Intermediate</p>
          <p>Required by 7 matching jobs</p>
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
        <span className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-lg bg-[#0AB46A] text-[13px] font-medium text-white">Add to Journey</span>
      </div>
    </div>
  );
}
