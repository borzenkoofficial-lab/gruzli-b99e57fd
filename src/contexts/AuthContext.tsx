import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "worker" | "dispatcher" | "admin";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: any;
  loading: boolean;
  authError: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  profile: null,
  loading: true,
  authError: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchRoleAndProfile = useCallback(async (userId: string) => {
    setAuthError(null);

    const [roleRes, profileRes] = await Promise.all([
      supabase.rpc("get_user_role", { _user_id: userId }),
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    const errors: string[] = [];

    if (roleRes.error) {
      console.error("[Gruzli Auth] get_user_role failed:", roleRes.error);
      errors.push(`role: ${roleRes.error.message}`);
    } else if (roleRes.data) {
      setRole(roleRes.data as AppRole);
    }

    if (profileRes.error) {
      console.error("[Gruzli Auth] profiles query failed:", profileRes.error);
      errors.push(`profile: ${profileRes.error.message}`);
    } else if (profileRes.data) {
      setProfile(profileRes.data);
    }

    if (errors.length > 0) {
      const message = errors.join(" | ");
      setAuthError(message);
      console.error("[Gruzli Auth] profile bootstrap failed:", message);
    }

    return errors.length === 0;
  }, []);

  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("[Gruzli Auth] getSession failed:", error);
        setAuthError(`session: ${error.message}`);
        setLoading(false);
        return;
      }

      const nextSession = data.session;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await fetchRoleAndProfile(nextSession.user.id);
      }

      if (mounted) setLoading(false);
      initialized = true;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        if (!mounted) return;

        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (!nextSession?.user) {
          setRole(null);
          setProfile(null);
          setAuthError(null);
          setLoading(false);
          return;
        }

        // Initial getSession() handles the first session bootstrap.
        // Later auth events (SIGNED_IN, TOKEN_REFRESHED, etc.) refresh role/profile.
        if (initialized) {
          await fetchRoleAndProfile(nextSession.user.id);
        }

        if (mounted) setLoading(false);
      }
    );

    initialize();

    const handleAvatarUpdate = () => {
      if (mounted) {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session?.user) {
            fetchRoleAndProfile(data.session.user.id);
          }
        });
      }
    };

    window.addEventListener("profile-avatar-updated", handleAvatarUpdate);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("profile-avatar-updated", handleAvatarUpdate);
    };
  }, [fetchRoleAndProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, authError, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
