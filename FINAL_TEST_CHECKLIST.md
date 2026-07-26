# Final Test Checklist — Nexus Map

Legend: ✅ verified in this audit · ⚠️ partially verified · ⬜ not tested (needs
you)

---

## Build & types

| Check | Status | Evidence |
|---|---|---|
| Frontend typecheck | ✅ | `tsc -b --noEmit` exit 0 |
| Frontend production build | ✅ | built in 3.85s |
| Backend typecheck | ✅ | `tsc --noEmit` exit 0 |
| Backend production build | ✅ | exit 0 |
| No `@ts-ignore` / `@ts-nocheck` anywhere | ✅ | grep returns none |
| No unresolved merge conflicts | ✅ | project-wide grep, 0 markers |
| Dependencies: none missing/extraneous/duplicate | ✅ | `npm ls --depth=0` clean, both workspaces |
| `npm audit` | ✅ | 0 vulnerabilities |

## Routing

| Check | Status | Evidence |
|---|---|---|
| Exactly one `BrowserRouter` | ✅ | `AppRoutes.tsx:31` only |
| Single React / react-router-dom instance | ✅ | React 19.2.7, RRD 7.18.1 |
| All 19 lazy pages exist + default export | ✅ | enumerated |
| 18 routes render, no blank page | ✅ | router walk |
| 404 catch-all works | ✅ | `/no-such-page` renders |
| Direct-URL refresh (dev) | ✅ | 15 routes → 200 |
| Direct-URL refresh (production preview) | ✅ | 200 |
| Suspense fallback present | ✅ | `MainLayout` |
| No infinite redirect / stuck spinner | ✅ | route walk |

## Error handling

| Check | Status | Evidence |
|---|---|---|
| App-wide error boundary | ✅ | wraps `AppRoutes` |
| Scoped boundary around map | ✅ | wraps `MapLibreMap` |
| Boundary actually catches | ✅ | **forced a throw** — map showed fallback, navbar + planner kept working, not blank |
| Retry + reload controls | ✅ | present in fallback |
| No stack traces in production UI | ✅ | detail is `import.meta.env.DEV`-gated |
| Clean 400 from backend on bad body | ✅ | message only, no stack |

## Map & GPS

| Check | Status | Evidence |
|---|---|---|
| Map renders, canvas present | ✅ | `/map` |
| Markers render | ✅ | 2 markers |
| Invalid coordinates cannot crash the map | ✅ | guarded; logs skip instead of throwing |
| Bad alert can't poison a cluster average | ✅ | filtered before clustering |
| Map opens at real GPS when granted | ✅ | previous session: centred 24.8607/67.0011 @ z15 |
| Pakistan used only as fallback | ✅ | behind GPS and saved view |
| Route line renders | ✅ | previous session, verified visually |
| GPS denial degrades gracefully | ✅ | amber notice, map keeps last view |

## Offline / PWA

| Check | Status | Evidence |
|---|---|---|
| Service worker activated + controlling | ✅ | `offline-sw.js` |
| Cache Storage populated | ✅ | app-v6, api-v1, offline-tiles-v1 |
| IndexedDB present | ✅ | `nexus-map-offline v6` |
| Manifest valid, installability fields | ✅ | parsed and checked |
| Online → offline: no crash | ✅ | map still rendered |
| Honest offline messaging | ✅ | *"New routes need a connection."* |
| Offline → online recovery | ✅ | banner cleared |
| True network-layer offline reload | ⚠️ | simulated at app layer only |
| Offline region download end-to-end | ⬜ | consumes real tile quota |

## Backend API

| Check | Status | Evidence |
|---|---|---|
| Server starts | ✅ | health 200 |
| All routers mounted | ✅ | full matrix probed |
| Auth guards return 401 | ✅ | favorites, history, admin, offline-packs… |
| Validation returns 400 | ✅ | malformed + null coords |
| No stack trace in error body | ✅ | inspected |
| Frontend paths match backend routes | ✅ | `/ai/chat`, `/trip-planner/generate`, `/community/notes` |

## Security

| Check | Status | Evidence |
|---|---|---|
| Bundle contains anon key only | ✅ | `"role":"anon"`; no service-role |
| No `process.env` / service-role in bundled frontend | ✅ | stale files unreachable from entry graph |
| `.env` / `backend/.env` gitignored | ✅ | `git check-ignore` |
| `.env.example` placeholders only | ✅ | verified in git |
| XSS in map popups | ✅ **fixed** | `escapeHtml` on all interpolation |
| RLS enforced | ✅ | anon read OK, anon write `42501` |

## Auth

| Check | Status | Evidence |
|---|---|---|
| Single auth listener, unsubscribed | ✅ | code review |
| Session gate always resolves | ✅ **fixed** | `catch` + `finally` |
| No setState after unmount | ✅ **fixed** | `active` flag |
| Protected/admin guards redirect correctly | ✅ | code + route walk |
| Admin role never inferred client-side | ✅ | defaults to `user` |
| Full signup → verify → login → logout cycle | ⬜ | needs a real test account |
| Password reset email flow | ⬜ | needs a real mailbox |

## Not tested — needs you

- ⬜ Real account signup / email verification / password reset
- ⬜ Offline region download, progress, cancel, delete
- ⬜ True airplane-mode reload
- ⬜ Responsive sweep at each breakpoint (no defects seen, not exhaustive)
- ⬜ Saving a place / route while authenticated
- ⬜ AI planner with a live OpenAI key
- ⬜ Lighthouse / performance profiling
