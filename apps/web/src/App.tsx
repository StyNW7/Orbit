import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Link, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Compass } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/overlays';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { queryClient, useMe } from '@/hooks/queries';
import { useSessionStore } from '@/stores/session';
import { useIsDark } from '@/stores/ui';
import { useT } from '@/lib/i18n';

const LandingPage = lazy(() => import('@/features/landing/LandingPage'));
const SignInPage = lazy(() => import('@/features/auth/AuthPages').then((m) => ({ default: m.SignInPage })));
const SignUpPage = lazy(() => import('@/features/auth/AuthPages').then((m) => ({ default: m.SignUpPage })));
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage'));
// The signed-in shell (agent drawer, command palette, markdown) stays out of the landing bundle.
const AppShell = lazy(() => import('@/components/layout/AppShell').then((m) => ({ default: m.AppShell })));
const MissionControlPage = lazy(() => import('@/features/mission/MissionControlPage'));
const UniversePage = lazy(() => import('@/features/universe/UniversePage'));
const JourneyPage = lazy(() => import('@/features/journey/JourneyPage'));
const DiscoverPage = lazy(() => import('@/features/discover/DiscoverPage'));
const JobDetailPage = lazy(() => import('@/features/discover/JobDetailPage'));
const ApplicationsPage = lazy(() => import('@/features/discover/ApplicationsPage'));
const ApplicationDetailPage = lazy(() => import('@/features/discover/ApplicationDetailPage'));
const ProgressPage = lazy(() => import('@/features/progress/ProgressPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const GuidePage = lazy(() => import('@/features/guide/GuidePage'));

function FullScreenLoader({ label }: { label?: string }) {
  const { t } = useT();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <LoadingState label={label ?? t('app.loading')} />
    </div>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullScreenLoader />}>{children}</Suspense>;
}

/** Requires a session; optionally requires completed onboarding. */
function RequireAuth({ onboarding }: { onboarding: 'required' | 'pending' }) {
  const token = useSessionStore((s) => s.token);
  const location = useLocation();
  const { t } = useT();
  const { data: me, isLoading, error, refetch } = useMe(Boolean(token));
  if (!token) return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (isLoading) return <FullScreenLoader label={t('app.loadingYour')} />;
  if (error || !me) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }
  if (onboarding === 'required' && !me.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const token = useSessionStore((s) => s.token);
  return token ? <Navigate to="/app" replace /> : <>{children}</>;
}

function NotFound() {
  const { t } = useT();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <EmptyState
        icon={Compass}
        title={t('app.notFoundTitle')}
        description={t('app.notFoundDesc')}
        action={
          <Button asChild>
            <Link to="/app">{t('app.backToMission')}</Link>
          </Button>
        }
      />
    </div>
  );
}

const router = createBrowserRouter([
  { path: '/', element: <Page><LandingPage /></Page> },
  { path: '/signin', element: <RedirectIfAuthed><Page><SignInPage /></Page></RedirectIfAuthed> },
  { path: '/signup', element: <RedirectIfAuthed><Page><SignUpPage /></Page></RedirectIfAuthed> },
  {
    element: <RequireAuth onboarding="pending" />,
    children: [{ path: '/onboarding', element: <Page><OnboardingPage /></Page> }],
  },
  {
    element: <RequireAuth onboarding="required" />,
    children: [
      {
        path: '/app',
        element: <Page><AppShell /></Page>,
        children: [
          { index: true, element: <MissionControlPage /> },
          { path: 'universe', element: <UniversePage /> },
          { path: 'journey', element: <JourneyPage /> },
          { path: 'discover', element: <DiscoverPage /> },
          { path: 'discover/jobs/:id', element: <JobDetailPage /> },
          { path: 'discover/applications', element: <ApplicationsPage /> },
          { path: 'discover/applications/:id', element: <ApplicationDetailPage /> },
          { path: 'progress', element: <ProgressPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'guide', element: <GuidePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
]);

export default function App() {
  const dark = useIsDark();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster
          position="bottom-right"
          theme={dark ? 'dark' : 'light'}
          toastOptions={{ classNames: { toast: 'rounded-xl border border-border bg-surface text-foreground shadow-pop', description: 'text-muted-foreground' } }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
