import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
  if (h < 11) return 'Good morning';
  if (h < 15) return 'Good afternoon';
  if (h < 19) return 'Good evening';
  return 'Good evening';
}

export function friendlyDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const time = withTime ? `, ${format(d, 'HH:mm')}` : '';
  if (isToday(d)) return `Today${time}`;
  if (isTomorrow(d)) return `Tomorrow${time}`;
  if (isYesterday(d)) return `Yesterday${time}`;
  return `${format(d, 'EEE, d MMM')}${time}`;
}

export function relative(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
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
