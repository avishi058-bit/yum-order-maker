import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "kitchen";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    roles: [],
    loading: true,
  });

  const fetchRoles = useCallback(async (userId: string): Promise<AppRole[]> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) {
        console.error("[useAuth] fetchRoles error:", error);
        return [];
      }
      return (data?.map((r) => r.role as AppRole)) || [];
    } catch (e) {
      console.error("[useAuth] fetchRoles exception:", e);
      return [];
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Safety timeout — never stay in loading state for more than 6 seconds
    const safetyTimer = setTimeout(() => {
      if (!mounted) return;
      setState((prev) => (prev.loading ? { ...prev, loading: false } : prev));
    }, 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        const user = session?.user ?? null;
        // Set session immediately, fetch roles async to avoid blocking
        setState({ user, session, roles: [], loading: false });
        if (user) {
          const roles = await fetchRoles(user.id);
          if (mounted) setState({ user, session, roles, loading: false });
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const user = session?.user ?? null;
      setState({ user, session, roles: [], loading: false });
      if (user) {
        const roles = await fetchRoles(user.id);
        if (mounted) setState({ user, session, roles, loading: false });
      }
    }).catch((e) => {
      console.error("[useAuth] getSession failed:", e);
      if (mounted) setState({ user: null, session: null, roles: [], loading: false });
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchRoles]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setState({ user: null, session: null, roles: [], loading: false });
  };

  const hasRole = (role: AppRole) => state.roles.includes(role);
  const isAdmin = () => hasRole("admin");
  const isKitchen = () => hasRole("kitchen");
  const isStaff = () => isAdmin() || isKitchen();

  return { ...state, signIn, signOut, hasRole, isAdmin, isKitchen, isStaff };
};
