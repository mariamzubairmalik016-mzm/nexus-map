-- ============================================================================
-- Nexus Map — Road Alerts + Admin audit log
-- Run once in the Supabase SQL editor (safe to re-run). Requires the profiles
-- table from profiles_auth_setup.sql (for the admin role).
-- ============================================================================

-- Helper: is the current auth user an admin? (used by RLS policies)
create or replace function public.is_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- --- Road alerts -----------------------------------------------------------
create table if not exists public.road_alerts (
  id                uuid primary key default gen_random_uuid(),
  type              text not null,
  title             text not null,
  description       text not null,
  latitude          double precision not null,
  longitude         double precision not null,
  location          text,
  severity          text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status            text not null default 'monitoring' check (status in ('active','monitoring','resolved')),
  source            text not null default 'community' check (source in ('api','admin','community','cached','demo')),
  reporter_id       uuid references auth.users (id) on delete set null,
  verification_count integer not null default 0,
  report_count      integer not null default 0,
  image_url         text,
  estimated_delay_minutes integer,
  alternate_route   text,
  is_verified       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  expires_at        timestamptz not null default (now() + interval '12 hours')
);

create index if not exists road_alerts_status_idx  on public.road_alerts (status);
create index if not exists road_alerts_expires_idx on public.road_alerts (expires_at);
create index if not exists road_alerts_geo_idx     on public.road_alerts (latitude, longitude);

alter table public.road_alerts enable row level security;

-- Everyone can read alerts (public map data).
drop policy if exists "road_alerts_select_all" on public.road_alerts;
create policy "road_alerts_select_all" on public.road_alerts for select using (true);

-- Authenticated users may create an alert they own.
drop policy if exists "road_alerts_insert_own" on public.road_alerts;
create policy "road_alerts_insert_own" on public.road_alerts for insert
  with check (auth.uid() = reporter_id);

-- Only admins may update/delete directly (the backend also uses the service role).
drop policy if exists "road_alerts_admin_update" on public.road_alerts;
create policy "road_alerts_admin_update" on public.road_alerts for update using (public.is_admin());
drop policy if exists "road_alerts_admin_delete" on public.road_alerts;
create policy "road_alerts_admin_delete" on public.road_alerts for delete using (public.is_admin());

-- --- Per-user confirmations/reports (prevents duplicate votes) --------------
create table if not exists public.road_alert_reports (
  id         uuid primary key default gen_random_uuid(),
  alert_id   uuid not null references public.road_alerts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  action     text not null check (action in ('confirm','still_active','resolved','abuse')),
  created_at timestamptz not null default now(),
  unique (alert_id, user_id, action)
);
alter table public.road_alert_reports enable row level security;
drop policy if exists "alert_reports_insert_own" on public.road_alert_reports;
create policy "alert_reports_insert_own" on public.road_alert_reports for insert
  with check (auth.uid() = user_id);
drop policy if exists "alert_reports_select_own" on public.road_alert_reports;
create policy "alert_reports_select_own" on public.road_alert_reports for select
  using (auth.uid() = user_id or public.is_admin());

-- --- Admin audit log -------------------------------------------------------
create table if not exists public.admin_audit_log (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid references auth.users (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  notes      text,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
drop policy if exists "audit_admin_only" on public.admin_audit_log;
create policy "audit_admin_only" on public.admin_audit_log for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- MAKE YOUR USER AN ADMIN
-- 1) Find your UUID:  select id, email from auth.users where email = 'YOU@EXAMPLE.COM';
-- 2) Promote (paste your UUID):
--      update public.profiles set role = 'admin' where id = 'PASTE-YOUR-AUTH-UUID-HERE';
-- Never share or expose the service-role key to do this.
-- ---------------------------------------------------------------------------
