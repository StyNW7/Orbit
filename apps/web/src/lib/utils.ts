import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from 'date-fns';
import { dateLocale, intlLocale, translate } from '@/lib/i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Viewport centre of an element — used to anchor the theme reveal animation. */
export function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 11) return translate('greeting.morning');
  if (h < 15) return translate('greeting.afternoon');
  return translate('greeting.evening');
}

/** "Today", "Tomorrow, 19:00", "Fri, 12 Oct" — in the active language. */
export function friendlyDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const time = withTime ? `, ${format(d, 'HH:mm')}` : '';
  if (isToday(d)) return `${translate('date.today')}${time}`;
  if (isTomorrow(d)) return `${translate('date.tomorrow')}${time}`;
  if (isYesterday(d)) return `${translate('date.yesterday')}${time}`;
  return `${format(d, 'EEE, d MMM', { locale: dateLocale() })}${time}`;
}

/** date-fns `format` in the active language. */
export function formatDate(date: Date | string, pattern: string): string {
  return format(typeof date === 'string' ? new Date(date) : date, pattern, { locale: dateLocale() });
}

/** Intl date formatting in the active language (month/year chips, upload dates). */
export function localeDate(date: Date | string, options: Intl.DateTimeFormatOptions): string {
  return (typeof date === 'string' ? new Date(date) : date).toLocaleDateString(intlLocale(), options);
}

export function relative(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: dateLocale() });
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pluralize(n: number, word: string, plural = `${word}s`) {
  return `${n} ${n === 1 ? word : plural}`;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
