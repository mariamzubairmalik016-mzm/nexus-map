-- ============================================================================
-- Nexus Map — FINAL ADMIN SETUP (run in the Supabase SQL editor, idempotent)
-- Prereq: profiles_auth_setup.sql and road_alerts_setup.sql already run.
-- Admin is DB-driven only (never a hardcoded email / password on the frontend).
-- ============================================================================

-- 1) Safety: ensure the role column + admin helper exist (no-op if already run).
alter table public.profiles
  add column if not exists role text not null default 'user';

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'profiles' and constraint_name = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('user','moderator','admin'));
  end if;
end $$;

create or replace function public.is_admin()
  returns boolean language sql security definer stable set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ----------------------------------------------------------------------------
-- 2) PROMOTE YOUR USER TO ADMIN
--    Step A — find your UUID (copy the id):
--        select id, email from auth.users where email = 'YOU@EXAMPLE.COM';
--    Step B — paste it below and run:
-- ----------------------------------------------------------------------------
-- update public.profiles set role = 'admin'
--   where id = 'PASTE-YOUR-AUTH-USER-UUID-HERE';

-- ----------------------------------------------------------------------------
-- 3) VERIFY the promotion worked:
-- ----------------------------------------------------------------------------
-- select p.id, u.email, p.role
--   from public.profiles p join auth.users u on u.id = p.id
--   where p.role in ('admin','moderator')
--   order by p.role;

-- ----------------------------------------------------------------------------
-- 4) ROLLBACK (demote back to a normal user):
-- ----------------------------------------------------------------------------
-- update public.profiles set role = 'user'
--   where id = 'PASTE-YOUR-AUTH-USER-UUID-HERE';

-- Note: the DB trigger `protect_profile_role` (from profiles_auth_setup.sql)
-- prevents users from escalating their own role via the client — role can only
-- be changed with the service role / SQL editor as above.
