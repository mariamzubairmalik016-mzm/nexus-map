import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pkg from "pg";
const { Client } = pkg;
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();
  const db = drizzle(client);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations applied successfully!");

  await client.end();
}

main().catch((err) => {
  console.error("Migration failed!", err);
  process.exit(1);
});
