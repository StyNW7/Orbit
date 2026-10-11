import { useState } from 'react';
import { BookMarked, Lightbulb, PenLine, Search, Trash2 } from 'lucide-react';
import { NOTE_TYPES, type NoteType } from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Badge, Card, Input, Label, Textarea } from '@/components/ui/primitives';
import { Select } from '@/components/ui/form-controls';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/common/states';
import { useInsightMutations, useNoteMutations, useNotes, usePatterns } from '@/hooks/queries';
import { friendlyDate } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { useLabels } from '@/lib/i18n/labels';

export function JournalView() {
  const [q, setQ] = useState('');
  const { data: notes, isLoading, error, refetch } = useNotes(q.trim() || undefined);
  const { data: patterns = [] } = usePatterns();
  const { create, remove } = useNoteMutations();
  const { apply, dismiss } = useInsightMutations();
  const { t } = useT();
  const labels = useLabels();
  const [type, setType] = useState<NoteType>('LEARNING_REFLECTION');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const save = () =>
    create.mutate(
      { type, title: title.trim(), content: content.trim() },
      {
        onSuccess: () => {
          setTitle('');
          setContent('');
        },
      },
    );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {patterns.map((p) => (
          <div key={p.id} className="rounded-xl border border-orange/40 bg-muted-orange/60 p-5">
            <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-orange-strong dark:text-orange">
              <Lightbulb className="size-4" /> {t('journal.pattern')}
            </p>
            <p className="mt-2 font-display text-[17px] font-semibold">{p.message}</p>
            {p.evidence.length > 0 && <p className="mt-1 text-[13px] text-muted-foreground">{t('journal.seenIn', { list: p.evidence.join(' · ') })}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {p.suggestedAction && (
                <Button size="sm" variant="accent" onClick={() => apply.mutate(p.id)} loading={apply.isPending}>
                  {p.suggestedAction.label}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(p.id)}>
                {t('common.notNow')}
              </Button>
            </div>
            <p className="mt-2 text-[11.5px] text-subtle-foreground">{t('journal.neverChanges')}</p>
          </div>
        ))}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('journal.search')} className="pl-9" aria-label={t('journal.searchLabel')} />
        </div>

        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <CardSkeleton />
        ) : !notes?.length ? (
          <Card>
            <EmptyState icon={BookMarked} title={t('journal.emptyTitle')} description={t('journal.emptyDesc')} />
          </Card>
        ) : (
          notes.map((n) => (
            <Card key={n.id} className="group p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{labels.noteType(n.type)}</Badge>
                    <span className="text-xs text-subtle-foreground">{friendlyDate(n.createdAt)}</span>
                  </div>
                  <h3 className="mt-2 text-[16px] font-semibold">{n.title}</h3>
                </div>
                <Button variant="ghost" size="icon-sm" className="opacity-60 group-hover:opacity-100" onClick={() => remove.mutate(n.id)} aria-label={t('journal.delete', { title: n.title })}>
                  <Trash2 />
                </Button>
              </div>
              <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-muted-foreground">{n.content}</p>
              {n.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {n.tags.map((tag) => (
                    <Badge key={tag} tone="outline">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      <Card className="h-fit p-5 lg:sticky lg:top-24">
        <h3 className="flex items-center gap-2 text-[16px] font-semibold">
          <PenLine className="size-4 text-green" /> {t('journal.new')}
        </h3>
        <div className="mt-4 space-y-3">
          <div>
            <Label>{t('journal.type')}</Label>
            <Select className="mt-1.5" value={type} onValueChange={(v) => setType(v as NoteType)} options={NOTE_TYPES.map((nt) => ({ value: nt, label: labels.noteType(nt) }))} label={t('journal.typeLabel')} />
          </div>
          <div>
            <Label htmlFor="note-title">{t('journal.titleLabel')}</Label>
            <Input id="note-title" className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('journal.titlePlaceholder')} maxLength={140} />
          </div>
          <div>
            <Label htmlFor="note-content">{t('journal.reflection')}</Label>
            <Textarea id="note-content" className="mt-1.5" rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('journal.reflectionPlaceholder')} maxLength={5000} />
          </div>
          <Button className="w-full" onClick={save} disabled={title.trim().length < 2 || content.trim().length < 2} loading={create.isPending}>
            {t('journal.save')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
