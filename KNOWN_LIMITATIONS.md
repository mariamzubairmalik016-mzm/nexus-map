# Known Limitations — Nexus Map

Honest list of what the project does **not** do, plus hazards worth knowing.
Nothing here is a defect introduced by the audit; these are real constraints.

---

## 1. Offline routing is not supported

The app can work offline for **saved and cached** data:

- saved places, recent searches, cached search results, downloaded offline
  places
- saved routes already stored on the device
- map tiles **only** for regions explicitly downloaded

It **cannot** calculate a *new* route offline — routing requires TomTom. The UI
states this plainly (*"New routes need a connection."*) and does not pretend
otherwise. Do not market this as full offline navigation.

## 2. Offline tiles cover only downloaded regions

GPS still works offline and the map still centres on your real position, but if
no downloaded region covers that area the map is blank there. The app detects
this and says so, rather than showing an empty canvas.

## 3. CORS is pinned to a single origin

`FRONTEND_URL` (default `http://localhost:5173`) is the only allowed origin. If
Vite falls through to 5174+ because 5173 is occupied, **every API call fails**,
and the service worker reports it as a `503` — which reads like a backend
outage. See `FINAL_SETUP_AND_RUN_GUIDE.md`.

## 4. Multiple Vite servers corrupt the shared dependency cache

All Vite instances for this project share `node_modules/.vite`. Running several
at once can produce mismatched pre-bundled dependencies and strange runtime
errors. Run one. Recover with `rm -rf node_modules/.vite`.

## 5. A stale duplicate backend still lives inside `src/`

`src/server.ts`, `src/app.ts`, `src/routes/*.routes.ts`, `src/config/env.ts`
and `src/config/supabase.ts` are an **old copy** of the backend sitting in the
frontend source tree.

- **Currently harmless**: unreachable from the React entry graph, so it is never
  bundled — verified against the built output.
- **But a hazard**: `src/config/supabase.ts` references
  `SUPABASE_SERVICE_ROLE_KEY`. A single stray import from frontend code would
  pull a secret-shaped reference into the browser bundle.
- It also returns **legacy-shaped demo data** (alerts with coordinates packed
  into a `location` string and no numeric lat/lng) — the exact shape that caused
  the map crash this audit fixed.

Left in place because deleting files is your decision. Recommended: delete it,
or exclude it from the frontend `tsconfig` so it can never be imported.

## 6. Nested `nexus-map/` scaffold

A duplicate project scaffold dated 14 July sits at `nexus-map/`. It is
gitignored and unused. Its own `.env` files contain real credentials, which is
why it must never be committed. Safe to delete once you confirm you do not need
it.

## 7. Demo alerts are opt-in and labelled

`DEMO_ALERTS` only appear when `includeDemo=true` is passed, are tagged
`source: "demo"`, and are never written to Supabase or cached as real data. Live
API data is labelled separately. Nothing fake is presented as live.

## 8. PWA icon set is minimal

The manifest ships a single SVG icon with `sizes: "any"`. All installability
fields are present, but some platforms prefer explicit 192px and 512px PNG
icons. Add them if you want the broadest install support.

## 9. No linter configured

There is no ESLint config. Not added deliberately: introducing one to a mature
codebase generates a large diff unrelated to any real defect.

## 10. External provider dependencies

| Provider | Used for | If it fails |
|---|---|---|
| TomTom | Search, routing, traffic, tiles | **Required** — backend won't boot without the key; routing unavailable |
| Geoapify | Supplementary POIs, worldwide fallback | Optional — search still works |
| Supabase | Auth, profiles, catalogue, alerts | Optional — falls back to in-memory store; app runs signed-out |
| OpenAI | AI planner / chat | Optional — deterministic rule-based plan instead |

Quota exhaustion or an invalid key degrades the relevant feature; it does not
crash the app.

## 11. Search ranking quirk

Provider POIs sometimes outrank the place itself — e.g. *"Dolmen Mall Clifton"*
returns the tenant *"Summit Bank – Dolmen Mall Clifton"* first. Seeding the
catalogue (step 5 in `DATABASE_EXECUTION_ORDER.md`) improves this. Routing is
unaffected: the coordinates are within the same building.

## 12. Areas this audit did not exercise

See the "Not tested" section of `FINAL_TEST_CHECKLIST.md` — chiefly real account
signup/verification, live offline-region download, true airplane-mode reload,
and a systematic responsive sweep.
