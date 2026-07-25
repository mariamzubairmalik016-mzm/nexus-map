import { pgTable, serial, text, timestamp, varchar, boolean, jsonb, doublePrecision } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(), // Matches Clerk user ID
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
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => profiles.id).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  address: text("address").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  category: varchar("category", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const searchHistory = pgTable("search_history", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => profiles.id).notNull(),
  query: text("query").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
