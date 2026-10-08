import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'motion/react';
import { ArrowRight, Eye, EyeOff, PlayCircle, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand/brand';
import { OrbitSystem } from '@/features/landing/OrbitSystem';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/primitives';
import { DEMO_CREDENTIALS, authMode, signIn, signUp } from '@/lib/auth';
import { queryClient } from '@/hooks/queries';

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#0d1512] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 opacity-[0.35] grid-dots" aria-hidden />
        <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-[#0AB46A]/25 blur-[120px]" aria-hidden />
        <div className="absolute -bottom-48 -right-24 size-[460px] rounded-full bg-[#FB9002]/20 blur-[120px]" aria-hidden />
        <Link to="/" className="relative z-10 inline-flex text-white">
          <Logo className="[&_span]:text-white" />
        </Link>
        <div className="relative z-10 mx-auto w-full max-w-[460px]">
          <OrbitSystem compact />
        </div>
        <div className="relative z-10 max-w-md">
          <p className="font-display text-[26px] font-semibold leading-snug text-white">“Orbit understands where you are, connects what can help you grow, and shows you what to do next.”</p>
          <p className="mt-3 text-sm text-white/60">Build Your Path. Become Career-Ready.</p>
        </div>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[400px]">
          <Link to="/" className="mb-10 inline-flex lg:hidden">
            <Logo />
          </Link>
          <h1 className="text-[30px] font-bold leading-tight">{title}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 flex items-center gap-1.5 text-xs text-subtle-foreground">
            <ShieldCheck className="size-3.5" />
            {authMode === 'supabase' ? 'Secured with Supabase Auth.' : 'Your session is secured with a signed token.'}
          </p>
        </motion.div>
      </main>
    </div>
  );
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className="pr-10" {...props} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export function SignInPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(params.get('expired') ? 'Your session expired. Please sign in again.' : null);
  const [demoLoading, setDemoLoading] = useState(false);
  const form = useForm<z.infer<typeof signInSchema>>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });

  const finish = () => {
    queryClient.clear();
    navigate(params.get('next') ?? '/app', { replace: true });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await signIn(values.email, values.password);
      finish();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  const demo = async () => {
    setError(null);
    setDemoLoading(true);
    try {
      await signIn(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
      finish();
    } catch (e) {
      setError(`${(e as Error).message} Run "pnpm db:seed" to create the demo account.`);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue building your Orbit.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" className="mt-1.5" placeholder="you@example.com" aria-invalid={Boolean(form.formState.errors.email)} {...form.register('email')} />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <div className="mt-1.5">
            <PasswordInput id="password" autoComplete="current-password" placeholder="Your password" aria-invalid={Boolean(form.formState.errors.password)} {...form.register('password')} />
          </div>
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </div>
        {error && (
          <div role="alert" className="rounded-lg border border-danger/30 bg-muted-danger px-3 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Sign in <ArrowRight />
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-subtle-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="secondary" size="lg" className="w-full" onClick={demo} loading={demoLoading}>
        <PlayCircle className="text-orange" /> Explore the demo account
      </Button>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Orbit?{' '}
        <Link to="/signup" className="font-semibold text-green-strong hover:underline dark:text-green">
          Build your Orbit
        </Link>
      </p>
    </AuthLayout>
  );
}

const signUpSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name.').max(80),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(128),
});

export function SignUpPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof signUpSchema>>({ resolver: zodResolver(signUpSchema), defaultValues: { name: '', email: '', password: '' } });
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await signUp(values.name, values.email, values.password);
      queryClient.clear();
      navigate('/onboarding', { replace: true });
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <AuthLayout title="Build your Orbit" subtitle="Create your account — onboarding takes about three minutes.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" className="mt-1.5" placeholder="Your name" {...form.register('name')} />
          <FieldError>{form.formState.errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" className="mt-1.5" placeholder="you@example.com" {...form.register('email')} />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <div className="mt-1.5">
            <PasswordInput id="password" autoComplete="new-password" placeholder="At least 8 characters" {...form.register('password')} />
          </div>
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </div>
        {error && (
          <div role="alert" className="rounded-lg border border-danger/30 bg-muted-danger px-3 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Create account <ArrowRight />
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/signin" className="font-semibold text-green-strong hover:underline dark:text-green">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
