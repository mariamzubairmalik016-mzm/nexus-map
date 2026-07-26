import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

async function seed() {
  console.log("Seeding categories...");
  await db.execute(`
    INSERT INTO "geo_location_categories" (id, name, slug, icon_name, description) VALUES
    (gen_random_uuid(), 'Nature', 'nature', 'mountain', 'Mountains, valleys, lakes, parks and natural attractions'),
    (gen_random_uuid(), 'Cities', 'cities', 'building2', 'Major urban centres and capitals'),
    (gen_random_uuid(), 'Heritage', 'heritage', 'landmark', 'Forts, ruins and World Heritage sites'),
    (gen_random_uuid(), 'Religious', 'religious', 'moon', 'Mosques, shrines and pilgrimage sites'),
    (gen_random_uuid(), 'Adventure', 'adventure', 'compass', 'Trekking, mountains and high passes')
    ON CONFLICT DO NOTHING;
  `);

  console.log("Seeding cities...");
  await db.execute(`
    INSERT INTO "geo_cities" (id, country_iso2, name, slug, city_type, latitude, longitude, description, search_keywords, is_featured) VALUES
    (gen_random_uuid(), 'PK', 'Lahore', 'lahore', 'city', 31.5204, 74.3587, 'Cultural heart of Pakistan', 'lahore, lhr', 1),
    (gen_random_uuid(), 'PK', 'Karachi', 'karachi', 'city', 24.8607, 67.0011, 'City of lights', 'karachi, khi', 1),
    (gen_random_uuid(), 'PK', 'Islamabad', 'islamabad', 'capital', 33.6844, 73.0479, 'The beautiful capital', 'islamabad, isb', 1),
    (gen_random_uuid(), 'PK', 'Hunza', 'hunza', 'town', 36.3167, 74.65, 'Mountain paradise', 'hunza valley', 1),
    (gen_random_uuid(), 'PK', 'Skardu', 'skardu', 'town', 35.2971, 75.6333, 'Gateway to K2', 'skardu', 1)
    ON CONFLICT DO NOTHING;
  `);
  
  console.log("Seed complete.");
  process.exit(0);
}

seed().catch(console.error);
