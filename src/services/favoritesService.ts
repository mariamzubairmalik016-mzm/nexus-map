import { api } from "./api";
import type { FavoriteRecord } from "../types/geo";

export const favoritesService = {
  async getAll(): Promise<FavoriteRecord[]> {
    return api.get<FavoriteRecord[]>("/favorites");
  },

  async add(placeId: string): Promise<FavoriteRecord> {
    return api.post<FavoriteRecord>("/favorites", { placeId });
  },

  async remove(placeId: string): Promise<void> {
    return api.delete(`/favorites/${placeId}`);
  },
};
