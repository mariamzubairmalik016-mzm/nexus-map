-- SAFE OPTIONAL LINK
-- Run only after geo_cities and favorites both exist.
-- This adds a foreign key only when one is not already present.

do $$
begin
  if to_regclass('public.favorites') is not null
     and to_regclass('public.geo_cities') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'favorites_place_id_geo_cities_fkey'
     )
  then
    alter table public.favorites
      add constraint favorites_place_id_geo_cities_fkey
      foreign key (place_id)
      references public.geo_cities(id)
      on delete cascade;
  end if;
end
$$;
