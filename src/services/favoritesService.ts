import { supabase } from "../lib/supabase";
import type { FavoriteRecord } from "../types/geo";

const requireSupabase = () => {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
};

const getCurrentUserId = async () => {
  const client = requireSupabase();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Please login first.");

  return user.id;
};

export const favoritesService = {
  async getAll(): Promise<FavoriteRecord[]> {
    const client = requireSupabase();
    const userId = await getCurrentUserId();

    const { data, error } = await client
      .from("favorites")
      .select("id,user_id,place_id,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as FavoriteRecord[];
  },

  async add(placeId: string): Promise<FavoriteRecord> {
    const client = requireSupabase();
    const userId = await getCurrentUserId();

    const { data, error } = await client
      .from("favorites")
      .upsert(
        {
          user_id: userId,
          place_id: placeId,
        },
        {
          onConflict: "user_id,place_id",
        },
      )
      .select("id,user_id,place_id,created_at")
      .single();

    if (error) throw error;
    return data as FavoriteRecord;
  },

  async remove(placeId: string): Promise<void> {
    const client = requireSupabase();
    const userId = await getCurrentUserId();

    const { error } = await client
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("place_id", placeId);

    if (error) throw error;
  },
};
