# Demo Checklist — Nexus Map (teacher presentation flow)

Start both servers first (`SETUP_GUIDE.md`). Suggested ~8–10 minute flow.

| # | Page | What to show | Data source |
|---|---|---|---|
| 1 | **Home** `/` | Cinematic hero, 3D globe, animated stats, scroll reveals | Static + Supabase destinations |
| 2 | **Login** `/login` | Real Supabase auth, glass card, validation | Supabase Auth |
| 3 | **Dashboard** `/dashboard` | Welcome header, live **service-health matrix**, connectivity, storage, weather, alert stats | Live checks + IndexedDB + Open-Meteo |
| 4 | **Explore** `/explore` | Correct per-destination images, filters, favorite, open-on-map | Supabase `geo_cities` + local images |
| 5 | **Map** `/map` | Search, route calc, GPS, **road-alert markers with pulse**, route-warning banner | Backend → **TomTom (Live API)** |
| 6 | **Road Alerts** `/road-alerts` | Source status panel, source/severity filters, **Include Demo** toggle, badges | Live API + Community + Demo |
| 7 | **Community** `/community` | Submit a report, cached-offline read | Backend (in-memory/Supabase) |
| 8 | **Offline Maps** `/offline-maps` | Real OSM tile download, storage ring, offline search | Cache API + IndexedDB |
| 9 | **AI Planner** `/ai-planner` | Generate a trip plan | OpenAI (if key) else rule-based fallback |
| 10 | **Notifications** `/notifications` | Read/unread, pending-sync count | localStorage + sync queue |
| 11 | **Settings** `/settings` | Preferences | local state |
| 12 | **Admin** `/admin` | Stats + moderation (admin account only) | Backend (admin-gated) |
| 13 | **Offline demo** | DevTools → Network → Offline → reload: cached maps/alerts/favorites still work; reconnect → auto-sync | Service Worker + IndexedDB + queue |
| 14 | **Conclusion** | PWA install, self-healing IndexedDB, secure admin, no secrets in bundle | — |

## Which features use what
- **Live API (TomTom):** map tiles, routing, traffic incidents, road-alert "Live API" source, navigation search.
- **Supabase:** authentication, profiles/roles, Explore destinations, favorites, community/admin road alerts (when SQL run), Realtime.
- **Offline cache (SW + IndexedDB + Cache API):** downloaded maps, offline search, favorites, trip history, road alerts, sync queue.
- **Community:** user-submitted road alerts + community notes/reports.
- **Demo:** clearly labeled sample road alerts, shown only when "Include Demo Alerts" is on. **Never labeled as live.**

## Talking points
- Self-healing IndexedDB migration (no crashes on schema upgrade).
- Mixed-source road alerts with honest source badges + priority + de-duplication.
- DB-driven admin role (no hardcoded admin, no frontend bypass).
- Secrets never reach the browser (verified: 0 secrets in the frontend bundle).
