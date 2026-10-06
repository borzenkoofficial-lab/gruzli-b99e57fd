import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { usePresence } from "@/hooks/usePresence";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import ErrorBoundary from "@/components/ErrorBoundary";
import SplashScreen from "@/components/SplashScreen";
import NewJobAlert from "@/components/NewJobAlert";
import AppRatingModal from "@/components/AppRatingModal";
import OnboardingTour from "@/components/OnboardingTour";
import IncomingCallListener from "@/components/chat/IncomingCallListener";
import type { Tables } from "@/integrations/supabase/types";

import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";

const AdminPage = lazy(() => import("./pages/AdminPage"));
const UnsubscribePage = lazy(() => import("./pages/UnsubscribePage"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const DEMO_ENABLED = import.meta.env.DEV && import.meta.env.VITE_GRUZLI_DEMO_MODE === "true";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppRoutes = () => {
  const { user, loading, role } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [demoWorkerMode, setDemoWorkerMode] = useState(() => DEMO_ENABLED && localStorage.getItem("gruzli_demo_worker") === "1");
  const [alertQueue, setAlertQueue] = useState<Tables<"jobs">[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem("onboarding_completed");
  });
  useViewportHeight();
  usePresence();

  const handleNewJob = useCallback((job: Tables<"jobs">) => {
    setAlertQueue((q) => [...q, job]);
  }, []);

  useRealtimeNotifications({ onNewJob: role === "worker" ? handleNewJob : undefined });

  const handleSplashFinished = useCallback(() => setSplashDone(true), []);

  const dismissFirst = useCallback(() => setAlertQueue((q) => q.slice(1)), []);

  const location = useLocation();
  const isConsentRoute = location.pathname === "/.lovable/oauth/consent";

  // After a successful sign-in, resume a pending OAuth consent flow if one was preserved.
  useEffect(() => {
    if (!user) return;
    const next = sessionStorage.getItem("oauth_consent_next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      sessionStorage.removeItem("oauth_consent_next");
      window.location.replace(next);
    }
  }, [user]);

  if (!(DEMO_ENABLED && demoWorkerMode) && (loading || (!splashDone && !isConsentRoute))) {
    return <SplashScreen onFinished={handleSplashFinished} />;
  }

  if (!user && !isConsentRoute && !(DEMO_ENABLED && demoWorkerMode)) {
    return <AuthPage onDemoLogin={DEMO_ENABLED ? () => { localStorage.setItem("gruzli_demo_worker", "1"); setDemoWorkerMode(true); window.dispatchEvent(new Event("gruzli-demo-change")); } : undefined} />;
  }

  return (
    <>
      {showOnboarding && (
        <OnboardingTour onComplete={() => setShowOnboarding(false)} />
      )}
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Navigate to="/" replace />} />
          <Route path="/job/:jobId" element={<Index />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <AppRatingModal />
      <IncomingCallListener />
      {role === "worker" && (
        <NewJobAlert
          job={alertQueue[0] ?? null}
          queueSize={alertQueue.length}
          onRespond={() => {
            dismissFirst();
            window.dispatchEvent(new CustomEvent("navigate-to-feed"));
          }}
          onDismiss={dismissFirst}
        />
      )}
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <AuthProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
