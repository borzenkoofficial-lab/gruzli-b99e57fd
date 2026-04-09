import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import SplashScreen from "@/components/SplashScreen";
import NewJobAlert from "@/components/NewJobAlert";
import type { Tables } from "@/integrations/supabase/types";

import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading, role } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [alertJob, setAlertJob] = useState<Tables<"jobs"> | null>(null);

  const handleNewJob = useCallback((job: Tables<"jobs">) => {
    setAlertJob(job);
  }, []);

  useRealtimeNotifications({ onNewJob: role === "worker" ? handleNewJob : undefined });

  const handleSplashFinished = useCallback(() => setSplashDone(true), []);

  if (loading || !splashDone) {
    return <SplashScreen onFinished={handleSplashFinished} />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {role === "worker" && (
        <NewJobAlert
          job={alertJob}
          onRespond={(job) => {
            setAlertJob(null);
            // Navigate to feed — the feed already handles respond
            window.dispatchEvent(new CustomEvent("navigate-to-feed"));
          }}
          onDismiss={() => setAlertJob(null)}
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
