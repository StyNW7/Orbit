import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'motion/react';
import { ArrowRight, Check, Eye, EyeOff, PlayCircle, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand/brand';
import { OrbitSystem } from '@/features/landing/OrbitSystem';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/primitives';
import { DEMO_CREDENTIALS, authMode, signIn, signUp } from '@/lib/auth';
import { queryClient } from '@/hooks/queries';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LanguageToggle } from '@/components/common/LanguageToggle';
import { useT, type MessageKey } from '@/lib/i18n';

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#0d1512] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 opacity-[0.35] grid-dots" aria-hidden />
        <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-[#0AB46A]/25 blur-[120px]" aria-hidden />
        <div className="absolute -bottom-48 -right-24 size-[460px] rounded-full bg-[#FB9002]/20 blur-[120px]" aria-hidden />
        <Link to="/" className="relative z-10 inline-flex text-white">
          <Logo className="[&_span]:text-white" />
        </Link>
        <div className="relative z-10 mx-auto w-full max-w-[440px]">
          <OrbitSystem compact />
        </div>
        <div className="relative z-10 max-w-md">
          <p className="font-display text-[24px] font-semibold leading-snug text-white">{t('auth.quote')}</p>
          <ul className="mt-6 space-y-2.5">
            {(['auth.perk1', 'auth.perk2', 'auth.perk3'] as const).map((k) => (
              <li key={k} className="flex items-center gap-2.5 text-[14px] text-white/75">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#0AB46A]/25 text-[#5fe0a0]">
                  <Check className="size-3" />
                </span>
                {t(k)}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-white/50">{t('auth.tagline')}</p>
        </div>
      </aside>
      <main className="relative flex items-center justify-center px-4 py-16 sm:px-8">
        <div className="absolute right-4 top-4 flex items-center gap-1.5 sm:right-6 sm:top-6">
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[400px]">
          <Link to="/" className="mb-10 inline-flex lg:hidden">
            <Logo />
          </Link>
          <h1 className="text-[30px] font-bold leading-tight">{title}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 flex items-center gap-1.5 text-xs text-subtle-foreground">
            <ShieldCheck className="size-3.5" />
            {authMode === 'supabase' ? t('auth.securedSupabase') : t('auth.securedLocal')}
          </p>
        </motion.div>
      </main>
    </div>
  );
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  const [show, setShow] = useState(false);
  const { t } = useT();
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className="pr-10" {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
        aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

// Validation messages are i18n keys, translated at render so they follow the language toggle.
const signInSchema = z.object({
  email: z.string().trim().email('auth.err.email'),
  password: z.string().min(1, 'auth.err.passwordRequired'),
});

const signUpSchema = z.object({
  name: z.string().trim().min(2, 'auth.err.name').max(80, 'auth.err.name'),
  email: z.string().trim().email('auth.err.email'),
  password: z.string().min(8, 'auth.err.passwordMin').max(128, 'auth.err.passwordMin'),
});

function FieldMessage({ message }: { message?: string }) {
  const { t } = useT();
  return <FieldError>{message ? t(message as MessageKey) : undefined}</FieldError>;
}

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-muted-danger px-3 py-2.5 text-sm text-danger">
      {children}
    </div>
  );
}

export function SignInPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { t } = useT();
  const [error, setError] = useState<string | null>(params.get('expired') ? t('auth.expired') : null);
  const [demoLoading, setDemoLoading] = useState(false);
  const form = useForm<z.infer<typeof signInSchema>>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });

  const finish = () => {
    queryClient.clear();
    const next = params.get('next');
    // Only follow in-app redirects.
    navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/app', { replace: true });
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
      setError(`${(e as Error).message} ${t('auth.demoHint')}`);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <AuthLayout title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
      <div className="rounded-2xl border border-orange/30 bg-muted-orange/50 p-4">
        <Button variant="secondary" size="lg" className="w-full" onClick={demo} loading={demoLoading}>
          <PlayCircle className="text-orange" /> {t('auth.demo')}
        </Button>
        <p className="mt-2 text-center text-[12.5px] text-muted-foreground">{t('auth.demoNote')}</p>
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-subtle-foreground">
        <span className="h-px flex-1 bg-border" /> {t('common.or')} <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input id="email" type="email" autoComplete="email" className="mt-1.5" placeholder={t('auth.emailPlaceholder')} aria-invalid={Boolean(form.formState.errors.email)} {...form.register('email')} />
          <FieldMessage message={form.formState.errors.email?.message} />
        </div>
        <div>
          <Label htmlFor="password">{t('auth.password')}</Label>
          <div className="mt-1.5">
            <PasswordInput id="password" autoComplete="current-password" placeholder={t('auth.passwordPlaceholder')} aria-invalid={Boolean(form.formState.errors.password)} {...form.register('password')} />
          </div>
          <FieldMessage message={form.formState.errors.password?.message} />
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          {t('auth.signInCta')} <ArrowRight />
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.newToOrbit')}{' '}
        <Link to="/signup" className="font-semibold text-green-strong hover:underline dark:text-green">
          {t('auth.buildYourOrbit')}
        </Link>
      </p>
    </AuthLayout>
  );
}

export function SignUpPage() {
  const navigate = useNavigate();
  const { t } = useT();
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
    <AuthLayout title={t('auth.signUpTitle')} subtitle={t('auth.signUpSubtitle')}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="name">{t('auth.name')}</Label>
          <Input id="name" autoComplete="name" className="mt-1.5" placeholder={t('auth.namePlaceholder')} aria-invalid={Boolean(form.formState.errors.name)} {...form.register('name')} />
          <FieldMessage message={form.formState.errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input id="email" type="email" autoComplete="email" className="mt-1.5" placeholder={t('auth.emailPlaceholder')} aria-invalid={Boolean(form.formState.errors.email)} {...form.register('email')} />
          <FieldMessage message={form.formState.errors.email?.message} />
        </div>
        <div>
          <Label htmlFor="password">{t('auth.password')}</Label>
          <div className="mt-1.5">
            <PasswordInput id="password" autoComplete="new-password" placeholder={t('auth.newPasswordPlaceholder')} aria-invalid={Boolean(form.formState.errors.password)} {...form.register('password')} />
          </div>
          <FieldMessage message={form.formState.errors.password?.message} />
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          {t('auth.createAccount')} <ArrowRight />
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.haveAccount')}{' '}
        <Link to="/signin" className="font-semibold text-green-strong hover:underline dark:text-green">
          {t('common.signIn')}
        </Link>
      </p>
    </AuthLayout>
  );
}
