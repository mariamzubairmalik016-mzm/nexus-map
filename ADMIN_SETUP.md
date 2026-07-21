# Admin Setup — Nexus Map

Admin access is **database-driven**, never a hardcoded email or password. The
frontend only *displays* the role; every admin action is authorized by the
backend (`requireAuth` + `requireAdmin`) and by Supabase RLS via `is_admin()`.

## How the role system works
- `public.profiles.role` is one of `user | moderator | admin` (default `user`).
- A trigger (`protect_profile_role`) blocks users from changing their **own**
  role from the client — role changes require the SQL editor / service role.
- Backend: `src/middleware/auth.ts` sets `req.authUser.role`; `requireAdmin`
  returns **403** for non-admins. `AdminRoute.tsx` also redirects non-admins.

## Make yourself an admin (one time)
1. Run `supabase/profiles_auth_setup.sql`, then `supabase/road_alerts_setup.sql`,
   then `supabase/final_admin_setup.sql` in the Supabase SQL editor.
2. Find your UUID:
   ```sql
   select id, email from auth.users where email = 'YOU@EXAMPLE.COM';
   ```
3. Promote (paste your UUID):
   ```sql
   update public.profiles set role = 'admin' where id = 'YOUR-UUID';
   ```
4. Verify:
   ```sql
   select p.id, u.email, p.role from public.profiles p
     join auth.users u on u.id = p.id where p.role = 'admin';
   ```
5. Rollback if needed:
   ```sql
   update public.profiles set role = 'user' where id = 'YOUR-UUID';
   ```
6. Sign out and back in so the frontend reloads your profile, then open `/admin`.

## Security notes
- No service-role key is ever needed on the frontend or exposed to promote a user.
- Admins are identified by **UUID**, never by password.
