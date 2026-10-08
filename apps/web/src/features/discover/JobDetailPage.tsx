import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, BookmarkCheck, BookmarkPlus, BrainCircuit, Check, Clock, ExternalLink, MapPin, Route, Sparkles } from 'lucide-react';
import { JOB_MATCH_LABELS, JOB_MATCH_WEIGHTS, OPPORTUNITY_TYPE_LABELS, WORK_MODE_LABELS, type JobMatchComponent } from '@orbit/shared';
import { ReadinessRing } from '@/components/brand/brand';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardEyebrow } from '@/components/ui/primitives';
import { CardSkeleton, ErrorState, ScoreBar } from '@/components/common/states';
import { useAddSkillToJourney, useJob, useSaveJob } from '@/hooks/queries';
import { usePageContext, useUiStore } from '@/stores/ui';
import { daysUntil, friendlyDate } from '@/lib/utils';

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useJob(id);
  const save = useSaveJob();
  const addSkill = useAddSkillToJourney();
  const openAgent = useUiStore((s) => s.openAgent);
  usePageContext({ page: 'discover', entityType: 'job', entityId: id, label: data?.opportunity.title });

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading || !data) return <CardSkeleton lines={8} />;
  const o = data.opportunity;
  const m = data.match;
  const days = daysUntil(o.deadline);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft /> Back
      </Button>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-muted-orange font-display text-lg font-bold text-orange-strong dark:text-orange">{o.company.slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0">
                <h1 className="text-[26px] font-bold leading-tight">{o.title}</h1>
                <p className="mt-1 text-[15px] text-muted-foreground">{o.company}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone="neutral">{OPPORTUNITY_TYPE_LABELS[o.employmentType]}</Badge>
                  <Badge tone="outline">
                    <MapPin /> {o.location}
                  </Badge>
                  <Badge tone="outline">{WORK_MODE_LABELS[o.workMode]}</Badge>
                  {o.salaryRange && <Badge tone="outline">{o.salaryRange}</Badge>}
                  {days !== null && days >= 0 && (
                    <Badge tone={days <= 7 ? 'orange' : 'outline'}>
                      <Clock /> Deadline {friendlyDate(o.deadline)}
                    </Badge>
                  )}
                  {o.isDemo && <Badge tone="outline">Demo listing</Badge>}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {data.saved ? (
                <Button variant="soft" asChild>
                  <Link to={data.applicationId ? `/app/discover/applications/${data.applicationId}` : '/app/discover/applications'}>
                    <BookmarkCheck /> Tracking — open application
                  </Link>
                </Button>
              ) : (
                <Button onClick={() => save.mutate(o.id)} loading={save.isPending}>
                  <BookmarkPlus /> Save & track
                </Button>
              )}
              <Button variant="secondary" onClick={() => openAgent('Am I ready to apply for this role?')}>
                <BrainCircuit /> Am I ready to apply?
              </Button>
              {o.applyUrl && (
                <Button variant="ghost" asChild>
                  <a href={o.applyUrl} target="_blank" rel="noreferrer">
                    <ExternalLink /> Apply on {new URL(o.applyUrl).hostname.replace('www.', '')}
                  </a>
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <CardEyebrow>About the role</CardEyebrow>
            <div className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-muted-foreground">{o.description}</div>
            {o.skills.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {o.skills.map((s) => (
                  <Badge key={s} tone={m.matchedSkills.includes(s) ? 'green' : m.missingSkills.some((x) => x.name === s) ? 'orange' : 'neutral'}>
                    {m.matchedSkills.includes(s) && <Check />} {s}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex items-center gap-5">
              <ReadinessRing score={m.overall} size={112} stroke={10} label="Match" showBand={false} />
              <div>
                <CardEyebrow>Hybrid match</CardEyebrow>
                <p className="mt-1 font-display text-[22px] font-bold leading-tight">{m.overall}% match</p>
                <p className="text-[12.5px] text-muted-foreground">Deterministic score · explained below</p>
              </div>
            </div>
            <div className="mt-5 space-y-3.5">
              {(Object.keys(JOB_MATCH_WEIGHTS) as JobMatchComponent[]).map((k) => (
                <ScoreBar key={k} label={`${JOB_MATCH_LABELS[k]} · ${Math.round(JOB_MATCH_WEIGHTS[k] * 100)}%`} value={m.components[k]} tone={m.components[k] < 55 ? 'orange' : 'green'} />
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <CardEyebrow className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-green" /> Orbit explanation
              <Badge tone="outline" className="ml-auto normal-case tracking-normal">
                {data.explainedBy === 'AI' ? 'AI explanation' : 'From match data'}
              </Badge>
            </CardEyebrow>
            <p className="mt-3 text-[14px] leading-relaxed">{data.explanation}</p>
            {m.reasons.length > 0 && (
              <>
                <p className="mt-4 text-[13px] font-semibold">Why you match</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.reasons.map((r) => (
                    <Badge key={r} tone="green">
                      <Check /> {r}
                    </Badge>
                  ))}
                </div>
              </>
            )}
            {m.missingSkills.length > 0 && (
              <>
                <p className="mt-4 text-[13px] font-semibold">Missing</p>
                <ul className="mt-2 space-y-2">
                  {m.missingSkills.map((s) => (
                    <li key={s.slug} className="flex items-center justify-between gap-3 text-[13.5px]">
                      <span className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-orange" /> {s.name}
                      </span>
                      {s.inJourney ? (
                        <Badge tone="green">In journey</Badge>
                      ) : (
                        <Button size="sm" variant="soft" onClick={() => addSkill.mutate(s.slug)} loading={addSkill.isPending && addSkill.variables === s.slug}>
                          <Route /> Add to Journey
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-5 rounded-lg bg-muted-green/50 px-3.5 py-3 text-[13.5px]">
              <span className="font-semibold">Recommended action · </span>
              {m.recommendedAction}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
