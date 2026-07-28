/**
 * Seed eight road alerts.
 *
 * These are written as real rows in `road_alerts`, owned by a real user — not
 * a hardcoded array returned by the API. That distinction is the whole point:
 * every one of them can be confirmed, resolved, voted on, shown on the map and
 * deleted through the normal flow, because to the app they are ordinary
 * community reports.
 *
 * Coordinates are real points on real Karachi and Lahore roads, so they land
 * on the map where the road actually is.
 *
 *   node seed_road_alerts.mjs
 */

import { config } from "dotenv";
import pg from "pg";
import { randomUUID } from "crypto";

config({ path: ".env.local" });

const { Pool } = pg;

const ALERTS = [
  {
    type: "accident",
    severity: "high",
    description: "Two-car collision blocking the left lane near Karimabad flyover. Traffic backing up towards Water Pump.",
    latitude: 24.9180,
    longitude: 67.0631,
  },
  {
    type: "construction",
    severity: "medium",
    description: "Road resurfacing on Shahrah-e-Pakistan. One lane closed between Ancholi and Ayesha Manzil.",
    latitude: 24.9312,
    longitude: 67.0554,
  },
  {
    type: "congestion",
    severity: "high",
    description: "Heavy jam on Rashid Minhas Road towards Sohrab Goth. Expect 25-30 minute delays in the evening peak.",
    latitude: 24.9457,
    longitude: 67.1120,
  },
  {
    type: "waterlogging",
    severity: "critical",
    description: "Deep standing water under the Nazimabad underpass after last night's rain. Small cars should avoid.",
    latitude: 24.9098,
    longitude: 67.0342,
  },
  {
    type: "road_closure",
    severity: "high",
    description: "Shahrah-e-Faisal partially closed near FTC for a scheduled procession. Use Korangi Road as an alternative.",
    latitude: 24.8607,
    longitude: 67.0645,
  },
  {
    type: "pothole",
    severity: "low",
    description: "Cluster of deep potholes on University Road near NIPA chowrangi. Slow down in the right lane.",
    latitude: 24.9215,
    longitude: 67.0902,
  },
  {
    type: "construction",
    severity: "medium",
    description: "Metro bus track work on Ferozepur Road, Lahore. Single lane open past Kalma Chowk.",
    latitude: 31.5093,
    longitude: 74.3336,
  },
  {
    type: "congestion",
    severity: "medium",
    description: "Slow traffic on Canal Road, Lahore near Jail Road bridge. Roughly 15 minutes added.",
    latitude: 31.5310,
    longitude: 74.3405,
  },
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  // Own the alerts with a real account so foreign keys hold and the resolve
  // route's "did the reporter close this?" check behaves normally.
  const owner = await pool.query(`SELECT id, email FROM "user" ORDER BY email LIMIT 1`);
  if (owner.rows.length === 0) {
    console.error("No users exist yet — sign up first, then re-run this.");
    process.exit(1);
  }
  const userId = owner.rows[0].id;

  // Idempotent: re-running replaces the seeded set rather than duplicating it.
  const removed = await pool.query(
    `DELETE FROM road_alerts WHERE description = ANY($1::text[]) RETURNING id`,
    [ALERTS.map((a) => a.description)],
  );
  if (removed.rows.length > 0) console.log(`Removed ${removed.rows.length} previously seeded alerts.`);

  let inserted = 0;
  for (const [index, alert] of ALERTS.entries()) {
    // Stagger creation times over the last few hours so the list has a
    // realistic ordering instead of eight identical timestamps.
    const minutesAgo = (index + 1) * 37;
    // `id` is generated here, not by the database: the Drizzle schema declares
    // its default with `$defaultFn(crypto.randomUUID)`, which only applies to
    // inserts made through Drizzle. Raw SQL has to supply one.
    await pool.query(
      `INSERT INTO road_alerts
         (id, user_id, type, severity, description, latitude, longitude, status, upvotes, downvotes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,0, NOW() - ($9 || ' minutes')::interval)`,
      [
        randomUUID(),
        userId,
        alert.type,
        alert.severity,
        alert.description,
        alert.latitude,
        alert.longitude,
        Math.floor(Math.random() * 12) + 1,
        String(minutesAgo),
      ],
    );
    inserted += 1;
  }

  const total = await pool.query(`SELECT count(*)::int AS c FROM road_alerts WHERE status = 'active'`);
  console.log(`Seeded ${inserted} alerts for ${owner.rows[0].email}.`);
  console.log(`Active alerts in the database: ${total.rows[0].c}`);
} catch (error) {
  console.error("Seeding failed:", error.message);
  process.exit(1);
} finally {
  await pool.end();
}
