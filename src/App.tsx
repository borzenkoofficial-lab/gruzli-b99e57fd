import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import SplashScreen from "@/components/SplashScreen";

import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  useRealtimeNotifications();

  const handleSplashFinished = useCallback(() => setSplashDone(true), []);

  // Show splash while loading auth
  if (loading || !splashDone) {
    return <SplashScreen onFinished={handleSplashFinished} />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
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
