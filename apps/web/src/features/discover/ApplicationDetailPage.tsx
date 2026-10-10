import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, BrainCircuit, Check, Clock, ExternalLink, MessagesSquare, Mic, NotebookPen, Trash2 } from 'lucide-react';
import { APPLICATION_PIPELINE, type ApplicationDetail, type ApplicationStatus, type InterviewSessionView } from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardEyebrow, Progress, Textarea } from '@/components/ui/primitives';
import { Checkbox } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/overlays';
import { CardSkeleton, ErrorState, ScoreBar } from '@/components/common/states';
import { MatchChip } from '@/components/common/MatchChip';
import { useApplication, useInterviewMutations, useRemoveApplication, useUpdateApplication } from '@/hooks/queries';
import { usePageContext, useUiStore } from '@/stores/ui';
import { cn, daysUntil, friendlyDate } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { useLabels } from '@/lib/i18n/labels';

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data, isLoading, error, refetch } = useApplication(id);
  usePageContext({ page: 'application', entityType: 'application', entityId: id, label: data ? `${data.opportunity.title} · ${data.opportunity.company}` : undefined });
  useEffect(() => {
    if (params.get('practice') && data) setTimeout(() => document.getElementById('practice')?.scrollIntoView({ behavior: 'smooth' }), 300);
  }, [params, data]);

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading || !data) return <CardSkeleton lines={8} />;
  return <Detail app={data} />;
}

function Detail({ app }: { app: ApplicationDetail }) {
  const navigate = useNavigate();
  const update = useUpdateApplication();
  const remove = useRemoveApplication();
  const openAgent = useUiStore((s) => s.openAgent);
  const { t } = useT();
  const labels = useLabels();
  const [notes, setNotes] = useState(app.notes ?? '');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ApplicationStatus | null>(null);
  const days = daysUntil(app.deadline);
  const stage = APPLICATION_PIPELINE.indexOf(app.status);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/app/discover/applications">
          <ArrowLeft /> {t('apps.back')}
        </Link>
      </Button>

      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={app.status === 'OFFER' ? 'green' : app.status === 'REJECTED' ? 'danger' : 'orange'}>{labels.appStatus(app.status)}</Badge>
              <MatchChip value={app.matchScore} />
              {days !== null && days >= 0 && (
                <Badge tone={days <= 3 ? 'orange' : 'outline'}>
                  <Clock /> {t('job.deadline', { date: friendlyDate(app.deadline) })}
                </Badge>
              )}
            </div>
            <h1 className="mt-2 text-[26px] font-bold leading-tight">{app.opportunity.title}</h1>
            <p className="text-[15px] text-muted-foreground">
              {app.opportunity.company} · {app.opportunity.location}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <Link to={`/app/discover/jobs/${app.opportunity.id}`}>{t('common.viewMatch')}</Link>
            </Button>
            {app.opportunity.applyUrl && (
              <Button variant="secondary" asChild>
                <a href={app.opportunity.applyUrl} target="_blank" rel="noreferrer">
                  <ExternalLink /> {t('apps.apply')}
                </a>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost">{t('apps.more')}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setPendingStatus('REJECTED')}>{t('apps.markRejected')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPendingStatus('WITHDRAWN')}>{t('apps.withdraw')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setConfirmRemove(true)} className="text-danger">
                  <Trash2 /> {t('apps.removeFromOrbit')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Status stepper */}
        <ol className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label={t('apps.statusLabel')}>
          {APPLICATION_PIPELINE.map((s, i) => {
            const reached = stage >= i && stage !== -1;
            const current = app.status === s;
            return (
              <li key={s}>
                <button
                  onClick={() => !current && setPendingStatus(s)}
                  className={cn(
                    'flex w-full flex-col items-start gap-1.5 rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-medium transition',
                    current ? 'border-green bg-muted-green text-green-strong dark:text-green' : reached ? 'border-border bg-surface text-foreground' : 'border-dashed border-border text-muted-foreground hover:border-border-strong',
                  )}
                  aria-current={current ? 'step' : undefined}
                >
                  <span className={cn('flex size-5 items-center justify-center rounded-full text-[10px] font-bold', reached ? 'bg-green text-white' : 'bg-surface-2 text-muted-foreground')}>
                    {reached && !current ? <Check className="size-3" /> : i + 1}
                  </span>
                  {labels.appStatus(s)}
                </button>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <CardEyebrow>{t('apps.preparation')}</CardEyebrow>
              <span className="text-[13px] font-semibold tabular">{app.prepProgress}%</span>
            </div>
            <Progress value={app.prepProgress} className="mt-2" tone="gradient" label={t('apps.prepProgress')} />
            <ul className="mt-4 space-y-1">
              {app.prepChecklist.map((item) => (
                <li key={item.id}>
                  <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-[14px] hover:bg-surface-2', item.done && 'text-muted-foreground line-through')}>
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={(v) => update.mutate({ id: app.id, prepChecklist: app.prepChecklist.map((x) => (x.id === item.id ? { ...x, done: Boolean(v) } : x)) })}
                      aria-label={item.label}
                    />
                    <span className="min-w-0 flex-1">{item.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-lg bg-muted-green/50 px-3.5 py-2.5 text-[13.5px]">
              <span className="font-semibold">{t('apps.nextAction')}</span>
              {app.nextAction}
            </p>
          </Card>

          <InterviewPractice app={app} />
        </div>

        <div className="space-y-5">
          <Card className="p-6">
            <CardEyebrow className="flex items-center gap-1.5">
              <NotebookPen className="size-3.5" /> {t('apps.notes')}
            </CardEyebrow>
            <Textarea className="mt-3" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('apps.notesPlaceholder')} maxLength={5000} />
            <Button size="sm" className="mt-2" variant="secondary" disabled={notes === (app.notes ?? '')} loading={update.isPending} onClick={() => update.mutate({ id: app.id, notes })}>
              {t('apps.saveNotes')}
            </Button>
          </Card>
          <Card className="p-6">
            <CardEyebrow>{t('apps.snapshot')}</CardEyebrow>
            <p className="mt-2 text-[13.5px]">
              <span className="font-semibold">{t('apps.strengths')}</span>
              <span className="text-muted-foreground">{app.match.reasons.join(', ') || '—'}</span>
            </p>
            <p className="mt-1 text-[13.5px]">
              <span className="font-semibold">{t('apps.gaps')}</span>
              <span className="text-muted-foreground">{app.match.missingSkills.map((m) => m.name).join(', ') || t('apps.noneCritical')}</span>
            </p>
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => openAgent(t('agent.prompt.readyApply'))}>
              <BrainCircuit /> {t('common.askOrbit')}
            </Button>
          </Card>
          {app.relatedNotes.length > 0 && (
            <Card className="p-6">
              <CardEyebrow>{t('apps.relatedNotes')}</CardEyebrow>
              <ul className="mt-3 space-y-3">
                {app.relatedNotes.map((n) => (
                  <li key={n.id} className="text-[13.5px]">
                    <p className="font-semibold">{n.title}</p>
                    <p className="line-clamp-2 text-muted-foreground">{n.content}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={Boolean(pendingStatus)} onOpenChange={(o) => !o && setPendingStatus(null)}>
        <DialogContent title={t('apps.moveTo', { status: pendingStatus ? labels.appStatus(pendingStatus) : '' })} description={t('apps.moveDesc')}>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingStatus(null)}>
              {t('common.cancel')}
            </Button>
            <Button loading={update.isPending} onClick={() => pendingStatus && update.mutate({ id: app.id, status: pendingStatus }, { onSuccess: () => setPendingStatus(null) })}>
              {t('common.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent title={t('apps.removeTitle')} description={t('apps.removeDesc')}>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
              {t('common.keep')}
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(app.id, { onSuccess: () => navigate('/app/discover/applications') })}>
              {t('common.remove')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InterviewPractice({ app }: { app: ApplicationDetail }) {
  const { start, answer, complete } = useInterviewMutations(app.id);
  const active = app.interviews.find((s) => s.status === 'IN_PROGRESS');
  const past = app.interviews.filter((s) => s.status === 'COMPLETED');
  const { t } = useT();
  return (
    <Card id="practice" className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardEyebrow className="flex items-center gap-1.5">
            <Mic className="size-3.5" /> {t('apps.practice')}
          </CardEyebrow>
          <p className="mt-1 text-[13.5px] text-muted-foreground">{t('apps.practiceDesc')}</p>
        </div>
        {!active && (
          <Button onClick={() => start.mutate()} loading={start.isPending}>
            <MessagesSquare /> {t('apps.startPractice')}
          </Button>
        )}
      </div>
      {active && <ActiveSession session={active} onAnswer={(questionId, text) => answer.mutate({ sessionId: active.id, questionId, answer: text })} answering={answer.isPending ? answer.variables?.questionId : undefined} onFinish={() => complete.mutate(active.id)} finishing={complete.isPending} />}
      {past.map((s) => (
        <PastSession key={s.id} session={s} />
      ))}
    </Card>
  );
}

function ActiveSession({
  session,
  onAnswer,
  answering,
  onFinish,
  finishing,
}: {
  session: InterviewSessionView;
  onAnswer: (questionId: string, answer: string) => void;
  answering?: string;
  onFinish: () => void;
  finishing: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const answered = session.questions.filter((q) => q.answer).length;
  const { t } = useT();
  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
        <span>
          {t('apps.answered', { done: answered, total: session.questions.length, source: session.generatedBy === 'AI' ? t('apps.aiQuestions') : t('apps.bankQuestions') })}
        </span>
      </div>
      {session.questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <Badge tone="neutral">{q.focus}</Badge>
              <p className="mt-1.5 text-[14.5px] font-medium leading-snug">{q.question}</p>
              {q.answer ? (
                <>
                  <p className="mt-2 whitespace-pre-line rounded-lg bg-surface-2 p-3 text-[13.5px] text-muted-foreground">{q.answer}</p>
                  {q.feedback && (
                    <p className="mt-2 flex gap-2 rounded-lg bg-muted-green/60 p-3 text-[13px]">
                      <BrainCircuit className="mt-0.5 size-4 shrink-0 text-green" /> {q.feedback}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <Textarea className="mt-2" rows={4} value={drafts[q.id] ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))} placeholder={t('apps.answerPlaceholder')} aria-label={t('apps.answerLabel', { n: i + 1 })} maxLength={4000} />
                  <Button size="sm" className="mt-2" disabled={(drafts[q.id] ?? '').trim().length < 5} loading={answering === q.id} onClick={() => onAnswer(q.id, drafts[q.id])}>
                    {t('apps.getFeedback')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
      <Button variant="gradient" onClick={onFinish} loading={finishing} disabled={answered === 0}>
        {t('apps.finish')}
      </Button>
    </div>
  );
}

function PastSession({ session }: { session: InterviewSessionView }) {
  const s = session.scores;
  const { t } = useT();
  return (
    <div className="mt-5 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold">{t('apps.practiceOn', { date: friendlyDate(session.completedAt) })}</p>
        <Badge tone="outline">{t('apps.coaching')}</Badge>
      </div>
      {s && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ScoreBar label={t('apps.score.communication')} value={s.communication} />
          <ScoreBar label={t('apps.score.structure')} value={s.structure} />
          <ScoreBar label={t('apps.score.roleKnowledge')} value={s.roleKnowledge} tone={s.roleKnowledge < 55 ? 'orange' : 'green'} />
          <ScoreBar label={t('apps.score.examples')} value={s.examples} tone={s.examples < 55 ? 'orange' : 'green'} />
          <ScoreBar label={t('apps.score.confidence')} value={s.confidence} />
        </div>
      )}
      {session.summary && <p className="mt-3 text-[13px] text-muted-foreground">{session.summary}</p>}
    </div>
  );
}
