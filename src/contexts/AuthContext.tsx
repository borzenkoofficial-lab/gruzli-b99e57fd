import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_USERS, DEMO_WORKER_PROFILE, type DemoRole } from "@/data/demoData";

type AppRole = "client" | "worker" | "dispatcher" | "admin";
type User = { id: string; email?: string; phone?: string | null; user_metadata: Record<string, any> };
type Session = { user: User; access_token: string };

const DEMO_ENABLED = import.meta.env.DEV && import.meta.env.VITE_GRUZLI_DEMO_MODE === "true";

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

  const fetchRoleAndProfile = useCallback(async (nextUser: User) => {
    const [roleRes, profileRes] = await Promise.all([
      supabase.rpc("get_user_role", { _user_id: nextUser.id }),
      supabase.from("profiles").select("*").eq("user_id", nextUser.id).maybeSingle(),
    ]);

    if (roleRes.data) setRole(roleRes.data as AppRole);
    if (profileRes.data) setProfile(profileRes.data);

    return {
      roleError: roleRes.error?.message ?? null,
      profileError: profileRes.error?.message ?? null,
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        console.error("[Gruzli Auth] getSession failed:", error);
        setLoading(false);
        return;
      }

      const nextSession = data.session as Session | null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await fetchRoleAndProfile(nextSession.user);
      }

      if (mounted) setLoading(false);
      initialized = true;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;

      const normalized = nextSession as Session | null;
      setSession(normalized);
      setUser(normalized?.user ?? null);

      if (!normalized?.user) {
        setRole(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (initialized) await fetchRoleAndProfile(normalized.user);
      if (mounted) setLoading(false);
    });

    void initialize();

    const handleAvatarUpdate = () => {
      if (!mounted) return;
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) void fetchRoleAndProfile(data.session.user as User);
      });
    };

    window.addEventListener("profile-avatar-updated", handleAvatarUpdate);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("profile-avatar-updated", handleAvatarUpdate);
    };
  }, [fetchRoleAndProfile]);

  useEffect(() => {
    if (!DEMO_ENABLED) return;

    const handler = () => {
      setDemoMode(localStorage.getItem("gruzli_demo_worker") === "1");
      const saved = localStorage.getItem("gruzli_demo_role");
      if (saved === "client" || saved === "dispatcher" || saved === "worker") {
        setDemoRole(saved);
      }
    };

    window.addEventListener("gruzli-demo-change", handler);
    return () => window.removeEventListener("gruzli-demo-change", handler);
  }, []);

  const signOut = async () => {
    if (!DEMO_ENABLED || !demoMode) {
      await supabase.auth.signOut();
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
    user_metadata: {
      role: demoRole,
      full_name: demoUserData.name,
    },
  };

  const effectiveUser = DEMO_ENABLED && demoMode ? demoUser : user;
  const effectiveSession = DEMO_ENABLED && demoMode
    ? { user: demoUser, access_token: "demo-token" }
    : session;
  const effectiveRole = DEMO_ENABLED && demoMode ? demoRole : role;
  const effectiveProfile = DEMO_ENABLED && demoMode
    ? {
        ...DEMO_WORKER_PROFILE,
        full_name: demoUserData.name,
        role: demoRole,
        skills:
          demoRole === "worker"
            ? DEMO_WORKER_PROFILE.skills
            : demoRole === "dispatcher"
              ? ["Переезды", "Коммерческие объекты", "Бригады"]
              : ["Переезд", "Квартирные работы"],
      }
    : profile;

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        session: effectiveSession,
        role: effectiveRole,
        profile: effectiveProfile,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
