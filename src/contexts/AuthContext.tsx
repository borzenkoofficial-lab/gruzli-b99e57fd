import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  user: null, session: null, role: null, profile: null, loading: true, signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(() => localStorage.getItem("gruzli_demo_worker") === "1");

  const fetchRoleAndProfile = async (nextUser: User) => {
    const userId = nextUser.id;
    const [roleRes, profileRes] = await Promise.all([
      supabase.rpc("get_user_role", { _user_id: userId }),
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
    ]);
    const metadataRole = nextUser.user_metadata?.role as AppRole | undefined;
    if (roleRes.data) setRole(roleRes.data as AppRole);
    else if (metadataRole && ["client", "worker", "dispatcher", "admin"].includes(metadataRole)) setRole(metadataRole);
    if (profileRes.data) setProfile(profileRes.data);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) setTimeout(() => fetchRoleAndProfile(nextSession.user), 0);
      else { setRole(null); setProfile(null); }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) fetchRoleAndProfile(nextSession.user);
      setLoading(false);
    });

    const handleAvatarUpdate = () => {
      supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
        if (nextSession?.user) fetchRoleAndProfile(nextSession.user);
      });
    };
    window.addEventListener("profile-avatar-updated", handleAvatarUpdate);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("profile-avatar-updated", handleAvatarUpdate);
    };
  }, []);

  useEffect(() => {
    const handler = () => setDemoMode(localStorage.getItem("gruzli_demo_worker") === "1");
    window.addEventListener("gruzli-demo-change", handler);
    return () => window.removeEventListener("gruzli-demo-change", handler);
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null); setSession(null); setRole(null); setProfile(null);
    localStorage.removeItem("gruzli_demo_worker");
    setDemoMode(false);
  };

  const demoUser: User = { id: "demo-worker", email: "demo@gruzli.local", user_metadata: { role: "worker", full_name: "Демо-грузчик" } };
  const effectiveUser = demoMode ? demoUser : user;
  const effectiveSession = demoMode ? { user: demoUser, access_token: "demo-token" } : session;
  const effectiveRole = demoMode ? "worker" : role;
  const effectiveProfile = demoMode ? {
    full_name: "Демо-грузчик", role: "worker", rating: 4.96, completed_orders: 128,
    total_earned: 186400, balance: 12450, is_premium: true,
    premium_until: "2026-12-31T23:59:59Z", skills: ["Переезды","Разгрузка","Демонтаж"],
  } : profile;

  return <AuthContext.Provider value={{ user: effectiveUser, session: effectiveSession, role: effectiveRole, profile: effectiveProfile, loading, signOut }}>{children}</AuthContext.Provider>;
};
