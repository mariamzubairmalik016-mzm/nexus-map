import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  serial,
  varchar,
  doublePrecision,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

// --- NextAuth Core Tables ---

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  password: text("password"),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => ({
    compositePk: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  })
);

// --- Nexus Map Application Tables ---

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  email: varchar("email", { length: 255 }).unique().notNull(),
  avatarUrl: text("avatar_url"),
  phone: varchar("phone", { length: 50 }),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  bio: text("bio"),
  role: varchar("role", { length: 20 }).default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const savedPlaces = pgTable("saved_places", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  name: text("name").notNull(),
  address: text("address"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  category: varchar("category", { length: 50 }),
  notes: text("notes"),
  favorite: integer("favorite").default(0), // 0 or 1 for boolean
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const searchHistory = pgTable("search_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  query: text("query").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const favorites = pgTable("favorites", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  placeId: text("place_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const history = pgTable("history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  startName: text("start_name").notNull(),
  destinationName: text("destination_name").notNull(),
  distanceKm: doublePrecision("distance_km"),
  durationMinutes: doublePrecision("duration_minutes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const roadAlerts = pgTable("road_alerts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  description: text("description"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  upvotes: integer("upvotes").default(0).notNull(),
  downvotes: integer("downvotes").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const communityNotes = pgTable("community_notes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Tourism Ecosystem Tables ─────────────────────────────

export const tourismPOIs = pgTable("tourism_pois", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  description: text("description").notNull(),
  shortDescription: text("short_description"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  address: text("address"),
  city: varchar("city", { length: 100 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  countryIso2: varchar("country_iso2", { length: 2 }),
  imageUrl: text("image_url"),
  rating: doublePrecision("rating").default(0),
  reviewCount: integer("review_count").default(0),
  priceLevel: integer("price_level"),
  phone: varchar("phone", { length: 50 }),
  website: text("website"),
  openingHours: text("opening_hours"),
  isVerified: integer("is_verified").default(0),
  isFeatured: integer("is_featured").default(0),
  tags: text("tags"), // JSON array
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tourismReviews = pgTable("tourism_reviews", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  userName: text("user_name").notNull(),
  placeId: text("place_id").references(() => tourismPOIs.id, { onDelete: "cascade" }).notNull(),
  placeName: text("place_name").notNull(),
  rating: integer("rating").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  images: text("images"), // JSON array
  likes: integer("likes").default(0),
  helpfulCount: integer("helpful_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const communityTips = pgTable("community_tips", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  userName: text("user_name").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  imageUrl: text("image_url"),
  likes: integer("likes").default(0),
  bookmarks: integer("bookmarks").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const travelGroups = pgTable("travel_groups", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  coverImage: text("cover_image"),
  memberCount: integer("member_count").default(1),
  isPublic: integer("is_public").default(1),
  tags: text("tags"), // JSON array
  createdBy: text("created_by").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groupMembers = pgTable("group_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  groupId: text("group_id").references(() => travelGroups.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 20 }).default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

/**
 * Reactions — likes, bookmarks and "helpful" votes.
 *
 * `community_tips.likes` and `tourism_reviews.likes` are plain integer
 * counters with no record of *who* reacted, so nothing could tell whether the
 * current user had already liked something, un-liking was impossible, and one
 * account could increment a counter forever. One row per (user, target,
 * kind) makes the count derivable and the toggle honest.
 *
 * `targetId` is polymorphic (a tip or a review), so it carries no foreign key
 * — the pairing with `targetType` is what identifies the row. Deleting a tip
 * therefore leaves its reactions behind; they are filtered out by the join on
 * read, and a cleanup is cheap if it ever matters.
 */
export const communityReactions = pgTable(
  "community_reactions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    targetType: varchar("target_type", { length: 20 }).notNull(), // "tip" | "review"
    targetId: text("target_id").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull(), // "like" | "bookmark" | "helpful"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // The database, not the route handler, is what guarantees one reaction per
    // person: two concurrent taps would otherwise both pass an existence check.
    unique: uniqueIndex("community_reactions_unique_idx").on(
      table.targetType,
      table.targetId,
      table.userId,
      table.kind,
    ),
    byTarget: index("community_reactions_target_idx").on(table.targetType, table.targetId),
  }),
);

export const communityComments = pgTable(
  "community_comments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    targetType: varchar("target_type", { length: 20 }).notNull(),
    targetId: text("target_id").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    // Denormalised so a comment still renders if the display name changes,
    // matching what tips and reviews already do.
    userName: text("user_name").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    byTarget: index("community_comments_target_idx").on(table.targetType, table.targetId),
  }),
);

export const sosAlerts = pgTable("sos_alerts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  message: text("message"),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const emergencyContacts = pgTable("emergency_contacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  relationship: text("relationship"),
  isPrimary: integer("is_primary").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const travelMemories = pgTable("travel_memories", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tripName: text("trip_name").notNull(),
  destination: text("destination").notNull(),
  photos: text("photos"), // JSON array
  notes: text("notes"),
  rating: integer("rating"),
  distanceTravelledKm: doublePrecision("distance_travelled_km"),
  countriesVisited: text("countries_visited"), // JSON array
  citiesVisited: text("cities_visited"), // JSON array
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const digitalPassports = pgTable("digital_passports", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }).notNull(),
  userName: text("user_name").notNull(),
  level: integer("level").default(1),
  xp: integer("xp").default(0),
  coins: integer("coins").default(0),
  countryStamps: text("country_stamps"), // JSON array
  cityStamps: text("city_stamps"), // JSON array
  badges: text("badges"), // JSON array
  totalCountries: integer("total_countries").default(0),
  totalCities: integer("total_cities").default(0),
  totalDistanceKm: doublePrecision("total_distance_km").default(0),
  totalTrips: integer("total_trips").default(0),
  totalXp: integer("total_xp").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const savedRoutes = pgTable("saved_routes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  originName: text("origin_name").notNull(),
  destinationName: text("destination_name").notNull(),
  origin: text("origin"), // JSON stringified Coordinates
  destination: text("destination"), // JSON stringified Coordinates
  distanceMeters: doublePrecision("distance_meters"),
  durationSeconds: doublePrecision("duration_seconds"),
  geometry: text("geometry"), // JSON stringified coordinates
  instructions: text("instructions"), // JSON stringified RouteInstructions
  travelMode: varchar("travel_mode", { length: 50 }),
  routeType: varchar("route_type", { length: 50 }),
  avoidTolls: integer("avoid_tolls").default(0), // sqlite-like boolean mapping
  avoidFerries: integer("avoid_ferries").default(0),
  offlineAvailable: integer("offline_available").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const geoCities = pgTable("geo_cities", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  countryIso2: varchar("country_iso2", { length: 2 }).notNull(),
  regionCode: varchar("region_code", { length: 50 }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  cityType: varchar("city_type", { length: 50 }).notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  population: integer("population"),
  imageUrl: text("image_url"),
  description: text("description"),
  searchKeywords: text("search_keywords"),
  isFeatured: integer("is_featured").default(0), // boolean equivalent
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const geoLocationCategories = pgTable("geo_location_categories", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  iconName: varchar("icon_name", { length: 100 }),
  description: text("description"),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
