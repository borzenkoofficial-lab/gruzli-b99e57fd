import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { DEMO_PROFILES, DEMO_USERS, type DemoRole } from "@/data/demoData";

type AppRole = "client" | "worker" | "dispatcher" | "admin";
type User = { id: string; email?: string; phone?: string | null; user_metadata: Record<string, any> };
type Session = { user: User; access_token: string };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: any;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);
const DEMO_ENABLED = import.meta.env.DEV && import.meta.env.VITE_GRUZLI_DEMO_MODE === "true";

async function requestCurrentUser() {
  const response = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Не удалось проверить сессию");
  return response.json();
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(() => DEMO_ENABLED && localStorage.getItem("gruzli_demo_worker") === "1");
  const [demoRole, setDemoRole] = useState<AppRole>(() => {
    if (!DEMO_ENABLED) return "worker";
    const saved = localStorage.getItem("gruzli_demo_role");
    return saved === "client" || saved === "dispatcher" || saved === "worker" ? saved : "worker";
  });

  const applyAuth = useCallback((payload: any) => {
    const nextUser = payload?.user ?? null;
    setUser(nextUser);
    setSession(nextUser ? { user: nextUser, access_token: "http-only-cookie-session" } : null);
    setRole(payload?.role ?? null);
    setProfile(payload?.profile ?? null);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const payload = await requestCurrentUser();
      applyAuth(payload);
    } catch (error) {
      console.error("[Gruzli Auth] Session refresh failed:", error);
    } finally {
      setLoading(false);
    }
  }, [applyAuth]);

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      try {
        const payload = await requestCurrentUser();
        if (mounted) applyAuth(payload);
      } catch (error) {
        console.error("[Gruzli Auth] Session initialization failed:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void initialize();

    const handleAvatarUpdate = () => { if (mounted) void refreshSession(); };
    const handleAuthChanged = () => { if (mounted) void refreshSession(); };
    window.addEventListener("profile-avatar-updated", handleAvatarUpdate);
    window.addEventListener("gruzli-auth-changed", handleAuthChanged);
    return () => {
      mounted = false;
      window.removeEventListener("profile-avatar-updated", handleAvatarUpdate);
      window.removeEventListener("gruzli-auth-changed", handleAuthChanged);
    };
  }, [applyAuth, refreshSession]);

  useEffect(() => {
    if (!DEMO_ENABLED) return;
    const handler = () => {
      setDemoMode(localStorage.getItem("gruzli_demo_worker") === "1");
      const saved = localStorage.getItem("gruzli_demo_role");
      if (saved === "client" || saved === "dispatcher" || saved === "worker") setDemoRole(saved);
    };
    window.addEventListener("gruzli-demo-change", handler);
    return () => window.removeEventListener("gruzli-demo-change", handler);
  }, []);

  const signOut = async () => {
    if (!(DEMO_ENABLED && demoMode)) {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("Не удалось завершить сеанс");
    }
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
    if (DEMO_ENABLED) {
      localStorage.removeItem("gruzli_demo_worker");
      localStorage.removeItem("gruzli_demo_role");
      setDemoMode(false);
    }
  };

  const demoUserData = DEMO_USERS[demoRole as DemoRole];
  const demoUser: User = {
    id: demoUserData.id,
    email: demoUserData.email,
    user_metadata: { role: demoRole, full_name: demoUserData.name },
  };
  const effectiveUser = DEMO_ENABLED && demoMode ? demoUser : user;
  const effectiveSession = DEMO_ENABLED && demoMode ? { user: demoUser, access_token: "demo-token" } : session;
  const effectiveRole = DEMO_ENABLED && demoMode ? demoRole : role;
  const effectiveProfile = DEMO_ENABLED && demoMode
    ? { ...DEMO_PROFILES[demoRole as DemoRole], full_name: demoUserData.name, role: demoRole }
    : profile;

  return (
    <AuthContext.Provider value={{ user: effectiveUser, session: effectiveSession, role: effectiveRole, profile: effectiveProfile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
