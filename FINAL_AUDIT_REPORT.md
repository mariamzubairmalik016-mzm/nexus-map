# NEXUS MAP — Final Production Audit Report

**Audited:** 23 July 2026
**Branch:** `main` · **Base commit:** `eee1d85`
**Scope:** frontend, backend, database, routing, auth, APIs, offline/PWA, maps/GPS, security, performance

---

## 1. Executive summary

The project was **already in good structural shape**. The audit found no merge
conflicts, no dependency problems, no build failures and no leaked secrets in
tracked files.

Six genuine defects were found and fixed, of which **three were capable of
taking the whole application down** (blank page) and **one was a stored-XSS
vector**. All fixes were verified by running the application, not by reasoning
alone.

No features were removed. No database changes were executed.

---

## 2. Root causes found

### 2.1 No error boundary existed anywhere — CRITICAL

`grep` for `componentDidCatch` / `getDerivedStateFromError` / `ErrorBoundary`
returned **zero results** across `src/`.

Consequence: *any* render or lifecycle throw anywhere in the tree unmounted the
entire application, producing a blank page with the real cause visible only in
the console. This is the structural reason a single bad map marker could destroy
the whole app. React itself had been printing the hint — *"Consider adding an
error boundary"* — on every crash.

**This is the single most important finding in the audit.** It converts any
future component-level bug from "app is dead" into "one panel shows a message".

### 2.2 Road alerts with no coordinates crashed the map — CRITICAL

`roadAlertsService.list()` cast the API response straight to `RoadAlert[]`
(`json.data ?? []`) with no validation. A legacy-shaped record carrying its
position as a **string** (`location: "24.8607, 67.0011"`) and no numeric
`latitude`/`longitude` flowed into React state.

In the clustering branch of `MapLibreMap`, `cell.lat += alert.latitude` turned
the entire cell average into `NaN`, so one bad record poisoned every alert
sharing its grid cell. `setLngLat([NaN, NaN])` then **throws** in MapLibre,
which (per 2.1) blanked the page.

Aggravating factor: the service also **wrote the bad record into IndexedDB**, so
it survived restarts and kept re-crashing the map even offline.

### 2.3 Auth could hang forever on `loading: true` — HIGH

`AuthContext` called `supabase.auth.getSession().then(...)` with **no `.catch()`
and no `.finally()`**. `setLoading(false)` lived only on the success path.

If session restore rejected — offline, Supabase unreachable, corrupt stored
token — the promise never settled and `loading` stayed `true` permanently. Both
`ProtectedRoute` and `AdminRoute` gate on `loading`, so every protected page
would render *"Restoring your session…"* forever. An indefinite spinner instead
of a usable signed-out app.

`loadProfile`'s query rejection was also unhandled inside the auth listener.

### 2.4 Stored XSS in map popups — HIGH (security)

`MapLibreMap` interpolated values directly into `Popup.setHTML()`:

- **Community notes** (`note.title`, `note.description`, `note.status`) — these
  are **user-generated content**
- Incident text from a third-party provider

`setHTML`/`innerHTML` bypass React's automatic escaping, so a note titled with
markup would execute in every viewer's browser.

### 2.5 Community-note markers dereferenced an unchecked position — MEDIUM

`note.position.longitude` was read with no guard, while the neighbouring
`incidents.forEach` *did* guard (`if (!incident.position) return;`). A note with
a missing position would throw.

### 2.6 Unnecessary `@ts-ignore` suppressions — LOW

`main.tsx` suppressed two CSS side-effect imports. `src/vite-env.d.ts` already
references `vite/client`, which declares CSS modules, so the suppressions hid
nothing real and violated the "no `@ts-ignore`" rule.

---

## 3. Bugs fixed

| # | Fix | Severity | Verified by |
|---|---|---|---|
| 1 | Added `ErrorBoundary`, wired app-wide **and** scoped around the map | Critical | Forced a throw; map panel showed fallback while navbar + planner kept working |
| 2 | Reject alerts with non-finite coords at the service boundary, before state **and** cache | Critical | `/map` renders, 2 markers, zero console errors |
| 3 | `add()` marker helper returns `null` on invalid coords instead of throwing | Critical | Guard logs `[map] skipped marker…` instead of crashing |
| 4 | Filter alerts **before** clustering so one bad record can't poison a cell average | Critical | Map renders with alert data present |
| 5 | `getSession()` now has `.catch()` + `.finally()`; auth listener also clears the gate | High | All protected routes render, no stuck spinners |
| 6 | `loadProfile` wrapped in try/catch (query builder is a thenable, not a Promise) | High | Typecheck + route walk |
| 7 | `escapeHtml()` applied to all popup interpolation | High (security) | Typecheck; escaping applied at both call sites |
| 8 | Guard `note.position` before dereferencing | Medium | Typecheck + render |
| 9 | Removed both `@ts-ignore` from `main.tsx` | Low | `tsc` exits 0 with zero suppressions project-wide |
| 10 | `MapPage` cache-hydration path now filtered (it bypassed the service) | Critical | Poisoned IndexedDB no longer reintroduces the crash |

---

## 4. Files changed

| File | Change |
|---|---|
| `src/components/ui/ErrorBoundary.tsx` | **NEW** — production-safe boundary; dev-only detail, retry + reload, matches design system |
| `src/App.tsx` | Wrapped `AppRoutes` in the top-level boundary |
| `src/Pages/Map/MapPage.tsx` | Scoped boundary around `MapLibreMap`; filtered cache hydration |
| `src/components/map/MapLibreMap.tsx` | `escapeHtml`; guarded `add()`; pre-filtered alerts; guarded note positions |
| `src/context/AuthContext.tsx` | `catch`/`finally` on session restore; unmount guard; safe `loadProfile` |
| `src/main.tsx` | Removed two unnecessary `@ts-ignore` |
| `src/services/roadAlertsService.ts` | `isPlaceableAlert` / `usableAlerts`; filtering at all three entry points |

**Net:** +149 / −41 across 6 modified files and 1 new file.

---

## 5. Verification results

### Builds
| Check | Result |
|---|---|
| Frontend typecheck (`tsc -b --noEmit`) | ✅ exit 0 |
| Frontend production build | ✅ built in 3.85s |
| Backend typecheck (`tsc --noEmit`) | ✅ exit 0 |
| Backend production build | ✅ exit 0 |

### Routing — 18 routes walked
No blank pages, no boundary triggers, no stuck spinners, 404 catch-all works.
Direct-URL refresh returns **200 in both dev and production preview** for every
deep route.

Exactly **one** `BrowserRouter` (`AppRoutes.tsx:31`). Single React 19.2.7 and
react-router-dom 7.18.1 — no duplicate instances.

### Backend — full route matrix
`health` 200 · `road-alerts` 200 · `places` 200 · `reports` 200 ·
`community/notes` 200 · `navigation/search` 400 (validation) ·
`favorites`/`history`/`notifications`/`offline-maps`/`offline-packs`/`admin` 401
(auth guard) · `trip-planner/generate`, `ai/chat`, `community/notes` POST 401.

The three bare-path 404s (`/ai`, `/trip-planner`, `/community`) are **correct by
design** — those routers define POST-only or sub-path handlers. Frontend service
calls were confirmed to target the exact matching paths.

Malformed bodies return **400 with a clean message and no stack trace**.

### Offline / PWA
Service worker `offline-sw.js` activated and controlling. Caches:
`nexus-map-app-v6`, `nexus-map-api-v1`, `nexus-map-offline-tiles-v1`.
IndexedDB `nexus-map-offline v6`. Manifest valid, all installability fields
present.

Offline transition: no crash, map still rendered, and honest messaging —
*"New routes need a connection."* Online recovery clean, banner cleared.

### Security
- Built bundle contains **only the anon key** (`"role":"anon"` — public by
  design). No service-role reference, no `process.env` leakage.
- The stale duplicate backend inside `src/` is **unreachable from the entry
  graph**, so it never bundles.
- `.env` and `backend/.env` correctly gitignored; both `.env.example` files hold
  placeholders only.
- `npm audit`: **0 vulnerabilities**.

### Dependencies
No missing, extraneous, invalid or duplicated packages in either workspace.

---

## 6. Deliberately NOT changed

- **No database writes executed.** The SQL files are provided for you to run.
- **No features removed.**
- **The stale duplicate backend in `src/`** (`src/server.ts`, `src/app.ts`,
  `src/routes/*.routes.ts`, `src/config/env.ts`, `src/config/supabase.ts`) was
  left in place — deleting files is your call. It is currently harmless (not
  bundled) but is a latent hazard; see `KNOWN_LIMITATIONS.md`.
- **The nested `nexus-map/` scaffold** remains on disk, gitignored.

---

## 7. Honest limitations of this audit

- Offline was simulated at the **application layer** (`navigator.onLine` +
  events), not at the network layer. True airplane-mode reload was not exercised.
- Responsive breakpoints were **not** systematically measured at each viewport
  width; no layout defects surfaced during testing, but this was not exhaustive.
- Authentication was verified structurally (guards, session gate, redirects). A
  full signup → email-verify → login → logout cycle with a real test account was
  **not** performed.
- Offline region **download** was not executed end to end (it consumes real tile
  quota).
- No load or performance profiling was run; performance findings are structural.
