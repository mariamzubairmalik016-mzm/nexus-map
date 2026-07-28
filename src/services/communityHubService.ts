import type {
  Review,
  TravelGroup,
  CommunityTip,
  Comment,
} from "../types/tourism";
import { api } from "./api";
import { offlineDb } from "./offlineDb";
import type { DigitalPassport } from "../types/tourism";

export const communityHubService = {
  // ─── Reviews ─────────────────────────────────────────────
  async getReviews(placeId?: string): Promise<Review[]> {
    const qp = placeId ? `?placeId=${encodeURIComponent(placeId)}` : "";
    try {
      return await api.get<Review[]>(`/community/reviews${qp}`);
    } catch {
      return [];
    }
  },

  async submitReview(review: Omit<Review, "id" | "createdAt" | "likes" | "helpfulCount">): Promise<Review> {
    try {
      return await api.post<Review>("/community/reviews", review);
    } catch (error) {
      throw new Error((error as Error).message || "Failed to submit review");
    }
  },

  async markReviewHelpful(reviewId: string): Promise<void> {
    // In production, update backend
  },

  // ─── Community Tips ──────────────────────────────────────
  async getTips(category?: string): Promise<CommunityTip[]> {
    const qp = category ? `?category=${encodeURIComponent(category)}` : "";
    try {
      const data = await api.get<CommunityTip[]>(`/community/tips${qp}`);
      return data.sort((a, b) => b.likes - a.likes);
    } catch {
      return [];
    }
  },

  async submitTip(tip: Omit<CommunityTip, "id" | "likes" | "bookmarks" | "comments" | "createdAt">): Promise<CommunityTip> {
    try {
      return await api.post<CommunityTip>("/community/tips", tip);
    } catch (error) {
      throw new Error((error as Error).message || "Failed to submit tip");
    }
  },

  async likeTip(tipId: string): Promise<void> {
    // In production, update backend
  },

  async bookmarkTip(tipId: string): Promise<void> {
    // In production, update backend
  },

  async addComment(tipId: string, comment: Omit<Comment, "id" | "createdAt">): Promise<Comment> {
    const newComment: Comment = {
      ...comment,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    return newComment;
  },

  // ─── Travel Groups ──────────────────────────────────────
  async getGroups(search?: string): Promise<TravelGroup[]> {
    const qp = search ? `?search=${encodeURIComponent(search)}` : "";
    try {
      return await api.get<TravelGroup[]>(`/community/groups${qp}`);
    } catch {
      return [];
    }
  },

  async createGroup(group: Omit<TravelGroup, "id" | "memberCount" | "createdAt">): Promise<TravelGroup> {
    try {
      return await api.post<TravelGroup>("/community/groups", group);
    } catch (error) {
      throw new Error((error as Error).message || "Failed to create group");
    }
  },

  async joinGroup(groupId: string): Promise<void> {
    // In production, update backend
  },

  // ─── Travel Memory Book ─────────────────────────────────
  async saveMemory(memory: {
    userId: string;
    tripName: string;
    destination: string;
    notes: string;
    rating: number;
    countriesVisited: string[];
    citiesVisited: string[];
    startDate: string;
    endDate: string;
  }): Promise<void> {
    await offlineDb.saveSetting({ id: `memory-${Date.now()}`, ...memory, createdAt: new Date().toISOString() });
  },

  async getMemories(userId: string) {
    try {
      const settings = await offlineDb.getSettings();
      return settings.filter((m: any) => m.userId === userId && String(m.id).startsWith("memory-"));
    } catch {
      return [];
    }
  },

  // ─── Digital Passport ───────────────────────────────────
  /**
   * `offlineDb.getSettings()` is untyped, so the stored branch inferred `{}`
   * and every field read off the result — xp, level, countryStamps — failed to
   * typecheck. Declaring the return type states the contract this function has
   * always had in practice.
   */
  async getPassport(userId: string): Promise<DigitalPassport & { updatedAt?: string }> {
    try {
      const settings = await offlineDb.getSettings();
      const passport = settings.find((s: any) => s.id === `passport-${userId}`);
      if (passport) return passport as DigitalPassport & { updatedAt?: string };
    } catch {
      // Fall through to default
    }
    return {
      userId,
      userName: "Explorer",
      level: 1,
      xp: 0,
      coins: 0,
      countryStamps: [],
      cityStamps: [],
      badges: ["first_login"],
      achievements: [],
      totalCountries: 0,
      totalCities: 0,
      totalDistanceKm: 0,
      totalTrips: 0,
    };
  },

  async awardXp(userId: string, xp: number): Promise<void> {
    const passport = await this.getPassport(userId);
    passport.xp += xp;
    passport.level = Math.floor(passport.xp / 500) + 1;
    await offlineDb.saveSetting({ id: `passport-${userId}`, ...passport, updatedAt: new Date().toISOString() });
  },

  async addStamp(userId: string, type: "country" | "city", name: string): Promise<void> {
    const passport = await this.getPassport(userId);
    if (type === "country") {
      if (!passport.countryStamps.includes(name)) {
        passport.countryStamps.push(name);
        passport.totalCountries = passport.countryStamps.length;
      }
    } else {
      if (!passport.cityStamps.includes(name)) {
        passport.cityStamps.push(name);
        passport.totalCities = passport.cityStamps.length;
      }
    }
    passport.updatedAt = new Date().toISOString();
    await offlineDb.saveSetting({ id: `passport-${userId}`, ...passport });
  },

  // ─── Travel Calendar ────────────────────────────────────
  getHolidays(country: string): Array<{ name: string; date: string; type: string }> {
    const holidays: Record<string, Array<{ name: string; date: string; type: string }>> = {
      PK: [
        { name: "Pakistan Day", date: "2026-03-23", type: "national" },
        { name: "Eid al-Fitr", date: "2026-03-31", type: "religious" },
        { name: "Eid al-Adha", date: "2026-06-07", type: "religious" },
        { name: "Independence Day", date: "2026-08-14", type: "national" },
        { name: "Iqbal Day", date: "2026-11-09", type: "national" },
      ],
    };
    return holidays[country] || [];
  },

  getTravelQuotes(): string[] {
    return [
      "The world is a book, and those who do not travel read only one page. — St. Augustine",
      "Not all those who wander are lost. — J.R.R. Tolkien",
      "Adventure is worthwhile in itself. — Amelia Earhart",
      "Travel is the only thing you buy that makes you richer.",
      "The journey not the arrival matters. — T.S. Eliot",
      "Life is either a daring adventure or nothing. — Helen Keller",
      "To travel is to discover that everyone is wrong about other countries. — Aldous Huxley",
    ];
  },
};
