import { useEffect, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import type { AgentPageContext } from '@orbit/shared';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface UiState {
  agentOpen: boolean;
  agentPrompt: string | null;
  pageContext: AgentPageContext;
  commandOpen: boolean;
  theme: ThemePreference;
  openAgent: (prompt?: string) => void;
  closeAgent: () => void;
  setAgentOpen: (open: boolean) => void;
  consumePrompt: () => string | null;
  setPageContext: (ctx: AgentPageContext) => void;
  setCommandOpen: (open: boolean) => void;
  /** `origin` (viewport px) anchors the circular reveal when the browser supports view transitions. */
  setTheme: (theme: ThemePreference, origin?: { x: number; y: number }) => void;
}

const THEME_KEY = 'orbit.theme';
const THEME_COLOR = { light: '#F8FAF9', dark: '#101714' } as const;
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

function readTheme(): ThemePreference {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(theme: ThemePreference): ResolvedTheme {
  if (theme === 'system') return typeof window !== 'undefined' && darkQuery().matches ? 'dark' : 'light';
  return theme;
}

export function applyTheme(theme: ThemePreference) {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved]);
}

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };

/** Swap themes with a circular reveal from `origin`; falls back to an instant swap. */
function transitionTheme(theme: ThemePreference, origin?: { x: number; y: number }) {
  const doc = document as ViewTransitionDoc;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduced || resolveTheme(theme) === (document.documentElement.classList.contains('dark') ? 'dark' : 'light')) {
    applyTheme(theme);
    return;
  }
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? 0;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = doc.startViewTransition(() => applyTheme(theme));
  void transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        // A gentle ease-in-out over ~0.9s keeps the reveal smooth from start to finish.
        { duration: 900, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => undefined);
}

export const useUiStore = create<UiState>((set, get) => ({
  agentOpen: false,
  agentPrompt: null,
  pageContext: { page: 'other' },
  commandOpen: false,
  theme: readTheme(),
  openAgent: (prompt) => set({ agentOpen: true, agentPrompt: prompt ?? null }),
  closeAgent: () => set({ agentOpen: false }),
  setAgentOpen: (open) => set({ agentOpen: open }),
  consumePrompt: () => {
    const p = get().agentPrompt;
    if (p) set({ agentPrompt: null });
    return p;
  },
  setPageContext: (pageContext) => set({ pageContext }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setTheme: (theme, origin) => {
    try {
      if (theme === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch {
      // storage unavailable — the choice still applies for this visit
    }
    transitionTheme(theme, origin);
    set({ theme });
  },
}));

/** Pages declare what the user is looking at so Orbit Agent can answer in context. */
export function usePageContext(ctx: AgentPageContext) {
  const setPageContext = useUiStore((s) => s.setPageContext);
  const key = JSON.stringify(ctx);
  useEffect(() => {
    setPageContext(JSON.parse(key));
  }, [key, setPageContext]);
}

function subscribeSystemTheme(onChange: () => void) {
  const mq = darkQuery();
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** The theme actually on screen — follows the OS live when the preference is "system". */
export function useResolvedTheme(): ResolvedTheme {
  const theme = useUiStore((s) => s.theme);
  const systemDark = useSyncExternalStore(subscribeSystemTheme, () => darkQuery().matches, () => false);
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

export function useIsDark(): boolean {
  return useResolvedTheme() === 'dark';
}
