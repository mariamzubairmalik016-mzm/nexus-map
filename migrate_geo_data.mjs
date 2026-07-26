import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

async function fetchSupabase(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${table}: ${await res.text()}`);
  }
  return res.json();
}

async function migrateData() {
  console.log("Fetching categories from Supabase...");
  const categories = await fetchSupabase("geo_location_categories");

  console.log(`Found ${categories.length} categories. Inserting into Vercel Postgres...`);
  
  if (categories.length > 0) {
    for (const cat of categories) {
      await db.execute(`
        INSERT INTO geo_location_categories (id, name, slug, icon_name, description, is_active, created_at)
        VALUES (
          '${cat.id}', 
          '${cat.name.replace(/'/g, "''")}', 
          '${cat.slug}', 
          ${cat.icon_name ? `'${cat.icon_name}'` : 'NULL'}, 
          ${cat.description ? `'${cat.description.replace(/'/g, "''")}'` : 'NULL'}, 
          ${cat.is_active ? 1 : 0}, 
          '${cat.created_at}'
        )
        ON CONFLICT (id) DO NOTHING;
      `);
    }
  }

  console.log("Fetching cities from Supabase...");
  const cities = await fetchSupabase("geo_cities");

  console.log(`Found ${cities.length} cities. Inserting into Vercel Postgres...`);

  if (cities.length > 0) {
    for (const city of cities) {
      const keywordsStr = city.search_keywords ? JSON.stringify(city.search_keywords).replace(/'/g, "''") : '[]';

      await db.execute(`
        INSERT INTO geo_cities (
          id, country_iso2, region_code, name, slug, city_type, 
          latitude, longitude, population, image_url, description, 
          search_keywords, is_featured, is_active, created_at, updated_at
        ) VALUES (
          '${city.id}', 
          '${city.country_iso2}', 
          ${city.region_code ? `'${city.region_code}'` : 'NULL'}, 
          '${city.name.replace(/'/g, "''")}', 
          '${city.slug}', 
          '${city.city_type}', 
          ${city.latitude}, 
          ${city.longitude}, 
          ${city.population || 'NULL'}, 
          ${city.image_url ? `'${city.image_url}'` : 'NULL'}, 
          ${city.description ? `'${city.description.replace(/'/g, "''")}'` : 'NULL'}, 
          '${keywordsStr}', 
          ${city.is_featured ? 1 : 0}, 
          ${city.is_active ? 1 : 0}, 
          '${city.created_at}', 
          '${city.updated_at}'
        )
        ON CONFLICT (id) DO NOTHING;
      `);
    }
  }

  console.log("Migration complete!");
  process.exit(0);
}

migrateData().catch(console.error);
