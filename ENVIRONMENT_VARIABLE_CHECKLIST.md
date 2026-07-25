# Environment Variable Checklist — Nexus Map

Two separate files. **Never** put a backend secret in the frontend file: every
`VITE_`-prefixed value is compiled into the browser bundle and is publicly
readable.

Both real files (`.env`, `backend/.env`) are gitignored. Only the
`.env.example` files are tracked, and they must contain **placeholders only**.

---

## Frontend — `.env` (project root)

| Variable | Required | Purpose | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Yes, for auth | Supabase project URL | Public. Without it, auth is disabled and the app runs signed-out. |
| `VITE_SUPABASE_ANON_KEY` | Yes, for auth | Supabase anon/publishable key | **Public by design** — safe in the bundle. RLS is what protects data. |
| `VITE_API_URL` | Optional | Backend API root, including `/api` | Legacy name; takes precedence if set. |
| `VITE_API_BASE_URL` | Optional | Backend host root, **without** `/api` | Preferred name. Defaults to `http://localhost:5000`. |
| `VITE_MAP_PROVIDER` | Optional | `osm` (default) or `tomtom` | `tomtom` routes tiles through the backend proxy, keeping the key server-side. |
| `VITE_MAP_DEFAULT_LAT` | Optional | Fallback map latitude | Defaults to `30.3753`. |
| `VITE_MAP_DEFAULT_LNG` | Optional | Fallback map longitude | Defaults to `69.3451`. |
| `VITE_MAP_DEFAULT_ZOOM` | Optional | Fallback zoom | Defaults to `5`. |

> The default centre is a **fallback only**. Real GPS always wins when the user
> grants permission; the saved last-view wins over the configured default.

### Current state (verified)
`VITE_SUPABASE_URL` ✅ · `VITE_SUPABASE_ANON_KEY` ✅ (208 chars) ·
`VITE_API_URL` ✅

---

## Backend — `backend/.env`

Validated by zod at startup (`backend/src/config/env.ts`). The server **refuses
to boot** without `TOMTOM_API_KEY`.

| Variable | Required | Purpose | Notes |
|---|---|---|---|
| `TOMTOM_API_KEY` | **Yes (min 10 chars)** | Search, routing, traffic, tile proxy | Server refuses to start without it. |
| `PORT` | Optional | Server port | Defaults to `5000`. |
| `NODE_ENV` | Optional | `development` \| `test` \| `production` | Defaults to `development`. |
| `FRONTEND_URL` | Optional | **CORS allow-origin** | Defaults to `http://localhost:5173`. See warning below. |
| `SUPABASE_URL` | Optional | Supabase project URL | Without it the backend uses an in-memory store. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | **SECRET** — full DB access, bypasses RLS | Backend only. Must **never** appear in a `VITE_` variable or any frontend file. |
| `GEOAPIFY_API_KEY` | Optional | Supplementary POI geocoder | Search still works without it. |
| `OPENAI_API_KEY` | Optional | AI planner / chat | Falls back to a deterministic rule-based plan. |
| `OPENAI_MODEL` | Optional | Model override | e.g. `gpt-4o-mini`. |

### Current state (verified)
All 8 present: `PORT`, `NODE_ENV`, `FRONTEND_URL`, `TOMTOM_API_KEY`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`,
`GEOAPIFY_API_KEY`. (`OPENAI_MODEL` absent — optional.)

---

## ⚠️ CORS gotcha (cost real debugging time)

`FRONTEND_URL` is the **only** allowed CORS origin. It defaults to
`http://localhost:5173`.

If port 5173 is occupied, Vite silently falls through to 5174/5175/5176 — and
then **every API call fails**. The service worker converts the CORS failure into
a `503`, so the UI reports *"Search is unavailable right now"*, which looks like
a backend outage but is not.

**If search suddenly stops working, check the port in the Vite banner first.**
Either free 5173, or set `FRONTEND_URL` to match the actual port.

---

## Security rules

1. Never prefix a secret with `VITE_`.
2. The **anon** key is public and belongs in the frontend; the **service-role**
   key is secret and belongs only in `backend/.env`.
3. Keep `.env.example` files as placeholders only — verified clean.
4. If a real key ever lands in a tracked file, **rotate it**; removing the file
   is not sufficient once it has been committed or pushed.
