import { useSession, signIn, signOut } from "next-auth/react";

export const useAuth = () => {
  const { data: session, status } = useSession();

  return {
    user: session?.user ?? null,
    profile: session?.user ?? null,
    loading: status === "loading",
    signIn: async (email?: string, password?: string) => {
      const res = await signIn("credentials", { redirect: false, email, password });
      if (res?.error) throw new Error(res.error);
    },
    signUp: async (fullName?: string, email?: string, password?: string) => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Signup failed");
      }
      return { needsVerification: false };
    },
    signOut: async () => {
      await signOut({ redirect: false });
    },
    updateProfile: async (updates: any) => {
      // Stub for profile update API
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update profile");
    },
  };
};
