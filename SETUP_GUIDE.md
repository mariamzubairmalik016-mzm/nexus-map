# Setup Guide — Nexus Map

## Prerequisites
- Node.js 20+ and npm
- A Supabase project (for auth + persistence) — optional for a first run
- A TomTom API key (required for the backend to start)

## 1. Install
```bash
# from the project root
npm install
cd backend && npm install && cd ..
```

## 2. Environment files
Create these from the provided templates (never commit real secrets):

`.env` (project root — public, VITE_ only):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:5000/api
```

`backend/.env` (secret — never prefix with VITE_):
```
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
TOMTOM_API_KEY=your-tomtom-key          # REQUIRED — server won't boot without it
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=                         # optional — enables live AI (else rule-based)
OPENAI_MODEL=                           # optional — defaults to gpt-4o-mini
```

## 3. Database (optional but recommended)
See `DATABASE_SETUP.md` — run the Supabase SQL files, then `ADMIN_SETUP.md` to
grant yourself admin.

## 4. Run (two terminals)
```bash
# Terminal 1 — backend  -> http://localhost:5000
cd backend && npm run dev

# Terminal 2 — frontend -> http://localhost:5173
npm run dev
```

## 5. Verify
- Backend: http://localhost:5000/health → `{ "status": "online" }`
- Frontend: http://localhost:5173

## Production build
```bash
npm run build                       # frontend -> dist/
cd backend && npm run build && npm start   # backend -> dist/, node dist/server.js
```

## Notes
- The app is a PWA — installable, offline-capable (service worker + IndexedDB).
- If Supabase isn't configured, features degrade to demo/in-memory, clearly labeled.
