import { useState } from 'react';
import { BookMarked, Lightbulb, PenLine, Search, Trash2 } from 'lucide-react';
import { NOTE_TYPE_LABELS, NOTE_TYPES, type NoteType } from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Badge, Card, Input, Label, Textarea } from '@/components/ui/primitives';
import { Select } from '@/components/ui/form-controls';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/common/states';
import { useInsightMutations, useNoteMutations, useNotes, usePatterns } from '@/hooks/queries';
import { friendlyDate } from '@/lib/utils';

export function JournalView() {
  const [q, setQ] = useState('');
  const { data: notes, isLoading, error, refetch } = useNotes(q.trim() || undefined);
  const { data: patterns = [] } = usePatterns();
  const { create, remove } = useNoteMutations();
  const { apply, dismiss } = useInsightMutations();
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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {patterns.map((p) => (
          <div key={p.id} className="rounded-xl border border-orange/40 bg-muted-orange/60 p-5">
            <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-orange-strong dark:text-orange">
              <Lightbulb className="size-4" /> Pattern detected
            </p>
            <p className="mt-2 font-display text-[17px] font-semibold">{p.message}</p>
            {p.evidence.length > 0 && <p className="mt-1 text-[13px] text-muted-foreground">Seen in: {p.evidence.join(' · ')}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {p.suggestedAction && (
                <Button size="sm" variant="accent" onClick={() => apply.mutate(p.id)} loading={apply.isPending}>
                  {p.suggestedAction.label}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(p.id)}>
                Not now
              </Button>
            </div>
            <p className="mt-2 text-[11.5px] text-subtle-foreground">Orbit never changes your journey without your confirmation.</p>
          </div>
        ))}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your journal…" className="pl-9" aria-label="Search notes" />
        </div>

        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <CardSkeleton />
        ) : !notes?.length ? (
          <Card>
            <EmptyState icon={BookMarked} title="Capture what you learn along the way." description="Reflections help Orbit notice patterns and adapt your journey." />
          </Card>
        ) : (
          notes.map((n) => (
            <Card key={n.id} className="group p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{NOTE_TYPE_LABELS[n.type]}</Badge>
                    <span className="text-xs text-subtle-foreground">{friendlyDate(n.createdAt)}</span>
                  </div>
                  <h3 className="mt-2 text-[16px] font-semibold">{n.title}</h3>
                </div>
                <Button variant="ghost" size="icon-sm" className="opacity-60 group-hover:opacity-100" onClick={() => remove.mutate(n.id)} aria-label={`Delete note ${n.title}`}>
                  <Trash2 />
                </Button>
              </div>
              <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-muted-foreground">{n.content}</p>
              {n.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {n.tags.map((t) => (
                    <Badge key={t} tone="outline">
                      #{t}
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
          <PenLine className="size-4 text-green" /> New reflection
        </h3>
        <div className="mt-4 space-y-3">
          <div>
            <Label>Type</Label>
            <Select className="mt-1.5" value={type} onValueChange={(v) => setType(v as NoteType)} options={NOTE_TYPES.map((t) => ({ value: t, label: NOTE_TYPE_LABELS[t] }))} label="Note type" />
          </div>
          <div>
            <Label htmlFor="note-title">Title</Label>
            <Input id="note-title" className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What happened?" maxLength={140} />
          </div>
          <div>
            <Label htmlFor="note-content">Reflection</Label>
            <Textarea id="note-content" className="mt-1.5" rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="What went well? What felt difficult? What will you try next?" />
          </div>
          <Button className="w-full" onClick={save} disabled={title.trim().length < 2 || content.trim().length < 2} loading={create.isPending}>
            Save to journal
          </Button>
        </div>
      </Card>
    </div>
  );
}
