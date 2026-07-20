import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { Profile } from "../types";

type DemoUser = {
  id: string;
  email: string;
};

type AuthUser = User | DemoUser;

type AuthContextValue = {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_KEY = "nexus_demo_user";
const PROFILE_KEY = "nexus_demo_profile";

const createDemoProfile = (id: string, email: string, fullName?: string): Profile => ({
  id,
  full_name: fullName || email.split("@")[0],
  email,
  avatar_url: null,
  phone: null,
  country: "Pakistan",
  city: "Karachi",
  bio: "Exploring the world with Nexus Map.",
  role: email.toLowerCase().includes("admin") ? "admin" : "user",
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string, email: string) => {
    if (supabase) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        setProfile(data as Profile);
        return;
      }
    }

    const stored = localStorage.getItem(PROFILE_KEY);
    if (stored) {
      setProfile(JSON.parse(stored) as Profile);
    } else {
      const fallback = createDemoProfile(userId, email);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(fallback));
      setProfile(fallback);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      const stored = localStorage.getItem(DEMO_KEY);
      if (stored) {
        const demoUser = JSON.parse(stored) as DemoUser;
        setUser(demoUser);
        void loadProfile(demoUser.id, demoUser.email);
      }
      setLoading(false);
      return;
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      if (currentUser?.email) {
        await loadProfile(currentUser.id, currentUser.email);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser?.email) {
        void loadProfile(currentUser.id, currentUser.email);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return;
    }

    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    const demoUser = { id: crypto.randomUUID(), email };
    localStorage.setItem(DEMO_KEY, JSON.stringify(demoUser));
    const demoProfile = createDemoProfile(demoUser.id, email);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(demoProfile));
    setUser(demoUser);
    setProfile(demoProfile);
  };

  const signUp = async (fullName: string, email: string, password: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      return;
    }

    const demoUser = { id: crypto.randomUUID(), email };
    const demoProfile = createDemoProfile(demoUser.id, email, fullName);
    localStorage.setItem(DEMO_KEY, JSON.stringify(demoUser));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(demoProfile));
    setUser(demoUser);
    setProfile(demoProfile);
  };

  const signOut = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    localStorage.removeItem(DEMO_KEY);
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) throw new Error("You must be logged in.");

    if (supabase) {
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw error;
      setProfile(data as Profile);
      return;
    }

    const updated = { ...(profile ?? createDemoProfile(user.id, user.email ?? "")), ...updates };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    setProfile(updated);
  };

  const value = useMemo(
    () => ({ user, profile, loading, signIn, signUp, signOut, updateProfile }),
    [user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
