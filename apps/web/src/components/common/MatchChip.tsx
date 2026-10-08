import { cn } from '@/lib/utils';

export function MatchChip({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-lg px-2 py-1 text-[12.5px] font-bold tabular',
        value >= 75 ? 'bg-muted-green text-green-strong dark:text-green' : value >= 55 ? 'bg-muted-orange text-orange-strong dark:text-orange' : 'bg-surface-2 text-muted-foreground',
        className,
      )}
    >
      {value}% match
    </span>
  );
}
