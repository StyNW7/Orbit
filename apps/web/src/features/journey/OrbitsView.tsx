import { useState } from 'react';
import { Archive, Plus, Star } from 'lucide-react';
import { ReadinessRing } from '@/components/brand/brand';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/primitives';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import { Select } from '@/components/ui/form-controls';
import { CardSkeleton, ErrorState } from '@/components/common/states';
import { useGoalComparison, useGoalMutations, useRoles } from '@/hooks/queries';
import { roleIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import type { CareerGoalView } from '@orbit/shared';

export function OrbitsView() {
  const { data, isLoading, error, refetch } = useGoalComparison();
  const { data: roles = [] } = useRoles();
  const { add, setPrimary, archive } = useGoalMutations();
  const [confirm, setConfirm] = useState<CareerGoalView | null>(null);
  const [newRole, setNewRole] = useState<string>('');

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading || !data) return <CardSkeleton lines={6} />;

  const taken = new Set(data.goals.map((g) => g.goal.role.slug));
  const available = roles.filter((r) => !taken.has(r.slug));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.goals.map((row) => {
          const Icon = roleIcon(row.goal.role.icon);
          return (
            <Card key={row.goal.id} className={cn('relative p-5', row.goal.isPrimary && 'border-green shadow-[0_0_0_3px_var(--ring)]')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-muted-green text-green-strong dark:text-green">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{row.goal.role.title}</p>
                    {row.goal.isPrimary ? <Badge tone="green">Primary journey</Badge> : <Badge tone="outline">Exploring</Badge>}
                  </div>
                </div>
                <ReadinessRing score={row.readiness} size={72} stroke={7} showBand={false} />
              </div>
              <dl className="mt-4 space-y-2 text-[13px]">
                <Row label="Skill gaps" value={`${row.skillGaps}${row.topGaps.length ? ` · ${row.topGaps.slice(0, 2).join(', ')}` : ''}`} />
                <Row label="Experience gap" value={row.experienceGap} />
                <Row label="Estimated preparation" value={`~${row.estimatedPreparationWeeks} weeks`} />
                <Row label="Open opportunities" value={String(row.opportunityCount)} />
                <Row label="Preference alignment" value={`${row.preferenceAlignment}%`} />
              </dl>
              {!row.goal.isPrimary && (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setConfirm(row.goal)}>
                    <Star /> Make primary
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => archive.mutate(row.goal.id)} loading={archive.isPending}>
                    <Archive /> Archive
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
        {available.length > 0 && data.goals.length < 4 && (
          <Card className="flex flex-col justify-center border-dashed p-5">
            <p className="font-semibold">Explore another orbit</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Compare readiness for an alternative career path without changing your primary journey.</p>
            <div className="mt-4 flex gap-2">
              <Select value={newRole || undefined} onValueChange={setNewRole} placeholder="Choose a role" options={available.map((r) => ({ value: r.slug, label: r.title }))} label="Role to explore" />
              <Button onClick={() => newRole && add.mutate(newRole, { onSuccess: () => setNewRole('') })} disabled={!newRole} loading={add.isPending} aria-label="Add orbit">
                <Plus />
              </Button>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent title={`Make ${confirm?.role.title} your primary orbit?`} description="Mission Control, readiness, recommendations and the Universe will re-centre on this role. Your other journeys are kept.">
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Keep current
            </Button>
            <Button
              variant="accent"
              loading={setPrimary.isPending}
              onClick={() => confirm && setPrimary.mutate(confirm.id, { onSuccess: () => setConfirm(null) })}
            >
              Change primary orbit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  );
}
