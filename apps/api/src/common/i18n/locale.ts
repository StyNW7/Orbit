import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { APP_LOCALES, type AppLocale } from '@orbit/shared';

/**
 * Request-scoped interface language. The web client sends `X-Orbit-Locale: en|id` on every call;
 * services read it with `currentLocale()` (or the `L()` helper) without threading it through
 * every method signature. Outside a request (tests, scheduler, seed) the locale is English.
 */
const storage = new AsyncLocalStorage<AppLocale>();

export function parseLocale(value: unknown): AppLocale | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const tag = raw.trim().toLowerCase().slice(0, 2);
  return (APP_LOCALES as readonly string[]).includes(tag) ? (tag as AppLocale) : null;
}

export function localeMiddleware(req: Request, _res: Response, next: NextFunction) {
  const locale = parseLocale(req.headers['x-orbit-locale']) ?? parseLocale(req.headers['accept-language']) ?? 'en';
  storage.run(locale, () => next());
}

export function currentLocale(): AppLocale {
  return storage.getStore() ?? 'en';
}

/** Run `fn` with an explicit locale (e.g. the agent chat body overrides the header). */
export function withLocale<T>(locale: AppLocale, fn: () => T): T {
  return storage.run(locale, fn);
}

/** Pick the string for the active locale: `L('Open quest', 'Buka quest')`. */
export function L(en: string, id: string): string {
  return currentLocale() === 'id' ? id : en;
}
