# Nexus Map

Worldwide navigation and travel app: live GPS routing, offline map regions,
data-grounded trip planning, and community road alerts.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind v4**, Framer Motion
- **NextAuth v4** — email/password and Google
- **Drizzle ORM → Postgres** (Neon / Vercel Postgres)
- **MapLibre GL** rendering; **TomTom** for tiles, search, routing and traffic
- **OpenStreetMap** (Nominatim + OSRM) for street-level search and routing
  where TomTom's coverage is thin
- PWA: service worker, IndexedDB, Cache Storage

## Run it

```bash
npm install
cp .env.example .env.local     # then fill in the values below
npm run dev                    # Next on :3000, TomTom proxy on :5000
```

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server + the Express TomTom proxy |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |

## Environment

Required:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `NEXTAUTH_SECRET` | Session signing secret |
| `NEXTAUTH_URL` | Base URL (`http://localhost:3000` in dev) |
| `TOMTOM_API_KEY` | Tiles, search, routing, traffic |

Optional:

| Variable | Effect if unset |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google button is hidden; email/password still works |
| `GEMINI_API_KEY` | Live AI voice assistant loses its brain and its voice; trip plans fall back to the built-in planner |
| `GEMINI_TTS_VOICE` | Defaults to `Charon`, the deep male voice |

### Live AI voice assistant

The floating button opens a hands-free assistant that runs the app by voice. It
speaks whatever language you speak — in that language's own script — and drives
the site rather than describing it: "Lahore se Islamabad ka route set kro",
"take me to Liberty Market and start navigation", "plan a solo bike trip to
Skardu for a week".

Place names are geocoded server-side through the same TomTom/Geoapify/OSM
pipeline the search box uses, so the assistant never invents coordinates. The
resolved place is passed to the map or planner as query parameters, which those
pages act on automatically — no tapping required.

Speech is `gemini-3.1-flash-tts-preview`, falling back to
`gemini-2.5-flash-preview-tts` when the daily free-tier cap (10 requests) runs
out; identical audio is cached, so repeated lines cost no quota. If every model
is exhausted the browser's built-in speech takes over, which sounds noticeably
robotic — that is the signal that the Gemini quota is gone, not a bug.

### Google sign-in

Create an OAuth client at
[console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
(Web application) and register:

- **Authorised JavaScript origins**: `http://localhost:3000`
- **Authorised redirect URIs**: `http://localhost:3000/api/auth/callback/google`

Add the production equivalents when you deploy.

## Database

Schema lives in `src/db/schema.ts`; migrations in `src/db/migrations`.

```bash
npx drizzle-kit push      # apply the schema
```

## Known limitations

See [`KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md). The ones worth knowing up
front:

- **Routing needs a connection.** Saved routes open offline; new ones do not.
- **Offline tiles cover only downloaded regions.**
- **Provider coverage varies by country.** TomTom has no street-level data for
  Pakistan and no POI data at all for Japan, so search and routing fall back to
  OpenStreetMap there. Trip plans for uncovered destinations are labelled as
  templates rather than presented as researched.
- **Nominatim and OSRM are used via their public demo servers**, which are
  intended for light use. Self-host or move to a paid provider before running
  real traffic.
- **Password reset issues a real, single-use token but does not email it** — no
  mail provider is configured, so the link is logged server-side and shown in
  the UI in development.
