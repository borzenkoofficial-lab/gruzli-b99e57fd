import { useState, useCallback, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { usePresence } from "@/hooks/usePresence";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import SplashScreen from "@/components/SplashScreen";
import NewJobAlert from "@/components/NewJobAlert";
import AppRatingModal from "@/components/AppRatingModal";
import type { Tables } from "@/integrations/supabase/types";

import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";

const AdminPage = lazy(() => import("./pages/AdminPage"));
const UnsubscribePage = lazy(() => import("./pages/UnsubscribePage"));

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading, role } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [alertQueue, setAlertQueue] = useState<Tables<"jobs">[]>([]);
  useViewportHeight();
  usePresence();

  const handleNewJob = useCallback((job: Tables<"jobs">) => {
    setAlertQueue((q) => [...q, job]);
  }, []);

  useRealtimeNotifications({ onNewJob: role === "worker" ? handleNewJob : undefined });

  const handleSplashFinished = useCallback(() => setSplashDone(true), []);

  const dismissFirst = useCallback(() => setAlertQueue((q) => q.slice(1)), []);

  if (loading || !splashDone) {
    return <SplashScreen onFinished={handleSplashFinished} />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <>
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <AppRatingModal />
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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
