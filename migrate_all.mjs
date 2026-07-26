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

async function fetchSupabase(endpoint, isAuth = false) {
  const url = isAuth ? `${SUPABASE_URL}/auth/v1/${endpoint}` : `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!res.ok) {
    console.warn(`Failed to fetch ${endpoint}: ${await res.text()}`);
    return [];
  }
  return res.json();
}

async function migrateData() {
  console.log("Fetching auth users from Supabase...");
  const authResponse = await fetchSupabase("admin/users", true);
  const users = authResponse.users || [];
  
  console.log(`Found ${users.length} users. Inserting into Vercel Postgres...`);
  for (const user of users) {
    const id = user.id;
    const email = user.email;
    const name = user.user_metadata?.name || user.user_metadata?.full_name || email;
    const emailVerified = user.email_confirmed_at ? `'${user.email_confirmed_at}'` : "NULL";
    const image = user.user_metadata?.avatar_url ? `'${user.user_metadata.avatar_url.replace(/'/g, "''")}'` : "NULL";
    
    await db.execute(`
      INSERT INTO "user" (id, name, email, "emailVerified", image)
      VALUES ('${id}', '${name.replace(/'/g, "''")}', '${email}', ${emailVerified}, ${image})
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  console.log("Fetching profiles from Supabase...");
  const profiles = await fetchSupabase("profiles?select=*");
  console.log(`Found ${profiles.length} profiles.`);
  for (const p of profiles) {
    await db.execute(`
      INSERT INTO profiles (id, full_name, email, avatar_url, phone, country, city, bio, role, created_at)
      VALUES (
        '${p.id}', 
        ${p.full_name ? `'${p.full_name.replace(/'/g, "''")}'` : "NULL"}, 
        '${p.email}', 
        ${p.avatar_url ? `'${p.avatar_url.replace(/'/g, "''")}'` : "NULL"}, 
        ${p.phone ? `'${p.phone.replace(/'/g, "''")}'` : "NULL"}, 
        ${p.country ? `'${p.country.replace(/'/g, "''")}'` : "NULL"}, 
        ${p.city ? `'${p.city.replace(/'/g, "''")}'` : "NULL"}, 
        ${p.bio ? `'${p.bio.replace(/'/g, "''")}'` : "NULL"}, 
        '${p.role || 'user'}', 
        '${p.created_at || new Date().toISOString()}'
      )
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  console.log("Fetching saved_places from Supabase...");
  const savedPlaces = await fetchSupabase("saved_places?select=*");
  console.log(`Found ${savedPlaces.length} saved_places.`);
  for (const sp of savedPlaces) {
    await db.execute(`
      INSERT INTO saved_places (id, user_id, label, name, address, latitude, longitude, category, notes, favorite, created_at, updated_at)
      VALUES (
        '${sp.id}', 
        '${sp.user_id}', 
        '${sp.label.replace(/'/g, "''")}', 
        '${sp.name.replace(/'/g, "''")}', 
        ${sp.address ? `'${sp.address.replace(/'/g, "''")}'` : "NULL"}, 
        ${sp.latitude}, 
        ${sp.longitude}, 
        ${sp.category ? `'${sp.category.replace(/'/g, "''")}'` : "NULL"}, 
        ${sp.notes ? `'${sp.notes.replace(/'/g, "''")}'` : "NULL"}, 
        ${sp.favorite ? 1 : 0}, 
        '${sp.created_at}', 
        '${sp.updated_at}'
      )
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  console.log("Fetching road_alerts from Supabase...");
  const roadAlerts = await fetchSupabase("road_alerts?select=*");
  console.log(`Found ${roadAlerts.length} road_alerts.`);
  for (const ra of roadAlerts) {
    await db.execute(`
      INSERT INTO road_alerts (id, user_id, type, severity, description, latitude, longitude, status, upvotes, downvotes, created_at)
      VALUES (
        '${ra.id}', 
        '${ra.user_id}', 
        '${ra.type.replace(/'/g, "''")}', 
        '${ra.severity.replace(/'/g, "''")}', 
        ${ra.description ? `'${ra.description.replace(/'/g, "''")}'` : "NULL"}, 
        ${ra.latitude}, 
        ${ra.longitude}, 
        '${ra.status || 'active'}', 
        ${ra.upvotes || 0}, 
        ${ra.downvotes || 0}, 
        '${ra.created_at}'
      )
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  console.log("Fetching tourism_pois from Supabase...");
  const tourismPois = await fetchSupabase("tourism_pois?select=*");
  console.log(`Found ${tourismPois.length} tourism_pois.`);
  for (const poi of tourismPois) {
    try {
      await db.execute(`
        INSERT INTO tourism_pois (
          id, name, category, description, short_description, 
          latitude, longitude, address, city, country, 
          country_iso2, image_url, rating, review_count, 
          price_level, phone, website, opening_hours, 
          is_verified, is_featured, tags, created_at, updated_at
        ) VALUES (
          '${poi.id}', 
          '${poi.name.replace(/'/g, "''")}', 
          '${poi.category.replace(/'/g, "''")}', 
          '${poi.description.replace(/'/g, "''")}', 
          ${poi.short_description ? `'${poi.short_description.replace(/'/g, "''")}'` : "NULL"}, 
          ${poi.latitude}, 
          ${poi.longitude}, 
          ${poi.address ? `'${poi.address.replace(/'/g, "''")}'` : "NULL"}, 
          '${poi.city.replace(/'/g, "''")}', 
          '${poi.country.replace(/'/g, "''")}', 
          ${poi.country_iso2 ? `'${poi.country_iso2.replace(/'/g, "''")}'` : "NULL"}, 
          ${poi.image_url ? `'${poi.image_url.replace(/'/g, "''")}'` : "NULL"}, 
          ${poi.rating || 0}, 
          ${poi.review_count || 0}, 
          ${poi.price_level || "NULL"}, 
          ${poi.phone ? `'${poi.phone.replace(/'/g, "''")}'` : "NULL"}, 
          ${poi.website ? `'${poi.website.replace(/'/g, "''")}'` : "NULL"}, 
          ${poi.opening_hours ? `'${poi.opening_hours.replace(/'/g, "''")}'` : "NULL"}, 
          ${poi.is_verified ? 1 : 0}, 
          ${poi.is_featured ? 1 : 0}, 
          ${poi.tags ? `'${typeof poi.tags === "string" ? poi.tags.replace(/'/g, "''") : JSON.stringify(poi.tags).replace(/'/g, "''")}'` : "NULL"}, 
          '${poi.created_at || new Date().toISOString()}', 
          '${poi.updated_at || new Date().toISOString()}'
        )
        ON CONFLICT (id) DO NOTHING;
      `);
    } catch (err) {
      console.warn(`Failed to insert POI ${poi.id}: ${err.message}`);
    }
  }

  console.log("All personal and tourism data migrated successfully!");
  process.exit(0);
}

migrateData().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
