-- ============================================================================
-- Nexus Map — geo places catalogue (`geo_cities` + `geo_location_categories`)
-- Run this in the Supabase SQL editor. Safe to re-run. NON-DESTRUCTIVE.
--
-- This is the project's own curated place catalogue. It is the third search
-- source, merged with TomTom and Geoapify by the backend
-- (backend/src/services/geoCatalog.service.ts) and read directly by the
-- Explore page (src/services/geoService.ts).
--
-- The column list here is exactly what those two consumers select — changing a
-- name here breaks their `.select(...)` string.
--
-- IMPORTANT: on an existing project these tables are ALREADY POPULATED. This
-- file is written to bring a fresh project up to that same shape and to add
-- anything missing on an existing one. It never drops a column, never deletes
-- a row, and never replaces an RLS policy that already works.
--
-- Access model: PUBLIC REFERENCE DATA. Everyone reads it; nobody writes it
-- through the anon or authenticated roles. Writes use the service-role key,
-- which bypasses RLS.
-- ============================================================================

begin;

-- Trigram indexes make the `name ilike %q%` / `slug ilike %q%` search in both
-- consumers use an index instead of a sequential scan. The extension is
-- available on Supabase; guarded so a restricted role can still run the file.
do $$
begin
  create extension if not exists pg_trgm with schema extensions;
exception
  when insufficient_privilege or undefined_file then
    raise notice 'pg_trgm unavailable — catalogue search falls back to a sequential scan';
end
$$;

-- ------------------------------------------------------------ categories ----
create table if not exists public.geo_location_categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  icon_name    text,
  description  text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- cities ----
-- `id` is uuid because favorites.place_id references it
-- (see favorites_geo_link_safe.sql).
--
-- `location` (PostGIS point) is NOT created here — it is added further down,
-- only when PostGIS is available, so this file still works without it.
create table if not exists public.geo_cities (
  id              uuid primary key default gen_random_uuid(),

  country_iso2    text not null check (char_length(country_iso2) = 2),
  region_code     text,                                 -- 'SD', 'PB', 'KP', ...
  name            text not null,
  slug            text not null,
  city_type       text not null default 'city',

  latitude        double precision not null check (latitude between -90 and 90),
  longitude       double precision not null check (longitude between -180 and 180),

  population      integer check (population is null or population >= 0),
  image_url       text,
  description     text,
  -- Extra terms the place should match on ("AKUH", "Aga Khan Hospital").
  search_keywords text[] not null default '{}',

  is_featured     boolean not null default false,
  is_active       boolean not null default true,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Bring an older/partial table up to the full shape. Each is a no-op when the
-- column is already there, so this is safe on the populated production table.
alter table public.geo_cities add column if not exists region_code     text;
alter table public.geo_cities add column if not exists population      integer;
alter table public.geo_cities add column if not exists image_url       text;
alter table public.geo_cities add column if not exists description     text;
alter table public.geo_cities add column if not exists search_keywords text[] not null default '{}';
alter table public.geo_cities add column if not exists is_featured     boolean not null default false;
alter table public.geo_cities add column if not exists is_active       boolean not null default true;
alter table public.geo_cities add column if not exists created_at      timestamptz not null default now();
alter table public.geo_cities add column if not exists updated_at      timestamptz not null default now();

-- city_type is a closed set. Added as a named constraint so re-running is a
-- no-op, and NOT VALID so existing rows are never re-checked (any legacy value
-- already in the table keeps working; only new writes are constrained).
do $$
begin
  alter table public.geo_cities
    add constraint geo_cities_city_type_check
    check (city_type in ('capital', 'city', 'town', 'village', 'locality', 'landmark'))
    not valid;
exception
  when duplicate_object then null;
end
$$;

-- Null Island is always bad data, never a real place. Mirrors isValidLatLng()
-- in backend/src/types/place.ts, so the catalogue can never be the source of a
-- coordinate the normalizer would reject. NOT VALID for the same reason above.
do $$
begin
  alter table public.geo_cities
    add constraint geo_cities_not_null_island
    check (not (latitude = 0 and longitude = 0))
    not valid;
exception
  when duplicate_object then null;
end
$$;

-- --------------------------------------------------------- PostGIS point ----
-- The production table carries a `location` point alongside lat/lng. Add it
-- when PostGIS is installed, and keep it in step with lat/lng via a trigger so
-- inserts only ever have to supply the two numbers.
do $$
declare
  gis_schema text;
begin
  select n.nspname
    into gis_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'postgis';

  if gis_schema is null then
    raise notice 'PostGIS not installed — skipping geo_cities.location';
    return;
  end if;

  if not exists (
    select 1 from pg_attribute
     where attrelid = 'public.geo_cities'::regclass
       and attname = 'location'
       and not attisdropped
  ) then
    execute format(
      'alter table public.geo_cities add column location %I.geography(Point, 4326)', gis_schema);
  end if;
end
$$;

-- Derives `location` from latitude/longitude on every insert and whenever the
-- coordinates change. Written with dynamic SQL and an explicit text cast so it
-- works whether the column ended up geography or geometry.
do $$
declare
  loc_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into loc_type
    from pg_attribute a
   where a.attrelid = 'public.geo_cities'::regclass
     and a.attname = 'location'
     and not a.attisdropped;

  if loc_type is null then
    return;
  end if;

  execute format($fn$
    create or replace function public.geo_cities_sync_location()
    returns trigger
    language plpgsql
    as $body$
    begin
      new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::%s;
      return new;
    end;
    $body$;
  $fn$, loc_type);

  drop trigger if exists geo_cities_sync_location on public.geo_cities;
  create trigger geo_cities_sync_location
    before insert or update of latitude, longitude on public.geo_cities
    for each row execute function public.geo_cities_sync_location();
end
$$;

-- --------------------------------------------------------------- indexes ----
-- Slug is the natural key every upsert targets, so it must be unique. Verified
-- duplicate-free on the production table before this was added; if a duplicate
-- is ever introduced this statement fails loudly rather than silently skipping.
create unique index if not exists geo_cities_slug_key
  on public.geo_cities (slug);

-- Both consumers filter `is_active = true` and order by `is_featured desc`.
create index if not exists geo_cities_active_featured_idx
  on public.geo_cities (is_featured desc, name)
  where is_active;

create index if not exists geo_cities_country_idx
  on public.geo_cities (country_iso2)
  where is_active;

create index if not exists geo_cities_city_type_idx
  on public.geo_cities (city_type)
  where is_active;

-- Bounding-box lookups (map viewport / "near me" queries).
create index if not exists geo_cities_lat_lng_idx
  on public.geo_cities (latitude, longitude);

create index if not exists geo_cities_keywords_idx
  on public.geo_cities using gin (search_keywords);

-- Substring search. Created only when pg_trgm actually loaded. The operator
-- class is schema-qualified from pg_extension rather than assumed to be in
-- `extensions` — an existing install may sit in `public` instead.
do $$
declare
  trgm_schema text;
begin
  select n.nspname
    into trgm_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';

  if trgm_schema is null then
    return;
  end if;

  execute format(
    'create index if not exists geo_cities_name_trgm_idx
       on public.geo_cities using gin (name %I.gin_trgm_ops)', trgm_schema);
  execute format(
    'create index if not exists geo_cities_slug_trgm_idx
       on public.geo_cities using gin (slug %I.gin_trgm_ops)', trgm_schema);
end
$$;

-- Spatial index, only if the PostGIS column exists.
do $$
begin
  if exists (
    select 1 from pg_attribute
     where attrelid = 'public.geo_cities'::regclass
       and attname = 'location'
       and not attisdropped
  ) then
    create index if not exists geo_cities_location_idx
      on public.geo_cities using gist (location);
  end if;
end
$$;

-- ------------------------------------------------------------ updated_at ----
create or replace function public.touch_geo_cities_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists geo_cities_touch_updated_at on public.geo_cities;
create trigger geo_cities_touch_updated_at
  before update on public.geo_cities
  for each row execute function public.touch_geo_cities_updated_at();

-- ------------------------------------------------------------------ RLS -----
-- Public reference data: readable by everyone (including signed-out visitors on
-- the Explore page), writable only by the service-role key, which bypasses RLS.
-- No insert/update/delete policy is created, so anon and authenticated cannot
-- write.
--
-- A policy is only created when the table has no SELECT policy yet. On a
-- project that already has working policies this section does nothing, rather
-- than dropping and recreating them under a different name.
alter table public.geo_cities             enable row level security;
alter table public.geo_location_categories enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'geo_cities' and cmd = 'SELECT'
  ) then
    create policy "geo_cities_read_active"
      on public.geo_cities for select
      to anon, authenticated
      using (is_active);
  else
    raise notice 'geo_cities already has a SELECT policy — left untouched';
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'geo_location_categories' and cmd = 'SELECT'
  ) then
    create policy "geo_location_categories_read_active"
      on public.geo_location_categories for select
      to anon, authenticated
      using (is_active);
  else
    raise notice 'geo_location_categories already has a SELECT policy — left untouched';
  end if;
end
$$;

grant select on public.geo_cities             to anon, authenticated;
grant select on public.geo_location_categories to anon, authenticated;

commit;
