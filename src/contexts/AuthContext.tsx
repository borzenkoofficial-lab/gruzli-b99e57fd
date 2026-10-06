import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "client" | "worker" | "dispatcher" | "admin";
type User = { id: string; email?: string; phone?: string | null; user_metadata: Record<string, any> };
type Session = { user: User; access_token: string };

const DEMO_ENABLED = import.meta.env.VITE_GRUZLI_DEMO_MODE === "true";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: any;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, role: null, profile: null, loading: true, signOut: async () => {},
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
  });  const fetchRoleAndProfile = useCallback(async (nextUser: User) => {
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
  }, []);  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) {
        setLoading(false);
        console.error("[Gruzli Auth] getSession failed:", error);
        return;
      }
      const nextSession = data.session;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) await fetchRoleAndProfile(nextSession.user);
      if (mounted) setLoading(false);
      initialized = true;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession?.user) {
        setRole(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      if (initialized) await fetchRoleAndProfile(nextSession.user);
      if (mounted) setLoading(false);
    });

    initialize();

    const handleAvatarUpdate = () => {
      if (!mounted) return;
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) void fetchRoleAndProfile(data.session.user);
      });
    };
    window.addEventListener("profile-avatar-updated", handleAvatarUpdate);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("profile-avatar-updated", handleAvatarUpdate);
    };
  }, [fetchRoleAndProfile]);
