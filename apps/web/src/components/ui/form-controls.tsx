/* Form controls: Tabs, Select, Checkbox, Switch, Chip toggles, Segmented control. */
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('inline-flex h-10 items-center gap-1 rounded-xl border border-border bg-surface-2 p-1 text-muted-foreground', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-[13.5px] font-medium transition hover:text-foreground data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_3px_rgba(16,23,20,0.08)] [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;

// ---------------------------------------------------------------------------
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  label,
}: {
  value?: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        aria-label={label ?? placeholder}
        className={cn(
          'inline-flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-sm shadow-[0_1px_2px_rgba(16,23,20,0.04)] focus:border-green focus:outline-none focus:ring-4 focus:ring-[var(--ring)] data-[placeholder]:text-subtle-foreground',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={6} className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-pop">
          <SelectPrimitive.Viewport>
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-surface-2"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2.5">
                  <Check className="size-4 text-green" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'peer flex size-5 shrink-0 items-center justify-center rounded-md border-[1.5px] border-border-strong bg-surface transition hover:border-green focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] data-[state=checked]:border-green data-[state=checked]:bg-green disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3.5 text-white" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  ),
);
Checkbox.displayName = 'Checkbox';

export function Switch({ className, ...props }: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent bg-border-strong transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] data-[state=checked]:bg-green',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
/** Toggle chips for multi-select choices (interests, preferences). */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multiple = true,
  label,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T[];
  onChange: (v: T[]) => void;
  multiple?: boolean;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(multiple ? (active ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value])}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium transition [&_svg]:size-4',
              active
                ? 'border-green bg-muted-green text-green-strong dark:text-green'
                : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            {active && <Check className="size-3.5" />}
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
