import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { restoreSession } from './lib/auth';
import { applyTheme, useUiStore } from './stores/ui';
import './index.css';

applyTheme(useUiStore.getState().theme);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useUiStore.getState().theme === 'system') applyTheme('system');
});

if (import.meta.env.PROD) registerSW({ immediate: true });

void restoreSession().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
