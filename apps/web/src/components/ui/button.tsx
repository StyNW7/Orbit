import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-green text-white shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_6px_16px_-8px_rgba(10,180,106,0.8)] hover:bg-green-strong',
        accent: 'bg-orange text-white shadow-[0_6px_16px_-8px_rgba(251,144,2,0.8)] hover:bg-orange-strong',
        gradient: 'orbit-gradient text-white shadow-[0_8px_24px_-10px_rgba(10,180,106,0.8)] hover:brightness-105',
        secondary: 'bg-surface text-foreground border border-border shadow-[0_1px_2px_rgba(16,23,20,0.05)] hover:bg-surface-2 hover:border-border-strong',
        soft: 'bg-muted-green text-green-strong hover:bg-[color-mix(in_oklab,var(--muted-green),var(--orbit-green)_12%)] dark:text-green',
        ghost: 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
        danger: 'bg-danger text-white hover:brightness-95',
        link: 'text-green-strong underline-offset-4 hover:underline dark:text-green px-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
