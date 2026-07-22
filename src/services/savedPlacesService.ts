import { supabase } from "../lib/supabase";
import { offlineDb } from "./offlineDb";
import { networkStatus } from "./networkStatus";
import type { SavedPlace, SavedPlaceCategory } from "../types/navigation";

/**
 * Saved places (Home / Work / University / custom).
 *
 * Supabase is the source of truth; IndexedDB holds a mirror so the list stays
 * readable and editable offline. Offline edits are marked `pendingSync` and
 * pushed on reconnect, with last-write-wins by `updatedAt`.
 *
 * The anon key is all the browser ever uses — Row Level Security (see
 * supabase/saved_places_setup.sql) is what keeps one user out of another's rows.
 */

type Row = {
  id: string;
  user_id: string;
  label: string;
  category: SavedPlaceCategory;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  notes: string | null;
  favorite: boolean;
  last_visited_at: string | null;
  created_at: string;
  updated_at: string;
};

const fromRow = (row: Row): SavedPlace => ({
  id: row.id,
  userId: row.user_id,
  label: row.label,
  category: row.category,
  name: row.name,
  address: row.address ?? undefined,
  latitude: row.latitude,
  longitude: row.longitude,
  notes: row.notes ?? undefined,
  favorite: row.favorite,
  lastVisitedAt: row.last_visited_at ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  pendingSync: false,
});

const toRow = (place: SavedPlace, userId: string) => ({
  id: place.id,
  user_id: userId,
  label: place.label,
  category: place.category,
  name: place.name,
  address: place.address ?? null,
  latitude: place.latitude,
  longitude: place.longitude,
  notes: place.notes ?? null,
  favorite: place.favorite,
  last_visited_at: place.lastVisitedAt ?? null,
});

const requireClient = () => {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
};

const currentUserId = async (): Promise<string | null> => {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
};

const localList = async () => {
  const places = await offlineDb.getSavedPlaces().catch(() => [] as SavedPlace[]);
  return places.filter((place) => !place.deleted).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const savedPlacesService = {
  /** Offline (or signed-out): the local mirror. Online: refresh from Supabase. */
  list: async (): Promise<SavedPlace[]> => {
    if (networkStatus.isOffline() || !supabase) return localList();

    const userId = await currentUserId();
    if (!userId) return localList();

    try {
      const { data, error } = await requireClient()
        .from("saved_places")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const remote = (data as Row[]).map(fromRow);

      // Keep anything still waiting to sync — it is newer than the server copy.
      const local = await offlineDb.getSavedPlaces().catch(() => [] as SavedPlace[]);
      const pending = local.filter((place) => place.pendingSync);
      const merged = [...remote.filter((r) => !pending.some((p) => p.id === r.id)), ...pending];

      await offlineDb.saveSavedPlaces(merged);
      return merged.filter((place) => !place.deleted).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch {
      return localList();
    }
  },

  save: async (input: {
    id?: string;
    label: string;
    category: SavedPlaceCategory;
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
    notes?: string;
    favorite?: boolean;
  }): Promise<SavedPlace> => {
    const now = new Date().toISOString();
    const existing = input.id
      ? (await offlineDb.getSavedPlaces().catch(() => [] as SavedPlace[])).find((p) => p.id === input.id)
      : undefined;

    const place: SavedPlace = {
      id: input.id ?? crypto.randomUUID(),
      label: input.label,
      category: input.category,
      name: input.name,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      notes: input.notes,
      favorite: input.favorite ?? existing?.favorite ?? false,
      lastVisitedAt: existing?.lastVisitedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      pendingSync: true,
    };

    // Write locally first so the UI is correct whether or not the push works.
    await offlineDb.saveSavedPlace(place);

    const userId = networkStatus.isOnline() ? await currentUserId() : null;
    if (!userId) return place;

    try {
      const { error } = await requireClient().from("saved_places").upsert(toRow(place, userId));
      if (error) throw error;
      const synced = { ...place, userId, pendingSync: false };
      await offlineDb.saveSavedPlace(synced);
      return synced;
    } catch {
      // Stays pendingSync — sync() will push it on reconnect.
      return place;
    }
  },

  toggleFavorite: async (id: string): Promise<SavedPlace | null> => {
    const places = await offlineDb.getSavedPlaces().catch(() => [] as SavedPlace[]);
    const place = places.find((item) => item.id === id);
    if (!place) return null;
    return savedPlacesService.save({ ...place, favorite: !place.favorite });
  },

  remove: async (id: string): Promise<void> => {
    const places = await offlineDb.getSavedPlaces().catch(() => [] as SavedPlace[]);
    const place = places.find((item) => item.id === id);

    const userId = networkStatus.isOnline() ? await currentUserId() : null;
    if (userId) {
      try {
        const { error } = await requireClient().from("saved_places").delete().eq("id", id).eq("user_id", userId);
        if (error) throw error;
        await offlineDb.deleteSavedPlace(id);
        return;
      } catch {
        /* fall through to the offline tombstone */
      }
    }

    // Offline: keep a tombstone so the deletion survives and can be replayed.
    if (place) {
      await offlineDb.saveSavedPlace({
        ...place,
        deleted: true,
        pendingSync: true,
        updatedAt: new Date().toISOString(),
      });
    }
  },

  /** Pushes everything queued offline. Called on reconnect. */
  sync: async (): Promise<{ pushed: number; failed: number }> => {
    if (networkStatus.isOffline() || !supabase) return { pushed: 0, failed: 0 };

    const userId = await currentUserId();
    if (!userId) return { pushed: 0, failed: 0 };

    const places = await offlineDb.getSavedPlaces().catch(() => [] as SavedPlace[]);
    const pending = places.filter((place) => place.pendingSync);

    let pushed = 0;
    let failed = 0;

    for (const place of pending) {
      try {
        if (place.deleted) {
          const { error } = await requireClient()
            .from("saved_places")
            .delete()
            .eq("id", place.id)
            .eq("user_id", userId);
          if (error) throw error;
          await offlineDb.deleteSavedPlace(place.id);
        } else {
          // upsert on the primary key: replaying the same change twice is safe,
          // so a retry can never create a duplicate.
          const { error } = await requireClient().from("saved_places").upsert(toRow(place, userId));
          if (error) throw error;
          await offlineDb.saveSavedPlace({ ...place, userId, pendingSync: false });
        }
        pushed += 1;
      } catch {
        failed += 1;
      }
    }

    return { pushed, failed };
  },
};
