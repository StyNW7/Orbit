import { useEffect } from 'react';
import { create } from 'zustand';
import type { AgentPageContext } from '@orbit/shared';

export type ThemePreference = 'light' | 'dark' | 'system';

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
  setTheme: (theme: ThemePreference) => void;
}

function readTheme(): ThemePreference {
  try {
    const t = localStorage.getItem('orbit.theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: ThemePreference) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
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
  setTheme: (theme) => {
    try {
      if (theme === 'system') localStorage.removeItem('orbit.theme');
      else localStorage.setItem('orbit.theme', theme);
    } catch {
      // storage unavailable
    }
    applyTheme(theme);
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

export function useIsDark(): boolean {
  const theme = useUiStore((s) => s.theme);
  if (theme === 'system') return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return theme === 'dark';
}
