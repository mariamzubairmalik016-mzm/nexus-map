# Setup & Run Guide — Nexus Map

## Prerequisites

- **Node.js 20+** (verified on Node 24)
- A Supabase project (optional — the app runs signed-out without one)
- A **TomTom API key** — the backend refuses to start without it

---

## 1. Install

```bash
npm run install:all      # installs frontend + backend together
```

Or separately:

```bash
npm install
npm --prefix backend install
```

## 2. Configure environment

Copy the examples and fill in real values (see
`ENVIRONMENT_VARIABLE_CHECKLIST.md` for the full table):

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Minimum to boot:

- `backend/.env` → `TOMTOM_API_KEY` (**required**)
- `.env` → `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (required for auth)

## 3. Set up the database

Run the SQL files in the order given in `DATABASE_EXECUTION_ORDER.md`.
All are idempotent and non-destructive.

## 4. Run

**Both at once (recommended):**

```bash
npm run dev:all
```

**Separately:**

```bash
npm run dev            # frontend  → http://localhost:5173
npm run dev:backend    # backend   → http://localhost:5000
```

---

## ⚠️ Read this before reporting "search is broken"

The backend allows **exactly one** CORS origin: `FRONTEND_URL`, default
`http://localhost:5173`.

If port 5173 is already taken, Vite quietly starts on 5174/5175/5176 — and then
**every API call fails CORS**. The service worker turns that into a `503`, so
the UI says *"Search is unavailable right now"*, which looks like a backend
outage but is not.

**Always check the port in the Vite startup banner.** If it is not 5173:

```bash
# Windows — find and stop whatever holds 5173
netstat -ano | findstr :5173
powershell "Stop-Process -Id <PID> -Force"
```

Also avoid running **multiple Vite servers at once** against this project: they
share `node_modules/.vite` and can corrupt each other's dependency cache. If the
app behaves strangely after running several:

```bash
rm -rf node_modules/.vite
```

---

## 5. Production build

```bash
npm run build:all        # frontend + backend
npm run preview          # serve the built frontend
npm --prefix backend start   # run the built backend
```

## 6. Verify

```bash
npm run typecheck:all    # frontend + backend typecheck
```

Expected: all four green (frontend typecheck, frontend build, backend
typecheck, backend build).

---

## Available scripts

### Frontend (root `package.json`)
| Script | Does |
|---|---|
| `dev` | Vite dev server |
| `build` | `tsc -b && vite build` |
| `preview` | Serve the production build |
| `typecheck` | `tsc -b --noEmit` |
| `dev:backend` / `build:backend` / `typecheck:backend` | Delegate to backend |
| `dev:all` | Frontend + backend concurrently |
| `build:all` / `typecheck:all` | Both workspaces |
| `install:all` | Install both |

### Backend (`backend/package.json`)
| Script | Does |
|---|---|
| `dev` | `tsx watch src/server.ts` |
| `build` | `tsc -p tsconfig.json` |
| `start` | `node dist/server.js` |
| `typecheck` | `tsc --noEmit` |

> **No lint script is configured** and no ESLint config exists in the project.
> Adding one is optional; nothing depends on it. It was deliberately not added,
> since introducing a linter to a mature codebase produces a large diff
> unrelated to any actual defect.

---

## Health checks

```bash
curl http://localhost:5000/api/health
curl "http://localhost:5000/api/navigation/search?q=Karachi&lat=24.86&lon=67.00"
```

Auth-guarded endpoints correctly return **401** without a token — that is
expected, not a failure.
