import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "kitchen" | "courier";

const STAFF_ROLES: AppRole[] = ["admin", "kitchen", "courier"];

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

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!error && data && data.length > 0) {
        return uniqueRoles(data.map((r) => r.role as AppRole));
      }

      if (error) {
        console.error("[useAuth] fetchRoles error:", error);
      }

      // Fallback through the security-definer role checker. This avoids locking
      // staff out if direct role-row reads are delayed or restricted by RLS/GRANTs.
      const checkedRoles = await Promise.all(
        STAFF_ROLES.map(async (role) => {
          const { data: hasRole, error: roleError } = await supabase.rpc("has_role", {
            _user_id: userId,
            _role: role,
          });

          if (roleError) {
            console.error(`[useAuth] has_role(${role}) error:`, roleError);
            return null;
          }

          return hasRole ? role : null;
        })
      );

      return uniqueRoles(checkedRoles.filter((role): role is AppRole => role !== null));
    } catch (e) {
      console.error("[useAuth] fetchRoles exception:", e);
      return [];
    }
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
