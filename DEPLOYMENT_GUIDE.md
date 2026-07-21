# Deployment Guide — Nexus Map

Two deployables: the **frontend** (static SPA + PWA) and the **backend** (Node/Express API).

## Before deploying (required)
1. **Rotate secrets.** The TomTom, Supabase service-role, and OpenAI keys were
   present in example/template files during development — rotate them and put the
   new values only in real env files / host secret managers.
2. Sanitize `backend/.env.example` and `*.env.template` to placeholders only.
3. Run the Supabase SQL (`DATABASE_SETUP.md`) and grant admin (`ADMIN_SETUP.md`).

## Frontend (static host: Vercel / Netlify / Cloudflare Pages)
- Build command: `npm run build` → output `dist/`
- SPA fallback: rewrite all routes to `/index.html` (required for deep-link refresh)
- Env (build-time, public): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_API_URL` (**set to the deployed backend URL** — not localhost)
- Serve `manifest.webmanifest`, `offline-sw.js`, `pwa-icon.svg` from the root
  (already in `public/`).

## Backend (Node host: Render / Railway / Fly / a VM)
- Build: `cd backend && npm run build`
- Start: `node dist/server.js` (or `npm start`)
- Env (secret): `TOMTOM_API_KEY` (required), `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` (optional), `PORT`, `NODE_ENV=production`,
  `FRONTEND_URL=https://your-frontend-domain` (drives CORS)
- The server **refuses to start** without a valid `TOMTOM_API_KEY`.

## Supabase
- Add the deployed frontend URL to **Auth → URL Configuration → Redirect URLs**
  (`/login`, `/reset-password`).
- Enable Realtime replication on `road_alerts` for live updates.
- Keep RLS enabled on all browser-accessed tables.

## Post-deploy checks
- `GET https://api-domain/health` → 200
- Frontend loads; deep-link refresh works (SPA fallback)
- Login → Dashboard; admin user can reach `/admin`
- Road Alerts page loads (live/community/demo labels correct)
- PWA installable; offline mode serves cached data

## Notes / limitations
- The backend uses an in-memory store for some collections (reports, favorites,
  history, offline jobs) — for multi-instance/durable deployments, back these
  with Supabase tables. Road alerts already prefer Supabase when the table exists.
