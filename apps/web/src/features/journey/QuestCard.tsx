import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BrainCircuit,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  FileCheck2,
  Link2,
  Paperclip,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { EVIDENCE_TYPES, type EvidenceType, type QuestView } from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Badge, Input, Label, Progress, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import { Checkbox, Select } from '@/components/ui/form-controls';
import { useCompleteQuest, useQuestTask, useSubmitEvidence, useUpdateQuest, useUploadFile } from '@/hooks/queries';
import { useUiStore } from '@/stores/ui';
import { api } from '@/lib/api';
import { cn, friendlyDate, safeUrl } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { useLabels } from '@/lib/i18n/labels';

export function QuestCard({ quest, defaultOpen = false }: { quest: QuestView; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toggle = useQuestTask();
  const complete = useCompleteQuest();
  const updateQuest = useUpdateQuest();
  const openAgent = useUiStore((s) => s.openAgent);
  const setPageContext = useUiStore((s) => s.setPageContext);
  const { t, tn } = useT();
  const labels = useLabels();
  const done = quest.status === 'COMPLETED';
  const openTasks = quest.tasks.filter((t) => !t.completed).length;
  const needsEvidence = quest.evidenceRequired && quest.evidence.length === 0;

  const tryComplete = () => {
    if (openTasks > 0) setConfirmOpen(true);
    else complete.mutate({ questId: quest.id });
  };

  return (
    <div id={`quest-${quest.id}`} className={cn('card overflow-hidden transition', open && 'shadow-pop', done && 'bg-surface/70')}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          setPageContext({ page: 'journey', entityType: 'quest', entityId: quest.id, label: quest.title });
        }}
        className="flex w-full items-start gap-4 p-5 text-left"
        aria-expanded={open}
      >
        <span className={cn('mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl', done ? 'bg-green text-white' : 'bg-muted-green text-green-strong dark:text-green')}>
          {done ? <Check className="size-5" strokeWidth={3} /> : quest.category === 'PROJECT' || quest.category === 'PORTFOLIO' ? <Trophy className="size-5" /> : <Sparkles className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className={cn('text-[16px] font-semibold leading-snug', done && 'text-muted-foreground')}>{quest.title}</span>
            {done && <Badge tone="green">{t('quest.completed')}</Badge>}
            {!done && quest.progress === 100 && <Badge tone="orange">{t('quest.readyToComplete')}</Badge>}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Zap className="size-3.5 text-green" /> {quest.xp} XP
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {quest.estimatedEffort}
            </span>
            <span>{t('quest.impact', { category: labels.readiness(quest.impact) })}</span>
            {quest.relatedSkill && <span>{t('quest.skill', { name: quest.relatedSkill.name })}</span>}
            {quest.deadline && (
              <span className="inline-flex items-center gap-1 text-orange-strong dark:text-orange">
                <CalendarClock className="size-3.5" /> {t('quest.due', { date: friendlyDate(quest.deadline) })}
              </span>
            )}
          </span>
          {!done && <Progress value={quest.progress} className="mt-3 h-1.5" tone="gradient" label={t('quest.progressLabel', { title: quest.title })} />}
        </span>
        <ChevronDown className={cn('mt-1 size-5 shrink-0 text-subtle-foreground transition', open && 'rotate-180')} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="border-t border-border px-5 pb-5 pt-4">
              {quest.objective && (
                <p className="text-[14px]">
                  <span className="font-semibold">{t('quest.objective')}</span>
                  <span className="text-muted-foreground">{quest.objective}</span>
                </p>
              )}
              <ul className="mt-4 space-y-1" aria-label={t('quest.tasks')}>
                {quest.tasks.map((task) => (
                  <li key={task.id}>
                    <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-[14px] transition hover:bg-surface-2', task.completed && 'text-muted-foreground line-through', done && 'cursor-default')}>
                      <Checkbox
                        checked={task.completed}
                        disabled={done}
                        onCheckedChange={(v) => toggle.mutate({ questId: quest.id, taskId: task.id, completed: Boolean(v) })}
                        aria-label={task.title}
                      />
                      <span className="min-w-0 flex-1">{task.title}</span>
                    </label>
                  </li>
                ))}
              </ul>

              {quest.resources.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t('quest.resources')}</p>
                  <div className="flex flex-wrap gap-2">
                    {quest.resources.filter((r) => safeUrl(r.url)).map((r) => (
                      <a key={r.url} href={safeUrl(r.url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] hover:border-green">
                        <ExternalLink className="size-3.5 text-muted-foreground" /> {r.title}
                        <span className="text-subtle-foreground">· {r.kind}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {(quest.evidenceRequirement || quest.evidence.length > 0) && (
                <div className="mt-4 rounded-xl bg-surface-2 p-3.5">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                    <FileCheck2 className="size-4 text-green" /> {t('quest.evidence')} {quest.evidenceRequired ? t('quest.required') : t('quest.optional')}
                  </p>
                  {quest.evidenceRequirement && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{quest.evidenceRequirement}</p>}
                  {quest.evidence.map((e) => (
                    <div key={e.id} className="mt-3 rounded-lg border border-border bg-surface p-3 text-[13px]">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{labels.evidence(e.type)}</Badge>
                        <span className="text-xs text-subtle-foreground">{friendlyDate(e.createdAt)}</span>
                      </div>
                      {safeUrl(e.url) && (
                        <a href={safeUrl(e.url)} target="_blank" rel="noreferrer" className="mt-1.5 block truncate text-green-strong underline dark:text-green">
                          {e.url}
                        </a>
                      )}
                      {e.text && <p className="mt-1.5 whitespace-pre-line text-muted-foreground">{e.text}</p>}
                      {e.file && (
                        <button className="mt-1.5 inline-flex items-center gap-1 text-green-strong underline dark:text-green" onClick={() => void openFile(e.file!.id)}>
                          <Paperclip className="size-3.5" /> {e.file.filename}
                        </button>
                      )}
                      {e.aiReview && (
                        <p className="mt-2 flex gap-2 rounded-md bg-muted-green/60 p-2 text-[12.5px]">
                          <BrainCircuit className="mt-0.5 size-3.5 shrink-0 text-green" /> {e.aiReview}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!done && (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button onClick={tryComplete} loading={complete.isPending} disabled={needsEvidence} title={needsEvidence ? t('quest.addEvidenceFirst') : undefined}>
                    <Check /> {t('quest.complete')}
                  </Button>
                  <Button variant="secondary" onClick={() => setEvidenceOpen(true)}>
                    <Link2 /> {t('quest.addEvidence')}
                  </Button>
                  <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                    <CalendarClock className="size-4" />
                    <span className="sr-only">{t('quest.deadline')}</span>
                    <input
                      type="date"
                      className="h-9 rounded-lg border border-border bg-surface px-2 text-[13px]"
                      value={quest.deadline ? quest.deadline.slice(0, 10) : ''}
                      onChange={(e) => updateQuest.mutate({ questId: quest.id, deadline: e.target.value ? new Date(`${e.target.value}T17:00:00`).toISOString() : null })}
                    />
                  </label>
                  <Button variant="ghost" className="ml-auto" onClick={() => openAgent(t('agent.prompt.questFirst', { title: quest.title }))}>
                    <BrainCircuit /> {t('common.askOrbit')}
                  </Button>
                </div>
              )}
              {needsEvidence && !done && <p className="mt-2 text-[12.5px] text-muted-foreground">{t('quest.needsEvidence')}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <EvidenceDialog quest={quest} open={evidenceOpen} onOpenChange={setEvidenceOpen} />
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent title={t('quest.confirmTitle')} description={tn('quest.confirmDesc', openTasks)}>
          <p className="text-sm text-muted-foreground">{t('quest.confirmNote')}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              {t('quest.notYet')}
            </Button>
            <Button
              loading={complete.isPending}
              onClick={() => complete.mutate({ questId: quest.id, completeRemainingTasks: true }, { onSuccess: () => setConfirmOpen(false) })}
            >
              {t('quest.yesDone')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function openFile(id: string) {
  const blob = await api.blob(`/files/${id}`);
  window.open(URL.createObjectURL(blob), '_blank', 'noopener');
}

function EvidenceDialog({ quest, open, onOpenChange }: { quest: QuestView; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [type, setType] = useState<EvidenceType>('URL');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const submit = useSubmitEvidence();
  const upload = useUploadFile();
  const { t } = useT();
  const labels = useLabels();
  const needsUrl = ['URL', 'GITHUB', 'PORTFOLIO'].includes(type);
  const needsFile = type === 'FILE' || type === 'CERTIFICATE';
  const fileTooLarge = Boolean(file && file.size > 4 * 1024 * 1024);
  const valid = needsUrl ? /^https?:\/\/\S+$/.test(url.trim()) : needsFile ? Boolean(file) && !fileTooLarge : text.trim().length >= 10;

  const save = async () => {
    let fileId: string | undefined;
    if (needsFile && file) fileId = (await upload.mutateAsync({ file, purpose: type === 'CERTIFICATE' ? 'CERTIFICATE' : 'EVIDENCE' })).id;
    submit.mutate(
      { questId: quest.id, type, url: needsUrl ? url.trim() : undefined, text: text.trim() || undefined, fileId },
      {
        onSuccess: () => {
          onOpenChange(false);
          setUrl('');
          setText('');
          setFile(null);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('quest.ev.title')} description={quest.evidenceRequirement ?? t('quest.ev.default')}>
        <div className="space-y-4">
          <div>
            <Label>{t('quest.ev.type')}</Label>
            <Select className="mt-1.5" value={type} onValueChange={(v) => setType(v as EvidenceType)} options={EVIDENCE_TYPES.map((et) => ({ value: et, label: labels.evidence(et) }))} label={t('quest.ev.type')} />
          </div>
          {needsUrl && (
            <div>
              <Label htmlFor="ev-url">{t('quest.ev.link')}</Label>
              <Input id="ev-url" className="mt-1.5" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          )}
          {needsFile && (
            <div>
              <Label htmlFor="ev-file">{t('quest.ev.file')}</Label>
              <input id="ev-file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {fileTooLarge && <p className="mt-1.5 text-[12.5px] text-danger">{t('onb.tooLarge')}</p>}
            </div>
          )}
          <div>
            <Label htmlFor="ev-text">{type === 'TEXT' ? t('quest.ev.reflection') : t('quest.ev.notes')}</Label>
            <Textarea id="ev-text" className="mt-1.5" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('quest.ev.placeholder')} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()} disabled={!valid} loading={submit.isPending || upload.isPending}>
            {t('quest.ev.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
