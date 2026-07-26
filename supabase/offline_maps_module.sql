begin;
create table if not exists public.offline_downloads (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 location_name text not null,
 scope text not null check(scope in('city','district','province','state','country')),
 estimated_size_mb integer not null check(estimated_size_mb>0),
 downloaded_size_mb integer not null default 0,
 status text not null default 'queued' check(status in('queued','downloading','paused','downloaded','failed','deleted')),
 progress integer not null default 0 check(progress between 0 and 100),
 places_count integer not null default 0,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists offline_downloads_user_idx on public.offline_downloads(user_id);
alter table public.offline_downloads enable row level security;
drop policy if exists "offline_downloads_select_own" on public.offline_downloads;
create policy "offline_downloads_select_own" on public.offline_downloads for select to authenticated using((select auth.uid())=user_id);
drop policy if exists "offline_downloads_insert_own" on public.offline_downloads;
create policy "offline_downloads_insert_own" on public.offline_downloads for insert to authenticated with check((select auth.uid())=user_id);
drop policy if exists "offline_downloads_update_own" on public.offline_downloads;
create policy "offline_downloads_update_own" on public.offline_downloads for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists "offline_downloads_delete_own" on public.offline_downloads;
create policy "offline_downloads_delete_own" on public.offline_downloads for delete to authenticated using((select auth.uid())=user_id);
grant select,insert,update,delete on public.offline_downloads to authenticated;
commit;
