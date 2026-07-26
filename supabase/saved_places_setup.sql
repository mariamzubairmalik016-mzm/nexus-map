-- ============================================================================
-- Nexus Map — saved places (Home / Work / University / custom)
-- Run this in the Supabase SQL editor. Safe to re-run.
--
-- Every row belongs to exactly one user and Row Level Security makes a user
-- able to read and write ONLY their own rows.
-- ============================================================================

create table if not exists public.saved_places (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,

  label         text not null,                       -- "Home", "Work", "Nani's house"
  category      text not null default 'custom'
                check (category in ('home', 'work', 'university', 'custom')),

  name          text not null,                       -- the place's own name
  address       text,
  latitude      double precision not null check (latitude between -90 and 90),
  longitude     double precision not null check (longitude between -180 and 180),

  notes         text,
  favorite      boolean not null default false,
  last_visited_at timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One "Home" (and one "Work", one "University") per user; custom places are
-- unconstrained.
create unique index if not exists saved_places_one_per_fixed_category
  on public.saved_places (user_id, category)
  where category in ('home', 'work', 'university');

create index if not exists saved_places_user_idx on public.saved_places (user_id, updated_at desc);

-- Keep updated_at honest — the sync layer resolves conflicts with it.
create or replace function public.touch_saved_places_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_places_touch_updated_at on public.saved_places;
create trigger saved_places_touch_updated_at
  before update on public.saved_places
  for each row execute function public.touch_saved_places_updated_at();

-- ---------------------------------------------------------------- RLS -------
alter table public.saved_places enable row level security;

drop policy if exists "saved_places_select_own" on public.saved_places;
create policy "saved_places_select_own"
  on public.saved_places for select
  using (auth.uid() = user_id);

drop policy if exists "saved_places_insert_own" on public.saved_places;
create policy "saved_places_insert_own"
  on public.saved_places for insert
  with check (auth.uid() = user_id);

drop policy if exists "saved_places_update_own" on public.saved_places;
create policy "saved_places_update_own"
  on public.saved_places for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "saved_places_delete_own" on public.saved_places;
create policy "saved_places_delete_own"
  on public.saved_places for delete
  using (auth.uid() = user_id);
