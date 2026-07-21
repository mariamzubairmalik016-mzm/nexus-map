import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthError, User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import type { Profile } from "../types";

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ needsVerification: boolean }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Real Supabase auth only — no demo/mock fallback.
const requireClient = () => {
  if (!supabase) {
    throw new Error(
      "Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  return supabase;
};

// Map raw Supabase auth errors to friendly, user-facing messages.
const friendly = (error: AuthError): Error => {
  const message = error.message.toLowerCase();
  if (message.includes("invalid login")) return new Error("Invalid email or password.");
  if (message.includes("already registered") || message.includes("already been registered")) {
    return new Error("An account with this email already exists. Try signing in.");
  }
  if (message.includes("email not confirmed")) {
    return new Error("Please verify your email before signing in — check your inbox.");
  }
  if (message.includes("password")) return new Error(error.message);
  return new Error(error.message || "Authentication failed. Please try again.");
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (authUser: User) => {
    const client = supabase;
    if (!client) return;

    const { data } = await client
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (data) {
      setProfile(data as Profile);
      return;
    }

    // The DB trigger normally creates the row; if it hasn't yet, derive a
    // profile from the authenticated user's metadata (role always defaults to
    // "user" — admin is granted in the database, never inferred client-side).
    setProfile({
      id: authUser.id,
      full_name: (authUser.user_metadata?.full_name as string | undefined) ?? null,
      email: authUser.email ?? null,
      avatar_url: null,
      phone: null,
      country: null,
      city: null,
      bio: null,
      role: "user",
    });
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      if (currentUser) await loadProfile(currentUser);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        void loadProfile(currentUser);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const client = requireClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw friendly(error);
  };

  const signUp = async (fullName: string, email: string, password: string) => {
    const client = requireClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw friendly(error);
    // When email confirmation is enabled, no session is returned until verified.
    return { needsVerification: !data.session };
  };

  const signOut = async () => {
    const client = requireClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    const client = requireClient();
    if (!user) throw new Error("You must be logged in.");

    const { data, error } = await client
      .from("profiles")
      .upsert({ id: user.id, ...updates })
      .select()
      .single();
    if (error) throw error;
    setProfile(data as Profile);
  };

  const value = useMemo(
    () => ({ user, profile, loading, signIn, signUp, signOut, updateProfile }),
    [user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
