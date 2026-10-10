/**
 * Orbit i18n — English and Bahasa Indonesia.
 *
 * `en` is the source of truth; `id` is typed against it, so a missing translation is a compile error.
 * The active locale is persisted per browser, mirrored to <html lang> and sent to the API
 * (X-Orbit-Locale) so Orbit Agent and server-generated guidance answer in the same language.
 */
import { Fragment, createElement, useCallback, type ReactNode } from 'react';
import { create } from 'zustand';
import { enUS, id as idLocale, type Locale as DateLocale } from 'date-fns/locale';
import { en, type MessageKey } from './en';
import { id } from './id';

export type Locale = 'en' | 'id';
export type { MessageKey };
export const LOCALES: { value: Locale; label: string; short: string }[] = [
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'id', label: 'Bahasa Indonesia', short: 'ID' },
];

const STORAGE_KEY = 'orbit.locale';
const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, id };

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'id') return saved;
  } catch {
    // storage unavailable — fall through to the browser language
  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('id')) return 'id';
  return 'en';
}

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const listeners = new Set<(locale: Locale) => void>();

export const useI18nStore = create<I18nState>((set) => ({
  locale: detectLocale(),
  setLocale: (locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // the choice still applies for this visit
    }
    applyLocale(locale);
    set({ locale });
    listeners.forEach((l) => l(locale));
  },
}));

/** Subscribe to locale changes outside React (e.g. to refetch server-localized data). */
export function onLocaleChange(listener: (locale: Locale) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyLocale(locale: Locale) {
  document.documentElement.lang = locale;
}

export const getLocale = (): Locale => useI18nStore.getState().locale;
export const dateLocale = (locale: Locale = getLocale()): DateLocale => (locale === 'id' ? idLocale : enUS);
/** BCP 47 tag for Intl APIs. */
export const intlLocale = (locale: Locale = getLocale()) => (locale === 'id' ? 'id-ID' : 'en-US');

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Translate outside React (toasts, query callbacks). Reads the current locale at call time. */
export function translate(key: MessageKey, vars?: Vars, locale: Locale = getLocale()): string {
  return interpolate(DICTIONARIES[locale][key] ?? en[key] ?? key, vars);
}

/** Plural-aware translate: uses `<key>_one` when count is 1 and the key exists, otherwise `<key>_other`. */
export function translateCount(key: string, count: number, vars?: Vars, locale: Locale = getLocale()): string {
  const dict = DICTIONARIES[locale] as Record<string, string>;
  const k = count === 1 && `${key}_one` in dict ? `${key}_one` : `${key}_other`;
  return interpolate(dict[k] ?? (en as Record<string, string>)[k] ?? key, { count, ...vars });
}

/** Translate a template and splice React nodes into its {placeholders}. */
function translateRich(key: MessageKey, nodes: Record<string, ReactNode>, locale: Locale): ReactNode {
  const template = DICTIONARIES[locale][key] ?? en[key];
  const parts = template.split(/(\{\w+\})/g);
  return createElement(
    Fragment,
    null,
    ...parts.map((part, i) => {
      const m = /^\{(\w+)\}$/.exec(part);
      return createElement(Fragment, { key: i }, m && m[1] in nodes ? nodes[m[1]] : part);
    }),
  );
}

/** Dynamic key lookup (enum labels): returns the fallback when the key is unknown. */
export function translateMaybe(key: string, fallback: string, locale: Locale = getLocale()): string {
  const dict = DICTIONARIES[locale] as Record<string, string>;
  return dict[key] ?? fallback;
}

export function useLocale(): Locale {
  return useI18nStore((s) => s.locale);
}

/** The translation hook. Components re-render when the language changes. */
export function useT() {
  const locale = useLocale();
  const t = useCallback((key: MessageKey, vars?: Vars) => translate(key, vars, locale), [locale]);
  const tn = useCallback((key: string, count: number, vars?: Vars) => translateCount(key, count, vars, locale), [locale]);
  const tr = useCallback((key: MessageKey, nodes: Record<string, ReactNode>) => translateRich(key, nodes, locale), [locale]);
  const tm = useCallback((key: string, fallback: string) => translateMaybe(key, fallback, locale), [locale]);
  return { t, tn, tr, tm, locale };
}
