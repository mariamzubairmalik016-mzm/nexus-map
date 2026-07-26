import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

export let db: NodePgDatabase<typeof schema>;

if (databaseUrl) {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  db = drizzle(pool, { schema });
} else {
  // No DATABASE_URL configured — return a mock db for build/development
  // that throws at runtime if any route tries to use it without a DB.
  db = drizzle({} as any, { schema });
  console.warn("⚠️ DATABASE_URL not set — database features will be unavailable.");
}
