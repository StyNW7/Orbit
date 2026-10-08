import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { BellRing, BrainCircuit, CheckCircle2, CircleAlert, Cpu, Database, History, LogOut, Monitor, Moon, Palette, ShieldCheck, Sun, Workflow } from 'lucide-react';
import { AGENT_ENGINE_LABELS, type AgentActionView } from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/primitives';
import { PageHeader, SectionTitle } from '@/components/common/states';
import { useAgentStatus, useMe } from '@/hooks/queries';
import { useUiStore, type ThemePreference } from '@/stores/ui';
import { authMode, signOut } from '@/lib/auth';
import { api } from '@/lib/api';
import { cn, relative } from '@/lib/utils';

export default function SettingsPage() {
  const { data: me } = useMe();
  const { data: status, refetch, isFetching } = useAgentStatus();
  const { data: audit = [] } = useQuery({ queryKey: ['agent-audit'], queryFn: () => api.get<AgentActionView[]>('/agent/actions') });
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const navigate = useNavigate();
  const notifPermission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Settings" title="Settings" description="Account, appearance, notifications and how Orbit’s AI is running." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle icon={ShieldCheck} title="Account" />
          <dl className="space-y-2 text-[14px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{me?.user.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{me?.user.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Authentication</dt>
              <dd>
                <Badge tone="green">{authMode === 'supabase' ? 'Supabase Auth' : 'Orbit local auth'}</Badge>
              </dd>
            </div>
          </dl>
          <Button variant="secondary" className="mt-5" onClick={() => void signOut().then(() => navigate('/'))}>
            <LogOut /> Sign out
          </Button>
        </Card>

        <Card className="p-6">
          <SectionTitle icon={Palette} title="Appearance" />
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
            {(
              [
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'System', icon: Monitor },
              ] as { value: ThemePreference; label: string; icon: typeof Sun }[]
            ).map((t) => (
              <button
                key={t.value}
                role="radio"
                aria-checked={theme === t.value}
                onClick={() => setTheme(t.value)}
                className={cn('flex flex-col items-center gap-2 rounded-xl border p-4 text-[13px] font-medium transition', theme === t.value ? 'border-green bg-muted-green text-green-strong dark:text-green' : 'border-border hover:border-border-strong')}
              >
                <t.icon className="size-5" /> {t.label}
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-start justify-between gap-4 rounded-xl bg-surface-2 p-4">
            <div>
              <p className="flex items-center gap-2 text-[14px] font-semibold">
                <BellRing className="size-4 text-orange" /> Notifications
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">In-app reminders for deadlines, events and weekly reviews are always on. Orbit is installable as an app (PWA).</p>
            </div>
            {notifPermission === 'default' && (
              <Button size="sm" variant="secondary" onClick={() => void Notification.requestPermission()}>
                Allow browser alerts
              </Button>
            )}
            {notifPermission === 'granted' && <Badge tone="green">Browser alerts on</Badge>}
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <SectionTitle
            icon={BrainCircuit}
            title="Orbit Career Agent"
            action={
              <Button size="sm" variant="ghost" onClick={() => void refetch()} loading={isFetching}>
                Re-check
              </Button>
            }
          />
          {status ? (
            <div className="grid gap-3 md:grid-cols-4">
              <StatusTile icon={Workflow} title="Active engine" value={AGENT_ENGINE_LABELS[status.activeEngine]} ok detail={status.activeEngine === 'planner' ? 'Deterministic tools + templated reasoning' : 'Model-driven reasoning with tools'} />
              <StatusTile
                icon={Workflow}
                title="Langflow"
                value={status.langflow.configured ? (status.langflow.reachable ? 'Connected' : 'Unreachable') : 'Not configured'}
                ok={status.langflow.reachable}
                detail={status.langflow.flowId ? `Flow ${status.langflow.flowId.slice(0, 8)}…` : 'Set LANGFLOW_FLOW_ID to route the agent through Langflow'}
              />
              <StatusTile
                icon={Cpu}
                title="AI model"
                value={`${status.ai.provider} · ${status.ai.model}`}
                ok={status.ai.reachable && status.ai.interactive}
                detail={
                  !status.ai.reachable
                    ? 'Unavailable — Orbit uses deterministic fallbacks'
                    : status.ai.throughput
                      ? `${status.ai.throughput.evalTps} tok/s on this machine${status.ai.interactive ? '' : ' — too slow for live answers'}`
                      : 'Hosted provider'
                }
              />
              <StatusTile icon={Database} title="Embeddings" value={status.embeddings.provider} ok detail={status.embeddings.model} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Checking agent status…</p>
          )}
          <p className="mt-4 text-[12.5px] text-muted-foreground">
            Readiness and match scores are always calculated by Orbit’s deterministic engines. The AI explains, extracts and reasons — and asks before important changes.
          </p>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <SectionTitle icon={History} title="Agent activity log" />
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agent activity yet. Ask Orbit a question to see how it uses its tools.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-semibold">Tool</th>
                    <th className="py-2 pr-3 font-semibold">Level</th>
                    <th className="py-2 pr-3 font-semibold">Summary</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.slice(0, 15).map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-3 font-mono text-[12px]">{a.tool}</td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={a.level === 'WRITE' ? 'orange' : a.level === 'SUGGEST' ? 'green' : 'neutral'}>{a.level}</Badge>
                      </td>
                      <td className="max-w-[360px] truncate py-2.5 pr-3 text-muted-foreground">{a.resultSummary ?? a.description}</td>
                      <td className="py-2.5 pr-3">{a.status.replace('_', ' ').toLowerCase()}</td>
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
