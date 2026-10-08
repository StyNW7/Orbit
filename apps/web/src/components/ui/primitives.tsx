/* Small presentational primitives: Card, Badge, Input, Textarea, Label, Skeleton, Separator, Progress, Avatar, Kbd. */
import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, initials } from '@/lib/utils';

// ---------------------------------------------------------------------------
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('card', className)} {...props} />
));
Card.displayName = 'Card';

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-start justify-between gap-3 px-5 pt-5', className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-[17px] font-semibold leading-tight', className)} {...props} />;
}
export function CardEyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground', className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5 pt-4', className)} {...props} />;
}

// ---------------------------------------------------------------------------
const badgeVariants = cva('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium leading-5 whitespace-nowrap [&_svg]:size-3', {
  variants: {
    tone: {
      neutral: 'bg-surface-2 text-muted-foreground border border-border',
      green: 'bg-muted-green text-green-strong dark:text-green',
      orange: 'bg-muted-orange text-orange-strong dark:text-orange',
      danger: 'bg-muted-danger text-danger',
      dark: 'bg-foreground text-background',
      outline: 'border border-border text-muted-foreground',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

// ---------------------------------------------------------------------------
const fieldClass =
  'w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-subtle-foreground shadow-[0_1px_2px_rgba(16,23,20,0.04)] transition focus:border-green focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:opacity-60';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldClass, 'h-10', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldClass, 'min-h-[96px] py-2.5 leading-relaxed', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>>(
  ({ className, ...props }, ref) => <LabelPrimitive.Root ref={ref} className={cn('text-[13px] font-medium text-foreground', className)} {...props} />,
);
Label.displayName = 'Label';

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1 text-[12.5px] text-danger">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton', className)} {...props} />;
}

export const Separator = ({ className, orientation = 'horizontal', ...props }: React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>) => (
  <SeparatorPrimitive.Root
    orientation={orientation}
    className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
    {...props}
  />
);

// ---------------------------------------------------------------------------
export function Progress({
  value,
  className,
  tone = 'green',
  label,
}: {
  value: number;
  className?: string;
  tone?: 'green' | 'orange' | 'gradient' | 'neutral';
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const bar =
    tone === 'orange' ? 'bg-orange' : tone === 'gradient' ? 'orbit-gradient' : tone === 'neutral' ? 'bg-subtle-foreground' : 'bg-green';
  return (
    <ProgressPrimitive.Root value={v} aria-label={label} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <ProgressPrimitive.Indicator className={cn('h-full rounded-full transition-[width] duration-700 ease-out', bar)} style={{ width: `${v}%` }} />
    </ProgressPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return (
    <AvatarPrimitive.Root className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full', className)}>
      {src && <AvatarPrimitive.Image src={src} alt={name} className="aspect-square size-full object-cover" />}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center bg-muted-green text-[13px] font-semibold text-green-strong dark:text-green">
        {initials(name) || 'O'}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn('rounded border border-border bg-surface-2 px-1.5 py-px font-sans text-[11px] font-medium text-muted-foreground', className)}>
      {children}
    </kbd>
  );
}
