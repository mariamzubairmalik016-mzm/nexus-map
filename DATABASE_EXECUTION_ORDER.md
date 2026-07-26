# Database Execution Order — Nexus Map (Supabase)

Run these in the **Supabase SQL editor**, in the order below. Every file is
idempotent and non-destructive: safe to re-run, and none of them delete data.

> **Nothing in this audit was executed against your database.** These are for
> you to run. If a future change ever requires a destructive operation, it will
> be flagged and explained rather than run silently.

---

## Execution order

| # | File | Creates / does | Depends on |
|---|---|---|---|
| 1 | `supabase/profiles_auth_setup.sql` | `profiles` table, RLS, auto-create trigger on signup, role-escalation guard | `auth.users` (built in) |
| 2 | `supabase/road_alerts_setup.sql` | `road_alerts`, `road_alert_reports`, `admin_audit_log`, `is_admin()`, RLS, indexes | 1 |
| 3 | `supabase/final_admin_setup.sql` | Admin promotion, verification, rollback (see `ADMIN_SETUP.md`) | 1, 2 |
| 4 | `supabase/geo_places_setup.sql` | `geo_cities`, `geo_location_categories`, trigram/GiST/keyword indexes, PostGIS `location` sync trigger, public-read RLS | — |
| 5 | `supabase/geo_places_seed_pakistan.sql` | Karachi POI top-up — inserts **only** rows whose `slug` is absent | **4** |
| — | `supabase/saved_places_setup.sql` | `saved_places` (Home / Work / University), per-user RLS | 1 |
| — | `supabase/offline_maps_module.sql` | `offline_downloads` table (optional) | 1 |
| — | `supabase/favorites_geo_link_safe.sql` | Adds `favorites.place_id → geo_cities.id` FK | 4 + a `favorites` table |

Steps 1–3 are the core. 4–5 power the catalogue search source. The unnumbered
files are optional modules — run them when you want those features persisted.

---

## Verified state of the live project

Checked directly against your Supabase instance during the audit:

- `geo_cities` — **exists, 97 rows across 14 countries** (~60 Pakistani), with
  curated `image_url` / `search_keywords` and a PostGIS `location` column
- `geo_location_categories` — exists, 12 rows
- `favorites` — exists · `saved_places` — exists (0 rows)
- **RLS verified working**: anon `SELECT` allowed on active rows; anon `INSERT`
  correctly rejected with `42501`
- `slug` is duplicate-free, so the unique index and every `ON CONFLICT (slug)`
  are sound

**Because the catalogue is already populated, steps 4–5 are effectively
no-ops on this project.** They exist so a fresh environment reaches the same
state. Step 4 never drops a column and never replaces a working RLS policy;
step 5 only inserts absent slugs. Neither overwrites curated data.

---

## Integrity checks performed

| Check | Result |
|---|---|
| `ON CONFLICT` targets backed by a real unique constraint | ✅ `geo_location_categories.slug` UNIQUE · `geo_cities_slug_key` · `profiles.id` PK |
| Execution order (unique index created before the seed uses it) | ✅ step 4 before step 5 |
| Missing extensions | ✅ `pg_trgm` guarded; PostGIS detected dynamically, skipped cleanly if absent |
| Operator-class schema assumption | ✅ resolved from `pg_extension`, not hardcoded to `extensions` |
| PG-version-specific syntax | ✅ no underscore numeric literals (PG16-only) |
| Constraints validated against existing rows | ✅ added `NOT VALID` so legacy rows are never retro-rejected |
| RLS present on every user-data table | ✅ profiles, saved_places, road_alerts, offline_downloads, geo_* |
| Overly permissive policies | ✅ none — catalogue is read-only to anon/authenticated; writes need service-role |

---

## If a seed row conflicts

Before adding to `geo_places_seed_pakistan.sql`, confirm the place is genuinely
missing — adding one that already exists under a different slug creates a
near-duplicate in search results, which is worse than omitting it:

```sql
select slug, name from public.geo_cities where name ilike '%dolmen%';
```

## Verify after running

```sql
select slug, name, city_type, latitude, longitude
  from public.geo_cities
 where city_type = 'landmark' and country_iso2 = 'PK'
 order by name;
```
