-- ============================================================================
-- Nexus Map — Pakistan catalogue top-up
-- Run AFTER supabase/geo_places_setup.sql. Safe to re-run.
--
-- SCOPE — read before extending this file.
-- The catalogue is NOT empty. A live project already holds ~97 curated rows
-- across 14 countries, including ~60 Pakistani cities and localities
-- (karachi, lahore, clifton-karachi, north-nazimabad, murree, ...) with
-- hand-set image_url and search_keywords.
--
-- So this file does NOT re-seed cities. It adds only the Karachi POIs that were
-- confirmed absent from the catalogue, and every row is `on conflict (slug) do
-- nothing` — curated data is never overwritten.
--
-- Before adding a row here, check the place is really missing:
--     select slug, name from public.geo_cities where name ilike '%dolmen%';
-- Adding a place that already exists under a different slug creates a
-- near-duplicate in search results, which is worse than leaving it out.
--
-- Worldwide search is unaffected either way — the catalogue supplements TomTom
-- and Geoapify, it never filters them. These POIs are already reachable through
-- the providers; seeding them makes them resolve instantly and keeps them
-- available to the Explore page.
--
-- Coordinates are the values the live providers return for these POIs, not
-- hand-estimated ones.
--
-- `location` (PostGIS) is filled automatically by the geo_cities_sync_location
-- trigger created in geo_places_setup.sql — that is why this file only supplies
-- latitude/longitude. Run the setup file first.
-- ============================================================================

begin;

-- ------------------------------------------------------------ categories ----
-- Slugs must stay in step with CATEGORY_MAP in src/services/geoService.ts.
-- `do nothing`: the live project already has 12 curated categories.
insert into public.geo_location_categories (name, slug, icon_name, description)
values
  ('Nature',    'nature',    'mountain',  'Mountains, valleys, lakes, parks and natural attractions'),
  ('Cities',    'cities',    'building2', 'Major urban centres and capitals'),
  ('Heritage',  'heritage',  'landmark',  'Forts, ruins and World Heritage sites'),
  ('Religious', 'religious', 'moon',      'Mosques, shrines and pilgrimage sites'),
  ('Adventure', 'adventure', 'compass',   'Trekking, mountains and high passes')
on conflict (slug) do nothing;

-- ------------------------------------------------- Karachi POIs (missing) ---
insert into public.geo_cities
  (country_iso2, region_code, name, slug, city_type, latitude, longitude,
   description, search_keywords, is_featured)
values
  ('PK', 'SD', 'LuckyOne Mall', 'luckyone-mall-karachi', 'landmark',
   24.9322928, 67.0870913,
   'Large shopping mall on Rashid Minhas Road, Gulberg Town, Karachi.',
   array['lucky one mall', 'lucky one', 'luckyone', 'luckyone karachi',
         'lucky one mall karachi'], true),

  ('PK', 'SD', 'Dolmen Mall Clifton', 'dolmen-mall-clifton', 'landmark',
   24.8022000, 67.0293000,
   'Seafront shopping mall at Clifton Block 4, Karachi.',
   array['dolmen mall', 'dolmen clifton', 'dolmen mall karachi', 'dolmen'], true),

  ('PK', 'SD', 'Aga Khan University Hospital', 'aga-khan-university-hospital', 'landmark',
   24.8927752, 67.0740719,
   'Teaching hospital on Stadium Road, Karachi.',
   array['akuh', 'aga khan hospital', 'agha khan hospital',
         'aga khan university', 'aku'], true),

  ('PK', 'SD', 'NED University of Engineering and Technology', 'ned-university-karachi', 'landmark',
   24.9331000, 67.1138000,
   'Engineering university on University Road, Karachi.',
   array['ned university', 'ned uet', 'ned karachi', 'ned'], true),

  ('PK', 'SD', 'Aptech Learning North Nazimabad', 'aptech-learning-north-nazimabad', 'landmark',
   24.9390109, 67.0448785,
   'Aptech computer training centre, North Nazimabad, Karachi.',
   array['aptech north nazimabad', 'aptech learning', 'aptech karachi', 'aptech'], false)

on conflict (slug) do nothing;

commit;

-- Verify:
--   select slug, name, city_type, latitude, longitude
--     from public.geo_cities
--    where city_type = 'landmark' and country_iso2 = 'PK'
--    order by name;
