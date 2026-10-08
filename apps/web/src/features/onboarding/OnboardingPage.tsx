import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDashed,
  ClipboardPaste,
  FileText,
  LogOut,
  Orbit as OrbitIcon,
  Sparkles,
  Target,
  Upload,
  X,
} from 'lucide-react';
import {
  CAREER_INTERESTS,
  INDUSTRIES,
  OPPORTUNITY_TYPE_LABELS,
  OPPORTUNITY_TYPES,
  WORK_MODE_LABELS,
  WORK_MODES,
  type AnalyzeProfileResult,
  type CareerRoleView,
  type CvUploadResult,
  type OpportunityType,
  type WorkMode,
} from '@orbit/shared';
import { Logo, ReadinessRing } from '@/components/brand/brand';
import { Button } from '@/components/ui/button';
import { Badge, Input, Label, Progress, Skeleton, Textarea } from '@/components/ui/primitives';
import { ChipGroup } from '@/components/ui/form-controls';
import { ErrorState } from '@/components/common/states';
import { useAnalyzeProfile, useRoles, useUploadCv } from '@/hooks/queries';
import { roleIcon } from '@/lib/icons';
import { signOut } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { useSessionStore } from '@/stores/session';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/common/ThemeToggle';

const STEPS = ['Direction', 'CV', 'Interests', 'Preferences', 'Context', 'Analyze'] as const;

const ROLE_TO_INTEREST: Record<string, string> = {
  'product-manager': 'Product Management',
  'software-engineer': 'Software Engineering',
  'ai-engineer': 'AI / Machine Learning',
  'data-analyst': 'Data',
  'ux-designer': 'UI/UX',
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const [step, setStep] = useState(0);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);
  const [role, setRole] = useState<string | null>(null);
  const [aspiration, setAspiration] = useState('');
  const [cv, setCv] = useState<CvUploadResult | null>(null);
  const [cvText, setCvText] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [workModes, setWorkModes] = useState<WorkMode[]>(['HYBRID']);
  const [locations, setLocations] = useState<string[]>([]);
  const [roleTypes, setRoleTypes] = useState<OpportunityType[]>(['INTERNSHIP']);
  const [context, setContext] = useState('');
  const [result, setResult] = useState<AnalyzeProfileResult | null>(null);
  const analyze = useAnalyzeProfile();

  const canContinue = step === 0 ? Boolean(role) : true;

  const run = () => {
    setStep(5);
    const additional = [aspiration.trim() && `Career aspiration: ${aspiration.trim()}`, context.trim()].filter(Boolean).join('\n');
    analyze.mutate(
      {
        targetRoleSlug: role!,
        cvText: cv ? undefined : cvText.trim() || undefined,
        interests,
        preferredIndustries: industries,
        preferredWorkModes: workModes,
        preferredLocations: locations,
        preferredRoleTypes: roleTypes,
        additionalContext: additional || undefined,
      },
      { onSuccess: (r) => setResult(r) },
    );
  };

  const next = () => {
    if (step === 0 && role && interests.length === 0 && ROLE_TO_INTEREST[role]) setInterests([ROLE_TO_INTEREST[role]]);
    if (step === 4) run();
    else setStep((s) => Math.min(5, s + 1));
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(10,180,106,0.10),transparent_60%)]" aria-hidden />
      <header className="relative mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => void signOut().then(() => navigate('/'))}>
            <LogOut /> Sign out
          </Button>
        </div>
      </header>
      <main className="relative mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        {!result && (
          <div className="mb-8 mt-4">
            <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-muted-foreground">
              <span>
                Step {Math.min(step + 1, STEPS.length)} of {STEPS.length} · {STEPS[Math.min(step, STEPS.length - 1)]}
              </span>
              <span>{Math.round(((step + (analyze.isPending ? 0.5 : 0)) / STEPS.length) * 100)}%</span>
            </div>
            <Progress value={((step + (analyze.isPending ? 0.5 : 0)) / STEPS.length) * 100} tone="gradient" label="Onboarding progress" />
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={result ? 'result' : step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
            {result ? (
              <ResultStep result={result} onExplore={() => navigate('/app/universe')} onHome={() => navigate('/app')} />
            ) : step === 0 ? (
              <DirectionStep name={user?.name ?? ''} role={role} setRole={setRole} aspiration={aspiration} setAspiration={setAspiration} />
            ) : step === 1 ? (
              <CvStep cv={cv} setCv={setCv} cvText={cvText} setCvText={setCvText} />
            ) : step === 2 ? (
              <StepCard title="What are you interested in?" subtitle="Pick the fields you want Orbit to watch for you. You can change these anytime.">
                <ChipGroup label="Career interests" options={CAREER_INTERESTS.map((v) => ({ value: v, label: v }))} value={interests} onChange={setInterests} />
              </StepCard>
            ) : step === 3 ? (
              <PreferencesStep
                industries={industries}
                setIndustries={setIndustries}
                workModes={workModes}
                setWorkModes={setWorkModes}
                locations={locations}
                setLocations={setLocations}
                roleTypes={roleTypes}
                setRoleTypes={setRoleTypes}
              />
            ) : step === 4 ? (
              <StepCard title="Anything else Orbit should know?" subtitle="Tell Orbit anything else about your career goals — constraints, ambitions, worries.">
                <Label htmlFor="ctx" className="sr-only">
                  Additional context
                </Label>
                <Textarea
                  id="ctx"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={6}
                  maxLength={2000}
                  placeholder="For example: I want to become a Product Manager. I'm comfortable leading teams and talking to users, but I'm not confident with data yet."
                />
                <p className="mt-2 text-right text-xs text-subtle-foreground">{context.length}/2000</p>
              </StepCard>
            ) : (
              <AnalyzeStep pending={analyze.isPending} error={analyze.error} onRetry={run} hasCv={Boolean(cv || cvText.trim())} />
            )}
          </motion.div>
        </AnimatePresence>

        {!result && step < 5 && (
          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft /> Back
            </Button>
            <div className="flex items-center gap-2">
              {step === 1 && !cv && !cvText.trim() && (
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Skip for now
                </Button>
              )}
              <Button onClick={next} disabled={!canContinue} size="lg" variant={step === 4 ? 'gradient' : 'primary'}>
                {step === 4 ? (
                  <>
                    <Sparkles /> Analyze my profile
                  </>
                ) : (
                  <>
                    Continue <ArrowRight />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StepCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="text-[28px] font-bold leading-tight sm:text-[34px]">{title}</h1>
      <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">{subtitle}</p>
      <div className="mt-7">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function DirectionStep({
  name,
  role,
  setRole,
  aspiration,
  setAspiration,
}: {
  name: string;
  role: string | null;
  setRole: (r: string) => void;
  aspiration: string;
  setAspiration: (s: string) => void;
}) {
  const { data: roles, isLoading, error, refetch } = useRoles();
  return (
    <StepCard title={`Welcome to Orbit${name ? `, ${name.split(' ')[0]}` : ''}.`} subtitle="Where do you want your career to go? Choose the role you are aiming for — Orbit measures your readiness against it.">
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Target role">
          {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)}
          {roles?.map((r: CareerRoleView) => {
            const Icon = roleIcon(r.icon);
            const active = role === r.slug;
            return (
              <button
                key={r.slug}
                role="radio"
                aria-checked={active}
                onClick={() => setRole(r.slug)}
                className={cn(
                  'group flex items-start gap-3.5 rounded-xl border bg-surface p-4 text-left transition',
                  active ? 'border-green shadow-[0_0_0_4px_var(--ring)]' : 'border-border hover:border-border-strong hover:shadow-card',
                )}
              >
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl transition', active ? 'bg-green text-white' : 'bg-surface-2 text-muted-foreground group-hover:text-green')}>
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold">
                    {r.title}
                    {active && <Check className="size-4 text-green" />}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted-foreground">{r.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-6">
        <Label htmlFor="aspiration">In your own words (optional)</Label>
        <Input id="aspiration" className="mt-1.5" value={aspiration} onChange={(e) => setAspiration(e.target.value)} placeholder="I want to become a Product Manager at a fintech company." maxLength={200} />
      </div>
    </StepCard>
  );
}

function CvStep({ cv, setCv, cvText, setCvText }: { cv: CvUploadResult | null; setCv: (c: CvUploadResult | null) => void; cvText: string; setCvText: (s: string) => void }) {
  const upload = useUploadCv();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [loadingSample, setLoadingSample] = useState(false);

  const handle = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (file.type !== 'application/pdf') {
        upload.reset();
        alertOnce('Please upload a PDF file.');
        return;
      }
      upload.mutate(file, { onSuccess: setCv });
    },
    [upload, setCv],
  );

  const loadSampleCv = async () => {
    setLoadingSample(true);
    try {
      const blob = await fetch('/demo/sample-cv-stanley-wijaya.pdf').then((r) => r.blob());
      handle(new File([blob], 'sample-cv-stanley-wijaya.pdf', { type: 'application/pdf' }));
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <StepCard title="Upload your CV" subtitle="Orbit reads your experience, skills and achievements to build your Career Intelligence. PDF, up to 5 MB.">
      <div className="mb-4 inline-flex rounded-xl border border-border bg-surface-2 p-1">
        {(['upload', 'paste'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cn('flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition', mode === m ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground')}>
            {m === 'upload' ? <Upload className="size-3.5" /> : <ClipboardPaste className="size-3.5" />}
            {m === 'upload' ? 'Upload PDF' : 'Paste text'}
          </button>
        ))}
      </div>

      {mode === 'upload' ? (
        cv ? (
          <div className="card flex items-start gap-4 p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted-green text-green">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{cv.file.filename}</p>
              <p className="text-[13px] text-muted-foreground">{cv.characters.toLocaleString()} characters extracted · ready to analyze</p>
              <p className="mt-3 line-clamp-3 whitespace-pre-line rounded-lg bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed text-muted-foreground">{cv.preview}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setCv(null)} aria-label="Remove CV">
              <X />
            </Button>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handle(e.dataTransfer.files[0]);
            }}
            className={cn('flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition', dragging ? 'border-green bg-muted-green/50' : 'border-border-strong bg-surface')}
          >
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted-green text-green">
              <Upload className="size-5" />
            </div>
            <p className="font-semibold">{upload.isPending ? 'Uploading and reading your CV…' : 'Drop your CV here'}</p>
            <p className="mt-1 text-sm text-muted-foreground">or choose a PDF from your device</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={() => inputRef.current?.click()} loading={upload.isPending}>
                Choose PDF
              </Button>
              <Button variant="secondary" onClick={() => void loadSampleCv()} loading={loadingSample} disabled={upload.isPending}>
                Use sample CV
              </Button>
            </div>
            <input ref={inputRef} type="file" accept="application/pdf" className="sr-only" onChange={(e) => handle(e.target.files?.[0])} aria-label="Upload CV PDF" />
            {upload.error && <p className="mt-4 max-w-md text-sm text-danger" role="alert">{errorMessage(upload.error)}</p>}
          </div>
        )
      ) : (
        <div>
          <Label htmlFor="cvtext" className="sr-only">
            CV text
          </Label>
          <Textarea id="cvtext" rows={12} value={cvText} onChange={(e) => setCvText(e.target.value)} placeholder="Paste the text of your CV here…" maxLength={30000} className="font-mono text-[12.5px]" />
          <p className="mt-2 text-xs text-subtle-foreground">Pasted text is used only to build your Career Intelligence.</p>
        </div>
      )}
    </StepCard>
  );
}

let alerted = false;
function alertOnce(msg: string) {
  if (alerted) return;
  alerted = true;
  setTimeout(() => (alerted = false), 1500);
  // Using the toast system keeps this non-blocking.
  void import('sonner').then(({ toast }) => toast.error(msg));
}

function PreferencesStep(p: {
  industries: string[];
  setIndustries: (v: string[]) => void;
  workModes: WorkMode[];
  setWorkModes: (v: WorkMode[]) => void;
  locations: string[];
  setLocations: (v: string[]) => void;
  roleTypes: OpportunityType[];
  setRoleTypes: (v: OpportunityType[]) => void;
}) {
  const [loc, setLoc] = useState('');
  const quickLocations = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Singapore'];
  const addLoc = (l: string) => {
    const v = l.trim();
    if (v && !p.locations.includes(v)) p.setLocations([...p.locations, v]);
    setLoc('');
  };
  return (
    <StepCard title="Your preferences" subtitle="Orbit uses these to rank opportunities — preference match is 15% of every job score.">
      <div className="space-y-7">
        <div>
          <p className="mb-2.5 text-sm font-semibold">Role type</p>
          <ChipGroup label="Role type" options={OPPORTUNITY_TYPES.map((v) => ({ value: v, label: OPPORTUNITY_TYPE_LABELS[v] }))} value={p.roleTypes} onChange={p.setRoleTypes} />
        </div>
        <div>
          <p className="mb-2.5 text-sm font-semibold">Work mode</p>
          <ChipGroup label="Work mode" options={WORK_MODES.map((v) => ({ value: v, label: WORK_MODE_LABELS[v] }))} value={p.workModes} onChange={p.setWorkModes} />
        </div>
        <div>
          <p className="mb-2.5 text-sm font-semibold">Industries</p>
          <ChipGroup label="Industries" options={INDUSTRIES.map((v) => ({ value: v, label: v }))} value={p.industries} onChange={p.setIndustries} />
        </div>
        <div>
          <Label htmlFor="loc" className="mb-2.5 block text-sm font-semibold">
            Locations
          </Label>
          <div className="flex gap-2">
            <Input
              id="loc"
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLoc(loc);
                }
              }}
              placeholder="Add a city and press Enter"
            />
            <Button variant="secondary" onClick={() => addLoc(loc)} disabled={!loc.trim()}>
              Add
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.locations.map((l) => (
              <Badge key={l} tone="green" className="py-1 pl-2.5 pr-1 text-[12.5px]">
                {l}
                <button onClick={() => p.setLocations(p.locations.filter((x) => x !== l))} className="rounded p-0.5 hover:bg-white/50" aria-label={`Remove ${l}`}>
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            {quickLocations
              .filter((l) => !p.locations.includes(l))
              .map((l) => (
                <button key={l} onClick={() => addLoc(l)} className="rounded-md border border-dashed border-border-strong px-2 py-0.5 text-[12.5px] text-muted-foreground hover:border-green hover:text-green">
                  + {l}
                </button>
              ))}
          </div>
        </div>
      </div>
    </StepCard>
  );
}

const ANALYSIS_LABELS = ['Reading your experience', 'Mapping your strengths', 'Identifying career gaps', 'Calculating career readiness', 'Building your Orbit'];

function AnalyzeStep({ pending, error, onRetry, hasCv }: { pending: boolean; error: unknown; onRetry: () => void; hasCv: boolean }) {
  return (
    <section className="py-6 text-center">
      <div className="relative mx-auto mb-8 flex size-28 items-center justify-center">
        <div className="absolute inset-0 animate-orbit-spin rounded-full border-2 border-dashed border-green/40" />
        <div className="absolute inset-3 animate-orbit-spin-reverse rounded-full border border-orange/40" />
        <div className="orbit-gradient flex size-14 items-center justify-center rounded-full text-white shadow-[0_12px_40px_-8px_rgba(10,180,106,0.9)]">
          <OrbitIcon className="size-6" />
        </div>
      </div>
      <h1 className="text-[26px] font-bold">{error ? 'Analysis paused' : 'Building your Career Intelligence'}</h1>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">
        {error ? errorMessage(error) : hasCv ? 'Orbit is analyzing your CV against your target role. This usually takes a few seconds.' : 'Orbit is analyzing your answers against your target role.'}
      </p>
      <ul className="mx-auto mt-8 max-w-sm space-y-2.5 text-left" aria-live="polite">
        {ANALYSIS_LABELS.map((label) => (
          <li key={label} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
            {pending ? <CircleDashed className="size-4 animate-spin text-green" style={{ animationDuration: '2.4s' }} /> : <Target className="size-4 text-muted-foreground" />}
            <span className={cn(pending ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
          </li>
        ))}
      </ul>
      {Boolean(error) && (
        <Button className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      )}
    </section>
  );
}

function ResultStep({ result, onExplore, onHome }: { result: AnalyzeProfileResult; onExplore: () => void; onHome: () => void }) {
  const intel = result.intelligence;
  const gaps = useMemo(() => intel.gaps.slice(0, 4), [intel.gaps]);
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone="green">
          <Check /> Career Intelligence ready
        </Badge>
        <Badge tone="outline">{result.extractionSource === 'AI' ? 'AI extraction' : result.extractionSource === 'HEURISTIC' ? 'Structured CV parsing' : 'From your answers'}</Badge>
      </div>
      <div className="card overflow-hidden">
        <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
          <ReadinessRing score={intel.readiness?.score ?? 0} size={180} />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-green-strong dark:text-green">Target role</p>
            <h1 className="mt-1 text-[30px] font-bold leading-tight">{intel.targetRole?.title}</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">{intel.careerDna.summary}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {intel.careerDna.traits.map((t) => (
                <Badge key={t} tone="neutral" className="text-[12px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="grid border-t border-border sm:grid-cols-2">
          <div className="border-b border-border p-6 sm:border-b-0 sm:border-r">
            <p className="mb-3 text-sm font-semibold">Current strengths</p>
            <ul className="space-y-2">
              {intel.strengths.slice(0, 4).map((s) => (
                <li key={s.skillId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-green" /> {s.name}
                  </span>
                  <span className="tabular text-muted-foreground">{s.level}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-6">
            <p className="mb-3 text-sm font-semibold">Main gaps</p>
            <ul className="space-y-2.5">
              {gaps.map((g) => (
                <li key={g.skillId} className="text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-orange" /> {g.name}
                    </span>
                    <span className="tabular text-muted-foreground">
                      {g.currentLevel}/{g.requiredLevel}
                    </span>
                  </div>
                  <Progress value={(g.currentLevel / g.requiredLevel) * 100} tone="orange" className="mt-1.5 h-1.5" />
                </li>
              ))}
            </ul>
          </div>
        </div>
        {intel.recommendedFocus && (
          <div className="flex flex-col gap-1 border-t border-border bg-muted-green/40 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-green-strong dark:text-green">Next best action</p>
              <p className="mt-1 font-semibold">{intel.recommendedFocus.title}</p>
              <p className="text-sm text-muted-foreground">{intel.recommendedFocus.reason}</p>
            </div>
          </div>
        )}
      </div>
      <ul className="mt-5 space-y-1 text-[12.5px] text-muted-foreground">
        {result.steps.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            {s.status === 'done' ? <Check className="size-3.5 text-green" /> : <CircleDashed className="size-3.5" />}
            {s.detail}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button size="lg" variant="gradient" onClick={onExplore}>
          <OrbitIcon /> Explore my Career Universe
        </Button>
        <Button size="lg" variant="secondary" onClick={onHome}>
          Go to Mission Control <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
