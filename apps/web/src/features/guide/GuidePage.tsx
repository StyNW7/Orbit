import { Link } from 'react-router';
import {
  ArrowRight,
  BrainCircuit,
  ChartNoAxesCombined,
  Command,
  Flame,
  Languages,
  ListChecks,
  Orbit,
  RefreshCcw,
  Route,
  Target,
  Telescope,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { DEFAULT_READINESS_WEIGHTS, READINESS_CATEGORIES } from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Card, CardEyebrow } from '@/components/ui/primitives';
import { FadeIn, PageHeader, ScoreBar } from '@/components/common/states';
import { usePageContext, useUiStore } from '@/stores/ui';
import { useT, type MessageKey } from '@/lib/i18n';
import { useLabels } from '@/lib/i18n/labels';
import { cn } from '@/lib/utils';

const AREAS: { to: string; icon: LucideIcon; title: MessageKey; body: MessageKey; tone: 'green' | 'orange' }[] = [
  { to: '/app', icon: Target, title: 'nav.mission', body: 'guide.mission', tone: 'green' },
  { to: '/app/universe', icon: Orbit, title: 'nav.universe', body: 'guide.universe', tone: 'green' },
  { to: '/app/journey', icon: Route, title: 'nav.journey', body: 'guide.journey', tone: 'orange' },
  { to: '/app/discover', icon: Telescope, title: 'nav.discover', body: 'guide.discover', tone: 'orange' },
  { to: '/app/progress', icon: ChartNoAxesCombined, title: 'nav.progress', body: 'guide.progress', tone: 'green' },
];

const LOOP: { icon: LucideIcon; key: MessageKey }[] = [
  { icon: Target, key: 'guide.loop1' },
  { icon: ListChecks, key: 'guide.loop2' },
  { icon: RefreshCcw, key: 'guide.loop3' },
  { icon: TrendingUp, key: 'guide.loop4' },
];

const TIPS: { icon: LucideIcon; key: MessageKey }[] = [
  { icon: Command, key: 'guide.tip1' },
  { icon: Languages, key: 'guide.tip2' },
  { icon: Flame, key: 'guide.tip3' },
  { icon: RefreshCcw, key: 'guide.tip4' },
];

/** A plain-language tour of Orbit for first-time users. */
export default function GuidePage() {
  usePageContext({ page: 'other' });
  const { t } = useT();
  const labels = useLabels();
  const openAgent = useUiStore((s) => s.openAgent);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('guide.eyebrow')}
        title={t('guide.title')}
        description={t('guide.desc')}
        actions={
          <Button variant="gradient" onClick={() => openAgent(t('agent.sugg.whatCan'))}>
            <BrainCircuit /> {t('guide.ask')}
          </Button>
        }
      />

      {/* The loop */}
      <FadeIn>
        <Card className="relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(10,180,106,0.14),transparent_65%)]" aria-hidden />
          <CardEyebrow>{t('guide.loopTitle')}</CardEyebrow>
          <p className="relative mt-2 max-w-2xl text-[14.5px] text-muted-foreground">{t('guide.loopDesc')}</p>
          <ol className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP.map((s, i) => (
              <li key={s.key} className="relative flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
                <span className="orbit-gradient flex size-10 shrink-0 items-center justify-center rounded-xl text-white">
                  <s.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground tabular">0{i + 1}</span>
                  <span className="block text-[14px] font-semibold leading-snug">{t(s.key)}</span>
                </span>
                {i < LOOP.length - 1 && <ArrowRight className="absolute -right-2.5 top-1/2 hidden size-4 -translate-y-1/2 text-subtle-foreground lg:block" aria-hidden />}
              </li>
            ))}
          </ol>
        </Card>
      </FadeIn>

      {/* Areas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {AREAS.map((a, i) => (
          <FadeIn key={a.to} delay={0.04 * i}>
            <Card className="flex h-full flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-pop">
              <div className="flex items-center gap-3">
                <span className={cn('flex size-11 items-center justify-center rounded-xl', a.tone === 'green' ? 'bg-muted-green text-green-strong dark:text-green' : 'bg-muted-orange text-orange-strong dark:text-orange')}>
                  <a.icon className="size-5" />
                </span>
                <h2 className="text-[19px] font-semibold">{t(a.title)}</h2>
              </div>
              <p className="mt-3 flex-1 text-[14px] leading-relaxed text-muted-foreground">{t(a.body)}</p>
              <Button asChild variant="secondary" size="sm" className="mt-4 w-fit">
                <Link to={a.to}>
                  {t('guide.open', { page: t(a.title) })} <ArrowRight />
                </Link>
              </Button>
            </Card>
          </FadeIn>
        ))}
        <FadeIn delay={0.2}>
          <div className="relative flex h-full flex-col overflow-hidden rounded-xl bg-[#0f1a15] p-6 text-white shadow-pop">
            <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[#0AB46A]/35 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-20 left-10 size-48 rounded-full bg-[#FB9002]/25 blur-3xl" aria-hidden />
            <div className="relative flex items-center gap-3">
              <span className="orbit-gradient flex size-11 items-center justify-center rounded-xl text-white">
                <BrainCircuit className="size-5" />
              </span>
              <h2 className="text-[19px] font-semibold text-white">{t('guide.agentTitle')}</h2>
            </div>
            <p className="relative mt-3 flex-1 text-[14px] leading-relaxed text-white/70">{t('guide.agent')}</p>
            <Button variant="gradient" size="sm" className="relative mt-4 w-fit" onClick={() => openAgent(t('agent.sugg.focus'))}>
              {t('common.askOrbit')} <ArrowRight />
            </Button>
          </div>
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Readiness formula */}
        <FadeIn>
          <Card className="h-full p-6">
            <CardEyebrow>{t('guide.scoreTitle')}</CardEyebrow>
            <p className="mt-2 text-[14px] text-muted-foreground">{t('guide.scoreDesc')}</p>
            <div className="mt-5 space-y-3">
              {READINESS_CATEGORIES.map((c) => (
                <ScoreBar key={c} label={labels.readiness(c)} value={DEFAULT_READINESS_WEIGHTS[c] * 100} tone={DEFAULT_READINESS_WEIGHTS[c] >= 0.2 ? 'gradient' : 'green'} />
              ))}
            </div>
          </Card>
        </FadeIn>

        {/* Tips */}
        <FadeIn delay={0.05}>
          <Card className="h-full p-6">
            <CardEyebrow>{t('guide.tipsTitle')}</CardEyebrow>
            <ul className="mt-4 space-y-3">
              {TIPS.map((tip) => (
                <li key={tip.key} className="flex items-start gap-3 rounded-xl bg-surface-2/70 p-3.5 text-[14px]">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-green shadow-card">
                    <tip.icon className="size-4" />
                  </span>
                  <span className="pt-1">{t(tip.key)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
