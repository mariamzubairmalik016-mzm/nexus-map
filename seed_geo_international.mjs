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
  console.log("Seeding international cities...");
  await db.execute(`
    INSERT INTO "geo_cities" (id, country_iso2, name, slug, city_type, latitude, longitude, description, search_keywords, is_featured, image_url) VALUES
    (gen_random_uuid(), 'AE', 'Dubai', 'dubai', 'city', 25.2048, 55.2708, 'Luxury waterfront and futuristic experiences.', 'dubai', 0, '/destinations/dubai.jpg'),
    (gen_random_uuid(), 'TR', 'Istanbul', 'istanbul', 'city', 41.0082, 28.9784, 'Asian and European history and culture.', 'istanbul', 0, '/destinations/istanbul.jpg'),
    (gen_random_uuid(), 'JP', 'Tokyo', 'tokyo', 'city', 35.6762, 139.6503, 'Technology, tradition and urban energy.', 'tokyo', 0, '/destinations/tokyo.jpg'),
    (gen_random_uuid(), 'FR', 'Paris', 'paris', 'city', 48.8566, 2.3522, 'Architecture, museums and cafés.', 'paris', 0, '/destinations/paris.jpg'),
    (gen_random_uuid(), 'ID', 'Bali', 'bali', 'town', -8.4095, 115.1889, 'Beaches, temples and forests.', 'bali', 0, '/destinations/bali.jpg')
    ON CONFLICT DO NOTHING;
  `);
  
  console.log("Seed complete.");
  process.exit(0);
}

seed().catch(console.error);
