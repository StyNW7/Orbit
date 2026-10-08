import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnimatePresence, motion } from 'motion/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  ArrowUp,
  BrainCircuit,
  Check,
  CircleDashed,
  History,
  Info,
  MessageSquarePlus,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { AGENT_ENGINE_LABELS, type AgentActionView, type AgentMessageView, type AgentPageContext } from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, Tooltip } from '@/components/ui/overlays';
import { OrbitLoader } from '@/components/common/states';
import { loadConversation, useAgentAction, useAgentChat, useAgentStatus, useConversations } from '@/hooks/queries';
import { useUiStore } from '@/stores/ui';
import { errorMessage } from '@/lib/api';
import { cn, relative } from '@/lib/utils';

const SUGGESTIONS: Record<AgentPageContext['page'], string[]> = {
  'mission-control': ['What should I focus on this week?', 'Am I on track for my target role?', 'Which gap should I close first?'],
  universe: ['Why is this skill important?', 'Which gap should I close first?', 'Recommend a book for my biggest gap'],
  journey: ['Should I complete this quest first?', 'Plan my week around my journey', 'What should I improve next?'],
  discover: ['Which internship fits me best?', 'Am I ready to apply?', 'Find a workshop for my biggest gap'],
  application: ['Am I ready to apply?', 'Help me prepare for this interview', 'Remind me to follow up in 2 days'],
  progress: ['What should I improve next?', 'How has my readiness changed?', 'What should I focus on this week?'],
  profile: ['What are my strongest skills?', 'Which role models have a path like mine?', 'Which gap should I close first?'],
  settings: ['What can Orbit do for me?', 'What should I focus on this week?'],
  other: ['What should I focus on this week?', 'Which gap should I close first?'],
};

const CONFIRM_LABEL: Partial<Record<AgentActionView['type'], string>> = {
  ADD_SKILL_TO_JOURNEY: 'Add to Journey',
  ADD_QUEST: 'Add quest',
  SAVE_OPPORTUNITY: 'Save & track',
  UPDATE_APPLICATION_STATUS: 'Update status',
  CREATE_REMINDER: 'Set reminder',
  SET_PRIMARY_GOAL: 'Make primary',
  ADD_CAREER_GOAL: 'Add orbit',
  BUILD_JOURNEY: 'Generate journey',
  UPDATE_QUEST_PROGRESS: 'Mark as done',
  ADD_GRAPH_NODE: 'Add to Universe',
  SAVE_RESOURCE: 'Save',
  NAVIGATE: 'Open',
};

interface ChatMessage extends AgentMessageView {
  notice?: string | null;
}

export function AgentDrawer() {
  const open = useUiStore((s) => s.agentOpen);
  const setOpen = useUiStore((s) => s.setAgentOpen);
  const pageContext = useUiStore((s) => s.pageContext);
  const consumePrompt = useUiStore((s) => s.consumePrompt);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const chat = useAgentChat();
  const { data: status } = useAgentStatus();
  const { data: conversations = [] } = useConversations(open);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const send = (text: string) => {
    const message = text.trim();
    if (!message || chat.isPending) return;
    setInput('');
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: 'USER', content: message, engine: null, toolCalls: [], actions: [], createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    chat.mutate(
      { message, conversationId, pageContext },
      {
        onSuccess: (r) => {
          setConversationId(r.conversationId);
          setMessages((m) => [...m, { ...r.message, notice: r.notice }]);
        },
        onError: (e) => {
          setMessages((m) => [
            ...m,
            { id: `err-${Date.now()}`, role: 'ASSISTANT', content: `I couldn’t complete that request. ${errorMessage(e)}`, engine: null, toolCalls: [], actions: [], createdAt: new Date().toISOString() },
          ]);
        },
      },
    );
  };

  useEffect(() => {
    if (!open) return;
    const prompt = consumePrompt();
    if (prompt) send(prompt);
    else setTimeout(() => inputRef.current?.focus(), 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, chat.isPending]);

  const newChat = () => {
    setMessages([]);
    setConversationId(undefined);
    inputRef.current?.focus();
  };

  const openConversation = async (id: string) => {
    const msgs = await loadConversation(id);
    setConversationId(id);
    setMessages(msgs);
  };

  const engine = status?.activeEngine;
  const contextLabel = pageContext.label ? `${titleForPage(pageContext.page)} · ${pageContext.label}` : titleForPage(pageContext.page);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#101714]/25 sm:bg-[#101714]/15" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col border-l border-border bg-background shadow-pop focus:outline-none sm:max-w-[480px]"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
            <div className="orbit-gradient flex size-9 items-center justify-center rounded-xl text-white">
              <BrainCircuit className="size-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-display text-[15px] font-semibold leading-tight">Orbit Agent</DialogPrimitive.Title>
              <p className="flex items-center gap-1.5 truncate text-[12px] text-muted-foreground">
                <span className={cn('size-1.5 rounded-full', engine === 'planner' ? 'bg-orange' : 'bg-green')} aria-hidden />
                {engine ? AGENT_ENGINE_LABELS[engine] : 'Connecting…'}
                {engine === 'direct' && status?.ai.model ? ` · ${status.ai.model}` : ''}
              </p>
            </div>
            <DropdownMenu>
              <Tooltip content="Conversation history">
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Conversation history">
                    <History />
                  </Button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent className="w-72">
                <DropdownMenuLabel>Recent conversations</DropdownMenuLabel>
                {conversations.length === 0 && <p className="px-2.5 py-2 text-sm text-muted-foreground">No conversations yet.</p>}
                {conversations.slice(0, 8).map((c) => (
                  <DropdownMenuItem key={c.id} onSelect={() => void openConversation(c.id)}>
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="shrink-0 text-xs text-subtle-foreground">{relative(c.updatedAt)}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip content="New conversation">
              <Button variant="ghost" size="icon-sm" onClick={newChat} aria-label="New conversation">
                <MessageSquarePlus />
              </Button>
            </Tooltip>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close Orbit Agent">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 scrollbar-thin" aria-live="polite">
            {messages.length === 0 ? (
              <Welcome page={pageContext.page} onPick={send} />
            ) : (
              <div className="space-y-5">
                {messages.map((m) => (m.role === 'USER' ? <UserBubble key={m.id} text={m.content} /> : <AssistantMessage key={m.id} message={m} />))}
                {chat.isPending && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
                    <OrbitLoader className="size-7" />
                    Orbit is analyzing your career context…
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-border bg-surface px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
            <div className="mb-2 flex items-center gap-2 text-[11.5px] text-muted-foreground">
              <Info className="size-3.5" />
              <span className="truncate">Context: {contextLabel}</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2 rounded-xl border border-border bg-background p-1.5 focus-within:border-green focus-within:ring-4 focus-within:ring-[var(--ring)]"
            >
              <label htmlFor="agent-input" className="sr-only">
                Message Orbit
              </label>
              <textarea
                id="agent-input"
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask about your path, gaps, jobs or next steps…"
                className="max-h-36 min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[14px] outline-none placeholder:text-subtle-foreground"
              />
              <Button type="submit" size="icon" disabled={!input.trim() || chat.isPending} aria-label="Send message">
                <ArrowUp />
              </Button>
            </form>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function titleForPage(page: AgentPageContext['page']): string {
  return (
    {
      'mission-control': 'Mission Control',
      universe: 'Career Universe',
      journey: 'Journey',
      discover: 'Discover',
      application: 'Application',
      progress: 'Progress',
      profile: 'Profile',
      settings: 'Settings',
      other: 'Orbit',
    } as const
  )[page];
}

function Welcome({ page, onPick }: { page: AgentPageContext['page']; onPick: (s: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-4">
      <div className="mb-5 flex justify-center">
        <div className="relative">
          <div className="orbit-gradient absolute inset-0 -m-2 rounded-3xl opacity-20 blur-xl" aria-hidden />
          <div className="orbit-gradient relative flex size-14 items-center justify-center rounded-2xl text-white">
            <Sparkles className="size-6" />
          </div>
        </div>
      </div>
      <h3 className="text-center text-lg font-semibold">How can Orbit help?</h3>
      <p className="mx-auto mt-1 max-w-xs text-center text-sm text-muted-foreground">
        Orbit uses your profile, journey, gaps, applications and deadlines to recommend your next best action.
      </p>
      <div className="mt-6 space-y-2">
        {SUGGESTIONS[page].map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm transition hover:border-green hover:bg-muted-green/40"
          >
            {s}
            <ArrowUp className="size-4 rotate-45 text-subtle-foreground transition group-hover:text-green" />
          </button>
        ))}
      </div>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-subtle-foreground">
        <ShieldCheck className="size-3.5" /> Orbit asks before making important changes.
      </p>
    </motion.div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-green px-4 py-2.5 text-[14px] text-white shadow-[0_6px_16px_-10px_rgba(10,180,106,0.9)]">{text}</div>
    </div>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <div className="orbit-gradient mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-white">
        <Sparkles className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3 shadow-card">
          <div className="prose-orbit">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        </div>
        {message.toolCalls.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Wrench className="size-3 text-subtle-foreground" aria-hidden />
            {[...new Set(message.toolCalls.map((t) => t.tool))].map((t) => (
              <Tooltip key={t} content={message.toolCalls.find((x) => x.tool === t)?.summary}>
                <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">{t}</span>
              </Tooltip>
            ))}
          </div>
        )}
        {message.notice && <p className="mt-2 text-[11.5px] text-subtle-foreground">{message.notice}</p>}
        <AnimatePresence>
          {message.actions.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.actions.map((a) => (
                <ActionCard key={a.id} action={a} />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ActionCard({ action }: { action: AgentActionView }) {
  const [state, setState] = useState<AgentActionView['status']>(action.status);
  const [result, setResult] = useState<{ message: string; url: string | null } | null>(null);
  const { confirm, reject } = useAgentAction();
  const navigate = useNavigate();
  const setOpen = useUiStore((s) => s.setAgentOpen);
  const pending = state === 'PENDING_CONFIRMATION' || state === 'SUGGESTED';
  const isWrite = action.level === 'WRITE';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-xl border p-3.5', pending ? (isWrite ? 'border-orange/40 bg-muted-orange/50' : 'border-green/30 bg-muted-green/50') : 'border-border bg-surface')}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md', state === 'CONFIRMED' ? 'bg-green text-white' : 'bg-surface text-green')}>
          {state === 'CONFIRMED' ? <Check className="size-3.5" /> : state === 'REJECTED' ? <X className="size-3.5 text-muted-foreground" /> : <CircleDashed className="size-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13.5px] font-semibold leading-snug">{action.title}</p>
            {isWrite && pending && (
              <Badge tone="orange">
                <ShieldCheck /> Needs confirmation
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{result?.message ?? action.resultSummary ?? action.description}</p>
          {pending && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={isWrite ? 'accent' : 'primary'}
                loading={confirm.isPending}
                onClick={() =>
                  confirm.mutate(action.id, {
                    onSuccess: (r) => {
                      setState('CONFIRMED');
                      setResult({ message: r.message, url: r.navigateTo });
                      if (action.type === 'NAVIGATE' && r.navigateTo) {
                        setOpen(false);
                        navigate(r.navigateTo);
                      }
                    },
                  })
                }
              >
                {CONFIRM_LABEL[action.type] ?? 'Confirm'}
              </Button>
              <Button size="sm" variant="ghost" disabled={confirm.isPending} onClick={() => reject.mutate(action.id, { onSuccess: () => setState('REJECTED') })}>
                Not now
              </Button>
            </div>
          )}
          {state === 'CONFIRMED' && result?.url && action.type !== 'NAVIGATE' && (
            <Button
              size="sm"
              variant="link"
              className="mt-1.5"
              onClick={() => {
                setOpen(false);
                navigate(result.url!);
              }}
            >
              Open
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
