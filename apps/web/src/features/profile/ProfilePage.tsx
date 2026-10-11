import { useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  Award,
  BriefcaseBusiness,
  Dna,
  ExternalLink,
  FileText,
  GraduationCap,
  Link2,
  Pencil,
  Plus,
  RefreshCcw,
  Route,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  EXPERIENCE_TYPES,
  type CareerIntelligence,
  type ExperienceType,
  type ProfileDetail,
} from '@orbit/shared';
import { ReadinessRing } from '@/components/brand/brand';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardEyebrow, Input, Label, Progress, Textarea } from '@/components/ui/primitives';
import { Checkbox, Select } from '@/components/ui/form-controls';
import { Dialog, DialogContent, Tooltip } from '@/components/ui/overlays';
import { CardSkeleton, ErrorState, PageHeader, SectionTitle } from '@/components/common/states';
import {
  useAddSkillToJourney,
  useAnalyzeProfile,
  useExperienceMutations,
  useIntelligence,
  useProfile,
  useSkillsCatalog,
  useUpdateProfile,
  useUploadCv,
} from '@/hooks/queries';
import { usePageContext } from '@/stores/ui';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { useLabels } from '@/lib/i18n/labels';
import { localeDate, safeUrl } from '@/lib/utils';

export default function ProfilePage() {
  usePageContext({ page: 'profile' });
  const profile = useProfile();
  const intel = useIntelligence();
  if (profile.error || intel.error) return <ErrorState error={profile.error ?? intel.error} onRetry={() => void Promise.all([profile.refetch(), intel.refetch()])} />;
  if (!profile.data || !intel.data) return <CardSkeleton lines={8} />;
  return <ProfileBody p={profile.data} intel={intel.data} />;
}

function ProfileBody({ p, intel }: { p: ProfileDetail; intel: CareerIntelligence }) {
  const addSkillToJourney = useAddSkillToJourney();
  const [editOpen, setEditOpen] = useState(false);
  const { t } = useT();
  const labels = useLabels();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('profile.eyebrow')} title={p.user.name} description={p.profile.headline ?? t('profile.headlineFallback')} actions={<Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil /> {t('profile.edit')}</Button>} />

      {/* Career DNA */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
          <ReadinessRing score={intel.readiness?.score ?? 0} size={164} className="justify-self-center md:justify-self-auto" />
          <div className="min-w-0">
            <CardEyebrow className="flex items-center gap-1.5">
              <Dna className="size-3.5 text-green" /> {t('profile.dna')}
            </CardEyebrow>
            <h2 className="mt-1 text-[24px] font-bold leading-tight">{intel.targetRole?.title ?? t('profile.noTarget')}</h2>
            <p className="mt-1 text-[15px] font-medium">{intel.careerDna.headline}</p>
            <p className="mt-1.5 text-[14px] text-muted-foreground">{intel.careerDna.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {intel.careerDna.traits.map((trait) => (
                <Badge key={trait} tone="green">
                  {trait}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-xl bg-surface-2 p-4 text-[13px] md:w-60">
            <p className="font-semibold">{t('profile.preferences')}</p>
            <p className="text-muted-foreground">{intel.preferences.roleTypes.map((r) => labels.oppType(r)).join(', ') || t('profile.anyRole')}</p>
            <p className="text-muted-foreground">{intel.preferences.workModes.map((w) => labels.workMode(w)).join(', ') || t('profile.anyMode')}</p>
            <p className="text-muted-foreground">{intel.preferences.locations.join(', ') || t('profile.anyLocation')}</p>
            <p className="text-muted-foreground">{intel.preferences.industries.map((i) => labels.industry(i)).join(', ') || t('profile.anyIndustry')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 border-t border-border md:grid-cols-2">
          <div className="border-b border-border p-6 md:border-b-0 md:border-r">
            <p className="mb-3 text-sm font-semibold">{t('profile.strengths')}</p>
            <ul className="space-y-2.5">
              {intel.strengths.map((s) => (
                <li key={s.skillId}>
                  <div className="flex justify-between gap-3 text-[13.5px]">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground">{labels.skillLevel(s.level)}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground">{s.reason}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-6">
            <p className="mb-3 text-sm font-semibold">{t('profile.gaps')}</p>
            <ul className="space-y-3">
              {intel.gaps.slice(0, 6).map((g) => (
                <li key={g.skillId}>
                  <div className="flex items-center justify-between gap-3 text-[13.5px]">
                    <span className="font-medium">{g.name}</span>
                    {g.inJourney ? (
                      <Badge tone="green">{t('common.inJourney')}</Badge>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => addSkillToJourney.mutate(g.slug)}>
                        <Route /> {t('common.add')}
                      </Button>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Progress value={(g.currentLevel / g.requiredLevel) * 100} tone="orange" className="h-1.5" label={t('profile.gapProgress', { name: g.name })} />
                    <span className="shrink-0 text-[11.5px] tabular text-muted-foreground">
                      {g.currentLevel}/{g.requiredLevel}
                    </span>
                  </div>
                </li>
              ))}
              {intel.gaps.length === 0 && <li className="text-[13px] text-muted-foreground">{t('profile.noGaps')}</li>}
            </ul>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <ExperiencesCard p={p} />
          <SkillsCard p={p} />
        </div>
        <div className="space-y-5">
          <CvCard p={p} />
          <EducationAchievements p={p} />
          <LinksCard p={p} />
        </div>
      </div>
      <EditProfileDialog p={p} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

function ExperiencesCard({ p }: { p: ProfileDetail }) {
  const { add, remove } = useExperienceMutations();
  const { t } = useT();
  const labels = useLabels();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ type: ExperienceType; title: string; organization: string; description: string; startDate: string; endDate: string; current: boolean }>({
    type: 'PROJECT',
    title: '',
    organization: '',
    description: '',
    startDate: '',
    endDate: '',
    current: false,
  });
  return (
    <Card className="p-6">
      <SectionTitle icon={BriefcaseBusiness} title={t('profile.experience')} action={<Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus /> {t('common.add')}</Button>} />
      <ul className="divide-y divide-border">
        {p.experiences.map((e) => (
          <li key={e.id} className="group flex gap-3 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{e.title}</p>
                <Badge tone="neutral">{labels.expType(e.type)}</Badge>
              </div>
              <p className="text-[13px] text-muted-foreground">
                {e.organization}
                {e.startDate ? ` · ${localeDate(e.startDate, { month: 'short', year: 'numeric' })} – ${e.current ? t('profile.present') : e.endDate ? localeDate(e.endDate, { month: 'short', year: 'numeric' }) : ''}` : ''}
              </p>
              {e.description && <p className="mt-1.5 line-clamp-3 text-[13.5px] text-muted-foreground">{e.description}</p>}
            </div>
            <Button variant="ghost" size="icon-sm" className="opacity-50 group-hover:opacity-100" onClick={() => remove.mutate(e.id)} aria-label={t('profile.removeItem', { name: e.title })}>
              <Trash2 />
            </Button>
          </li>
        ))}
        {p.experiences.length === 0 && <li className="py-6 text-center text-[13px] text-muted-foreground">{t('profile.expEmpty')}</li>}
      </ul>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t('profile.addExp')} description={t('profile.addExpDesc')}>
          <div className="space-y-3">
            <div>
              <Label>{t('profile.type')}</Label>
              <Select className="mt-1.5" value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ExperienceType })} options={EXPERIENCE_TYPES.map((et) => ({ value: et, label: labels.expType(et) }))} label={t('profile.expType')} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ex-title">{t('profile.expTitle')}</Label>
                <Input id="ex-title" className="mt-1.5" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ex-org">{t('profile.org')}</Label>
                <Input id="ex-org" className="mt-1.5" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ex-start">{t('profile.start')}</Label>
                <Input id="ex-start" type="month" className="mt-1.5" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ex-end">{t('profile.end')}</Label>
                <Input id="ex-end" type="month" className="mt-1.5" disabled={form.current} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.current} onCheckedChange={(v) => setForm({ ...form, current: Boolean(v) })} /> {t('profile.current')}
            </label>
            <div>
              <Label htmlFor="ex-desc">{t('profile.expDesc')}</Label>
              <Textarea id="ex-desc" className="mt-1.5" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={form.title.trim().length < 2 || !form.organization.trim()}
              loading={add.isPending}
              onClick={() =>
                add.mutate(
                  {
                    type: form.type,
                    title: form.title.trim(),
                    organization: form.organization.trim(),
                    description: form.description.trim() || undefined,
                    startDate: form.startDate ? new Date(`${form.startDate}-01`).toISOString() : undefined,
                    endDate: !form.current && form.endDate ? new Date(`${form.endDate}-01`).toISOString() : undefined,
                    current: form.current,
                  },
                  { onSuccess: () => setOpen(false) },
                )
              }
            >
              {t('profile.addExp')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SkillsCard({ p }: { p: ProfileDetail }) {
  const { upsertSkill, removeSkill } = useExperienceMutations();
  const { data: catalog = [] } = useSkillsCatalog();
  const { t } = useT();
  const labels = useLabels();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [level, setLevel] = useState(50);
  const owned = new Set(p.skills.map((s) => s.skill.slug));
  return (
    <Card className="p-6">
      <SectionTitle icon={GraduationCap} title={t('profile.skills')} action={<Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus /> {t('common.add')}</Button>} />
      <p className="-mt-1 mb-4 text-[12.5px] text-muted-foreground">{t('profile.skillsNote')}</p>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {p.skills.map((s) => (
          <li key={s.id} className="group">
            <div className="flex items-center justify-between gap-2 text-[13.5px]">
              <span className="truncate font-medium">{s.skill.name}</span>
              <span className="flex items-center gap-1">
                <Tooltip content={t('profile.skillTip', { level: s.level, source: s.source.toLowerCase() })}>
                  <span className="text-[12px] tabular text-muted-foreground">
                    {labels.skillLevel(s.effectiveLevel)} · {s.effectiveLevel}
                  </span>
                </Tooltip>
                <button className="rounded p-1 text-subtle-foreground opacity-0 transition hover:text-danger group-hover:opacity-100" onClick={() => removeSkill.mutate(s.id)} aria-label={t('profile.removeItem', { name: s.skill.name })}>
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </div>
            <Progress value={s.effectiveLevel} className="mt-1 h-1.5" label={s.skill.name} />
          </li>
        ))}
      </ul>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t('profile.skillDialog')} description={t('profile.skillDialogDesc')}>
          <div className="space-y-4">
            <div>
              <Label>{t('profile.skill')}</Label>
              <Select className="mt-1.5" value={slug || undefined} onValueChange={setSlug} placeholder={t('profile.chooseSkill')} options={catalog.map((s) => ({ value: s.slug, label: `${s.name}${owned.has(s.slug) ? ` ${t('profile.update')}` : ''}` }))} label={t('profile.skill')} />
            </div>
            <div>
              <Label htmlFor="lvl">
                {t('profile.level', { level, label: labels.skillLevel(level) })}
              </Label>
              <input id="lvl" type="range" min={0} max={100} step={5} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="mt-2 w-full accent-[#0AB46A]" />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!slug} loading={upsertSkill.isPending} onClick={() => upsertSkill.mutate({ skillSlug: slug, level }, { onSuccess: () => setOpen(false) })}>
              {t('profile.saveSkill')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CvCard({ p }: { p: ProfileDetail }) {
  const upload = useUploadCv();
  const analyze = useAnalyzeProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useT();
  const primary = p.goals.find((g) => g.isPrimary);
  const reanalyze = () =>
    primary &&
    analyze.mutate(
      {
        targetRoleSlug: primary.role.slug,
        interests: p.profile.interests,
        preferredIndustries: p.profile.preferredIndustries,
        preferredWorkModes: p.profile.preferredWorkModes,
        preferredLocations: p.profile.preferredLocations,
        preferredRoleTypes: p.profile.preferredRoleTypes,
        additionalContext: p.profile.additionalContext ?? undefined,
      },
      { onSuccess: (r) => toast.success(t('profile.refreshed'), { description: r.steps.map((s) => s.detail).slice(1, 3).join(' ') }) },
    );
  return (
    <Card className="p-6">
      <SectionTitle icon={FileText} title={t('profile.cv')} />
      {p.profile.cvFile ? (
        <button className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-green" onClick={() => void api.blob(`/files/${p.profile.cvFile!.id}`).then((b) => window.open(URL.createObjectURL(b), '_blank', 'noopener'))}>
          <FileText className="size-5 text-green" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium">{p.profile.cvFile.filename}</span>
            <span className="text-[12px] text-muted-foreground">{t('profile.uploaded', { date: localeDate(p.profile.cvFile.createdAt, { day: 'numeric', month: 'short', year: 'numeric' }) })}</span>
          </span>
          <ExternalLink className="size-4 text-subtle-foreground" />
        </button>
      ) : (
        <p className="text-[13px] text-muted-foreground">{p.profile.cvParsedAt ? t('profile.builtFromText') : t('profile.noCv')}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} loading={upload.isPending}>
          <Upload /> {t('profile.uploadNew')}
        </Button>
        <Button size="sm" variant="ghost" onClick={reanalyze} loading={analyze.isPending} disabled={!primary}>
          <RefreshCcw /> {t('profile.reanalyze')}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        aria-label={t('profile.uploadNew')}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          if (f.size > 4 * 1024 * 1024) {
            toast.error(t('onb.tooLarge'));
            return;
          }
          upload.mutate(f, { onSuccess: () => reanalyze() });
        }}
      />
      {p.profile.extractionSource && <p className="mt-3 text-[12px] text-subtle-foreground">{t('profile.lastAnalysis', { source: p.profile.extractionSource === 'AI' ? t('profile.src.ai') : p.profile.extractionSource === 'HEURISTIC' ? t('profile.src.heuristic') : t('profile.src.manual') })}</p>}
    </Card>
  );
}

function EducationAchievements({ p }: { p: ProfileDetail }) {
  const { addAchievement, removeAchievement } = useExperienceMutations();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'AWARD' | 'CERTIFICATION'>('CERTIFICATION');
  const { t } = useT();
  return (
    <Card className="p-6">
      <SectionTitle icon={Award} title={t('profile.education')} />
      <ul className="space-y-2.5">
        {p.education.map((e) => (
          <li key={e.id} className="text-[13.5px]">
            <p className="font-semibold">{e.institution}</p>
            <p className="text-muted-foreground">
              {[e.degree, e.gpa && t('profile.gpa', { gpa: e.gpa })].filter(Boolean).join(' · ')}
              {e.endDate ? ` · ${new Date(e.endDate).getFullYear()}` : ''}
            </p>
          </li>
        ))}
        {p.achievements.map((a) => (
          <li key={a.id} className="group flex items-start justify-between gap-2 text-[13.5px]">
            <span>
              <Badge tone={a.type === 'CERTIFICATION' ? 'green' : 'orange'} className="mr-1.5">
                {a.type === 'CERTIFICATION' ? t('profile.certification') : t('profile.award')}
              </Badge>
              {a.title}
              {a.issuer && <span className="text-muted-foreground"> · {a.issuer}</span>}
            </span>
            <button className="rounded p-1 text-subtle-foreground opacity-0 hover:text-danger group-hover:opacity-100" onClick={() => removeAchievement.mutate(a.id)} aria-label={t('profile.removeItem', { name: a.title })}>
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2">
        <Select className="w-[140px]" value={type} onValueChange={(v) => setType(v as 'AWARD' | 'CERTIFICATION')} options={[{ value: 'CERTIFICATION', label: t('profile.certification') }, { value: 'AWARD', label: t('profile.award') }]} label={t('profile.achievementType')} />
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('profile.addAchievement')} aria-label={t('profile.achievementTitle')} maxLength={160} />
        <Button size="icon" disabled={title.trim().length < 3} onClick={() => addAchievement.mutate({ type, title: title.trim() }, { onSuccess: () => setTitle('') })} aria-label={t('profile.addAchievement')}>
          <Plus />
        </Button>
      </div>
    </Card>
  );
}

function LinksCard({ p }: { p: ProfileDetail }) {
  const { t } = useT();
  const links = [
    { label: 'LinkedIn', url: p.profile.linkedinUrl },
    { label: 'GitHub', url: p.profile.githubUrl },
    { label: t('enum.readiness.PORTFOLIO'), url: p.profile.portfolioUrl },
  ];
  return (
    <Card className="p-6">
      <SectionTitle icon={Link2} title={t('profile.links')} />
      <ul className="space-y-2 text-[13.5px]">
        {links.map((l) => (
          <li key={l.label} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{l.label}</span>
            {safeUrl(l.url) ? (
              <a href={safeUrl(l.url)} target="_blank" rel="noreferrer" className="truncate font-medium text-green-strong hover:underline dark:text-green">
                {l.url!.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            ) : (
              <span className="text-subtle-foreground">{t('profile.notAdded')}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-subtle-foreground">{t('profile.linksNote')}</p>
      <Link to="/app/journey?view=orbits" className="mt-4 inline-flex text-[13px] font-semibold text-green-strong hover:underline dark:text-green">
        {t('profile.manageOrbits')}
      </Link>
    </Card>
  );
}

function EditProfileDialog({ p, open, onOpenChange }: { p: ProfileDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const update = useUpdateProfile();
  const { t } = useT();
  const [form, setForm] = useState({
    name: p.user.name,
    headline: p.profile.headline ?? '',
    summary: p.profile.summary ?? '',
    location: p.profile.location ?? '',
    linkedinUrl: p.profile.linkedinUrl ?? '',
    githubUrl: p.profile.githubUrl ?? '',
    portfolioUrl: p.profile.portfolioUrl ?? '',
  });
  const url = (v: string) => (v.trim() ? (/^https?:\/\//.test(v.trim()) ? v.trim() : `https://${v.trim()}`) : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('profile.editTitle')} className="max-w-xl">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="pf-name">{t('profile.name')}</Label>
            <Input id="pf-name" className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="pf-head">{t('profile.headline')}</Label>
            <Input id="pf-head" className="mt-1.5" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="pf-sum">{t('profile.summary')}</Label>
            <Textarea id="pf-sum" className="mt-1.5" rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="pf-loc">{t('profile.location')}</Label>
            <Input id="pf-loc" className="mt-1.5" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="pf-li">LinkedIn</Label>
            <Input id="pf-li" className="mt-1.5" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="linkedin.com/in/…" />
          </div>
          <div>
            <Label htmlFor="pf-gh">GitHub</Label>
            <Input id="pf-gh" className="mt-1.5" value={form.githubUrl} onChange={(e) => setForm({ ...form, githubUrl: e.target.value })} placeholder="github.com/…" />
          </div>
          <div>
            <Label htmlFor="pf-pf">{t('enum.readiness.PORTFOLIO')}</Label>
            <Input id="pf-pf" className="mt-1.5" value={form.portfolioUrl} onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })} placeholder="yourname.dev" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={update.isPending}
            disabled={form.name.trim().length < 2}
            onClick={() =>
              update.mutate(
                {
                  name: form.name.trim(),
                  headline: form.headline.trim() || null,
                  summary: form.summary.trim() || null,
                  location: form.location.trim() || null,
                  linkedinUrl: url(form.linkedinUrl),
                  githubUrl: url(form.githubUrl),
                  portfolioUrl: url(form.portfolioUrl),
                },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {t('profile.saveChanges')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
