import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "kitchen" | "courier";

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
    const uniqueRoles = (roles: AppRole[]) => Array.from(new Set(roles));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (error) {
          console.error("[useAuth] fetchRoles error:", error);
        } else if (data && data.length > 0) {
          return uniqueRoles(data.map((r) => r.role as AppRole));
        }

        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        }
      } catch (e) {
        console.error("[useAuth] fetchRoles exception:", e);
        return [];
      }
    }

    return [];
  }, []);

  useEffect(() => {
    let mounted = true;

    const applySession = async (session: Session | null) => {
      if (!mounted) return;
      const user = session?.user ?? null;

      if (!user) {
        setState({ user: null, session: null, roles: [], loading: false });
        return;
      }

      setState((prev) => ({ ...prev, user, session, loading: true }));
      const roles = await fetchRoles(user.id);
      if (!mounted) return;
      setState({ user, session, roles, loading: false });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        void applySession(session);
      }
    );

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        await applySession(session);
      })
      .catch((e) => {
        console.error("[useAuth] getSession failed:", e);
        if (mounted) setState({ user: null, session: null, roles: [], loading: false });
      });

    return () => {
      mounted = false;
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
