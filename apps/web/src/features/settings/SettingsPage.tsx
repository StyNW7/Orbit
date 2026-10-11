import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { BellRing, BrainCircuit, Check, CheckCircle2, CircleAlert, Cpu, Database, History, Languages, LogOut, Monitor, Moon, Palette, ShieldCheck, Sun, Workflow } from 'lucide-react';
import type { AgentActionView } from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/primitives';
import { PageHeader, SectionTitle } from '@/components/common/states';
import { useAgentStatus, useMe } from '@/hooks/queries';
import { useUiStore, type ThemePreference } from '@/stores/ui';
import { authMode, signOut } from '@/lib/auth';
import { api } from '@/lib/api';
import { centerOf, cn, relative } from '@/lib/utils';
import { LOCALES, useI18nStore, useT } from '@/lib/i18n';
import { useLabels } from '@/lib/i18n/labels';

export default function SettingsPage() {
  const { data: me } = useMe();
  const { data: status, refetch, isFetching } = useAgentStatus();
  const { data: audit = [] } = useQuery({ queryKey: ['agent-audit'], queryFn: () => api.get<AgentActionView[]>('/agent/actions') });
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const navigate = useNavigate();
  const { t, locale } = useT();
  const labels = useLabels();
  const setLocale = useI18nStore((s) => s.setLocale);
  const notifPermission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={t('settings.eyebrow')} title={t('settings.title')} description={t('settings.desc')} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle icon={ShieldCheck} title={t('settings.account')} />
          <dl className="space-y-2 text-[14px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t('settings.name')}</dt>
              <dd className="font-medium">{me?.user.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t('settings.email')}</dt>
              <dd className="font-medium">{me?.user.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t('settings.auth')}</dt>
              <dd>
                <Badge tone="green">{authMode === 'supabase' ? t('settings.authSupabase') : t('settings.authLocal')}</Badge>
              </dd>
            </div>
          </dl>
          <Button variant="secondary" className="mt-5" onClick={() => void signOut().then(() => navigate('/'))}>
            <LogOut /> {t('common.signOut')}
          </Button>
        </Card>

        <Card className="p-6">
          <SectionTitle icon={Palette} title={t('settings.appearance')} />
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('theme.label')}>
            {(
              [
                { value: 'light', label: t('theme.light'), icon: Sun },
                { value: 'dark', label: t('theme.dark'), icon: Moon },
                { value: 'system', label: t('theme.system'), icon: Monitor },
              ] as { value: ThemePreference; label: string; icon: typeof Sun }[]
            ).map((th) => (
              <button
                key={th.value}
                role="radio"
                aria-checked={theme === th.value}
                onClick={(e) => setTheme(th.value, centerOf(e.currentTarget))}
                className={cn('flex flex-col items-center gap-2 rounded-xl border p-4 text-[13px] font-medium transition', theme === th.value ? 'border-green bg-muted-green text-green-strong dark:text-green' : 'border-border hover:border-border-strong')}
              >
                <th.icon className="size-5" /> {th.label}
              </button>
            ))}
          </div>
          <p className="mb-2.5 mt-5 flex items-center gap-2 text-[14px] font-semibold">
            <Languages className="size-4 text-green" /> {t('settings.language')}
          </p>
          <p className="-mt-1 mb-3 text-[13px] text-muted-foreground">{t('lang.description')}</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('settings.language')}>
            {LOCALES.map((l) => (
              <button
                key={l.value}
                role="radio"
                aria-checked={locale === l.value}
                onClick={() => setLocale(l.value)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3.5 text-left text-[13.5px] font-medium transition',
                  locale === l.value ? 'border-green bg-muted-green text-green-strong dark:text-green' : 'border-border hover:border-border-strong',
                )}
              >
                <span className={cn('flex size-8 items-center justify-center rounded-lg text-[12px] font-bold', locale === l.value ? 'bg-green text-white' : 'bg-surface-2 text-muted-foreground')}>{l.short}</span>
                <span className="flex-1">{l.label}</span>
                {locale === l.value && <Check className="size-4" />}
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-start justify-between gap-4 rounded-xl bg-surface-2 p-4">
            <div>
              <p className="flex items-center gap-2 text-[14px] font-semibold">
                <BellRing className="size-4 text-orange" /> {t('settings.notifications')}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">{t('settings.notificationsDesc')}</p>
            </div>
            {notifPermission === 'default' && (
              <Button size="sm" variant="secondary" onClick={() => void Notification.requestPermission()}>
                {t('settings.allowAlerts')}
              </Button>
            )}
            {notifPermission === 'granted' && <Badge tone="green">{t('settings.alertsOn')}</Badge>}
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <SectionTitle
            icon={BrainCircuit}
            title={t('settings.agent')}
            action={
              <Button size="sm" variant="ghost" onClick={() => void refetch()} loading={isFetching}>
                {t('settings.recheck')}
              </Button>
            }
          />
          {status ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <StatusTile icon={Workflow} title={t('settings.engine')} value={labels.engine(status.activeEngine)} ok detail={status.activeEngine === 'planner' ? t('settings.enginePlanner') : t('settings.engineModel')} />
              <StatusTile
                icon={Workflow}
                title={t('settings.langflow')}
                value={
                  !status.langflow.configured
                    ? t('settings.lf.notConfigured')
                    : !status.langflow.reachable
                      ? t('settings.lf.unreachable')
                      : status.langflow.skippedReason
                        ? t('settings.lf.standingBy')
                        : t('settings.lf.connected')
                }
                ok={status.langflow.reachable && !status.langflow.skippedReason}
                detail={
                  status.langflow.skippedReason ??
                  (status.langflow.flowId
                    ? t('settings.lf.flow', { id: status.langflow.flowId.slice(0, 8), provider: status.langflow.modelProvider })
                    : t('settings.lf.setup'))
                }
              />
              <StatusTile
                icon={Cpu}
                title={t('settings.model')}
                value={`${status.ai.provider} · ${status.ai.model}`}
                ok={status.ai.reachable && status.ai.interactive}
                detail={
                  !status.ai.reachable
                    ? t('settings.modelUnavailable')
                    : status.ai.throughput
                      ? `${t('settings.modelSpeed', { tps: status.ai.throughput.evalTps })}${status.ai.interactive ? '' : t('settings.modelSlow')}`
                      : t('settings.modelHosted')
                }
              />
              <StatusTile icon={Database} title={t('settings.embeddings')} value={status.embeddings.provider} ok detail={status.embeddings.model} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('settings.checking')}</p>
          )}
          <p className="mt-4 text-[12.5px] text-muted-foreground">
            {t('settings.aiNote')}
          </p>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <SectionTitle icon={History} title={t('settings.log')} />
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.logEmpty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-semibold">{t('settings.col.tool')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('settings.col.level')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('settings.col.summary')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('settings.col.status')}</th>
                    <th className="py-2 font-semibold">{t('settings.col.when')}</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.slice(0, 15).map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-3 font-mono text-[12px]">{a.tool}</td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={a.level === 'WRITE' ? 'orange' : a.level === 'SUGGEST' ? 'green' : 'neutral'}>{labels.actionLevel(a.level)}</Badge>
                      </td>
                      <td className="max-w-[360px] truncate py-2.5 pr-3 text-muted-foreground">{a.resultSummary ?? a.description}</td>
                      <td className="py-2.5 pr-3">{labels.actionStatus(a.status)}</td>
                      <td className="py-2.5 text-subtle-foreground">{relative(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatusTile({ icon: Icon, title, value, ok, detail }: { icon: typeof Cpu; title: string; value: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        <Icon className="size-3.5" /> {title}
      </p>
      <p className="mt-2 flex items-center gap-1.5 font-semibold">
        {ok ? <CheckCircle2 className="size-4 text-green" /> : <CircleAlert className="size-4 text-orange" />}
        <span className="truncate">{value}</span>
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">{detail}</p>
    </div>
  );
}
