# Database Setup — Nexus Map (Supabase)

Run these SQL files **in order** in the Supabase SQL editor. All are idempotent
(safe to re-run) and non-destructive.

| Order | File | Creates |
|---|---|---|
| 1 | `supabase/profiles_auth_setup.sql` | `profiles` table (role), RLS, auto-create trigger on signup, role-escalation guard |
| 2 | `supabase/road_alerts_setup.sql` | `road_alerts`, `road_alert_reports`, `admin_audit_log`, `is_admin()`, RLS, indexes |
| 3 | `supabase/final_admin_setup.sql` | Admin promotion + verification + rollback (see ADMIN_SETUP.md) |
| 4 | `supabase/geo_places_setup.sql` | `geo_cities`, `geo_location_categories`, trigram/GiST/keyword indexes, `location` sync trigger, public-read RLS |
| 5 | `supabase/geo_places_seed_pakistan.sql` | Karachi POI top-up — adds only missing rows (requires step 4) |
| — | `supabase/saved_places_setup.sql` | `saved_places` (Home/Work/University), per-user RLS |
| — | `supabase/favorites_geo_link_safe.sql` | `favorites` → `geo_cities` FK (run after 4; no-op until both exist) |
| — | `supabase/offline_maps_module.sql` | Offline map download table (optional) |

## Tables & policies (after 1–3)
- **profiles** — RLS: users read/update own row; role protected by trigger.
- **road_alerts** — public `SELECT`; authenticated `INSERT` (own reporter_id);
  `UPDATE`/`DELETE` restricted to `is_admin()`. Indexes on status, expires_at, geo.
- **road_alert_reports** — per-user confirm/resolve (unique per alert+user+action).
- **admin_audit_log** — admin-only `SELECT`; every admin action is logged.
- **geo_cities / geo_location_categories** — public reference data. RLS allows
  `SELECT` to `anon` and `authenticated` on active rows only; there is no
  insert/update/delete policy, so writes require the service-role key. This is
  the third search source, merged with TomTom and Geoapify by
  `backend/src/services/geoCatalog.service.ts`. Search still works worldwide
  without it — the catalogue supplements the providers, it never filters them.

  **These tables are already provisioned and populated on the current project**
  (~97 rows across 14 countries, RLS verified: anon read allowed, anon write
  rejected with `42501`). Steps 4 and 5 exist so a fresh project can be brought
  to the same state, and are written to be no-ops where that state already
  holds — step 4 never drops a column or replaces a working policy, and step 5
  only inserts rows whose `slug` is absent. Neither will overwrite curated data.

## Realtime
Enable Realtime for the `road_alerts` table (Supabase → Database → Replication)
to get live insert/update/resolve on the Map and Road Alerts pages. Until then
the app uses 30-second polling automatically (no code change needed).

## Environment variables
Frontend (`.env`, public):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`

Backend (`backend/.env`, secret — never `VITE_`):
- `TOMTOM_API_KEY` (required to boot), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `OPENAI_API_KEY` (optional), `OPENAI_MODEL` (optional), `PORT`, `NODE_ENV`, `FRONTEND_URL`

## Without the DB
The app still runs: Supabase-backed features degrade to the backend in-memory
store / demo data, clearly labeled. Run the SQL for full persistence + Realtime.
