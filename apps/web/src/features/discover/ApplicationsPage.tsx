import { Link } from 'react-router';
import { ArrowLeft, BriefcaseBusiness, Clock, FolderKanban } from 'lucide-react';
import { APPLICATION_PIPELINE, type ApplicationView } from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Badge, Card, Progress } from '@/components/ui/primitives';
import { CardSkeleton, EmptyState, ErrorState, PageHeader } from '@/components/common/states';
import { MatchChip } from '@/components/common/MatchChip';
import { useApplications } from '@/hooks/queries';
import { usePageContext } from '@/stores/ui';
import { cn, daysUntil } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { useLabels } from '@/lib/i18n/labels';

export default function ApplicationsPage() {
  const { t } = useT();
  const labels = useLabels();
  usePageContext({ page: 'application', label: t('apps.back') });
  const { data, isLoading, error, refetch } = useApplications();
  const closed = data?.filter((a) => a.status === 'REJECTED' || a.status === 'WITHDRAWN') ?? [];

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link to="/app/discover">
          <ArrowLeft /> {t('nav.discover')}
        </Link>
      </Button>
      <PageHeader eyebrow={t('apps.eyebrow')} title={t('apps.title')} description={t('apps.desc')} />
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <CardSkeleton lines={5} />
      ) : !data?.length ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title={t('apps.emptyTitle')}
            description={t('apps.emptyDesc')}
            action={
              <Button asChild>
                <Link to="/app/discover?tab=jobs">{t('apps.find')}</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="-mx-4 overflow-x-auto px-4 pb-3 scrollbar-thin sm:mx-0 sm:px-0">
            <div className="grid min-w-[1080px] grid-cols-6 gap-3">
              {APPLICATION_PIPELINE.map((status) => {
                const items = data.filter((a) => a.status === status);
                return (
                  <section key={status} className="rounded-xl bg-surface-2/70 p-2.5" aria-label={labels.appStatus(status)}>
                    <div className="mb-2 flex items-center justify-between px-1">
                      <h2 className="text-[13px] font-semibold">{labels.appStatus(status)}</h2>
                      <span className="rounded-md bg-surface px-1.5 text-[11.5px] font-semibold tabular text-muted-foreground">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((a) => (
                        <AppCard key={a.id} app={a} />
                      ))}
                      {items.length === 0 && <p className="px-1 py-4 text-center text-[12px] text-subtle-foreground">—</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
          {closed.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-[14px] font-semibold text-muted-foreground">{t('apps.closed')}</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {closed.map((a) => (
                  <AppCard key={a.id} app={a} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AppCard({ app }: { app: ApplicationView }) {
  const { t } = useT();
  const days = daysUntil(app.deadline);
  return (
    <Link to={`/app/discover/applications/${app.id}`} className="card block p-3 transition hover:-translate-y-0.5 hover:border-border-strong">
      <div className="flex items-start gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted-orange text-orange-strong dark:text-orange">
          <BriefcaseBusiness className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{app.opportunity.title}</p>
          <p className="truncate text-[12px] text-muted-foreground">{app.opportunity.company}</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <MatchChip value={app.matchScore} className="px-1.5 py-0.5 text-[11px]" />
        {days !== null && days >= 0 && ['SAVED', 'PREPARING'].includes(app.status) && (
          <Badge tone={days <= 3 ? 'orange' : 'outline'} className={cn('text-[11px]')}>
            <Clock /> {t('date.daysShort', { days })}
          </Badge>
        )}
      </div>
      {['SAVED', 'PREPARING'].includes(app.status) && <Progress value={app.prepProgress} className="mt-2.5 h-1" label={t('apps.prepProgress')} />}
      <p className="mt-2 line-clamp-2 text-[11.5px] text-muted-foreground">{t('apps.next', { action: app.nextAction })}</p>
    </Link>
  );
}
