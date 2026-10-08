import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  GraduationCap,
  LayoutGrid,
  Network,
  Route,
  Search,
  Sparkles,
  UserRoundSearch,
  type LucideIcon,
} from 'lucide-react';
import type { SearchResult } from '@orbit/shared';
import { useSearch } from '@/hooks/queries';
import { useUiStore } from '@/stores/ui';

const ICONS: Record<SearchResult['type'], LucideIcon> = {
  PAGE: LayoutGrid,
  NODE: Network,
  JOB: BriefcaseBusiness,
  QUEST: Route,
  BOOK: BookOpen,
  PAPER: FileText,
  EVENT: CalendarDays,
  RESOURCE: GraduationCap,
  PERSON: UserRoundSearch,
  NOTE: FileText,
};

const GROUPS: { type: SearchResult['type'][]; label: string }[] = [
  { type: ['PAGE'], label: 'Go to' },
  { type: ['NODE'], label: 'Career Universe' },
  { type: ['QUEST'], label: 'Journey' },
  { type: ['JOB'], label: 'Opportunities' },
  { type: ['EVENT', 'RESOURCE'], label: 'Growth' },
  { type: ['BOOK', 'PAPER'], label: 'Knowledge' },
  { type: ['PERSON'], label: 'People' },
  { type: ['NOTE'], label: 'Journal' },
];

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const openAgent = useUiStore((s) => s.openAgent);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 180);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);
  const { data = [], isFetching } = useSearch(debounced, open);

  const go = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#101714]/40 backdrop-blur-[2px] dark:bg-black/60" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-[620px] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-pop focus:outline-none">
          <DialogPrimitive.Title className="sr-only">Search Orbit</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search pages, skills, opportunities, quests and people</DialogPrimitive.Description>
          <Command shouldFilter={false} label="Search Orbit">
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-[18px] text-muted-foreground" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search your Orbit…"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle-foreground"
              />
              {isFetching && <span className="text-xs text-subtle-foreground">Searching…</span>}
            </div>
            <Command.List className="max-h-[min(60vh,440px)] overflow-y-auto p-2 scrollbar-thin">
              <Command.Empty className="px-4 py-10 text-center text-sm text-muted-foreground">No matches. Try a skill, company or quest name.</Command.Empty>
              {query.trim().length >= 2 && (
                <Command.Group heading="Orbit Agent" className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  <Command.Item
                    value={`ask-${query}`}
                    onSelect={() => {
                      setOpen(false);
                      openAgent(query);
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm normal-case tracking-normal text-foreground data-[selected=true]:bg-surface-2"
                  >
                    <Sparkles className="size-4 text-green" />
                    Ask Orbit: “{query}”
                  </Command.Item>
                </Command.Group>
              )}
              {GROUPS.map((g) => {
                const items = data.filter((r) => g.type.includes(r.type));
                if (!items.length) return null;
                return (
                  <Command.Group
                    key={g.label}
                    heading={g.label}
                    className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                  >
                    {items.map((r) => {
                      const Icon = ICONS[r.type];
                      return (
                        <Command.Item
                          key={`${r.type}-${r.id}`}
                          value={`${r.type}-${r.id}`}
                          onSelect={() => go(r.url)}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm normal-case tracking-normal text-foreground data-[selected=true]:bg-surface-2"
                        >
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{r.title}</span>
                          <span className="max-w-[40%] truncate text-xs text-subtle-foreground">{r.subtitle}</span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                );
              })}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
