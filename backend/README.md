# NEXUS MAP BACKEND

This backend is ready to run before the database is created.

It uses:
- Node.js
- Express 5
- TypeScript
- Zod validation
- Helmet security headers
- CORS
- Supabase-ready authentication
- Demo in-memory storage when Supabase is not configured

## Install

```bat
cd "C:\Users\Mariam Zubair Malik\OneDrive\Desktop\NEXUS MAP\nexus-map-backend"
npm install
copy .env.example .env
npm run dev
```

Open:

```text
http://localhost:5000/api/health
```

Expected response:

```json
{
  "success": true,
  "service": "Nexus Map Backend",
  "status": "online",
  "database": "demo-memory"
}
```

## Main API routes

- GET `/api/health`
- GET `/api/places`
- GET `/api/places?q=hunza`
- POST `/api/places`
- GET `/api/reports`
- POST `/api/reports`
- POST `/api/reports/:id/helpful`
- GET `/api/favorites`
- POST `/api/favorites`
- DELETE `/api/favorites/:placeId`
- GET `/api/history`
- POST `/api/history`
- DELETE `/api/history/:id`
- GET `/api/notifications`
- PATCH `/api/notifications/:id/read`
- PATCH `/api/notifications/read-all`
- GET `/api/offline-maps`
- POST `/api/offline-maps`
- DELETE `/api/offline-maps/:id`
- POST `/api/trip-planner/generate`
- GET `/api/admin/stats`

## Demo authentication headers

Until Supabase is connected, protected routes automatically use a demo user.

Optional headers:

```text
x-demo-user-id: demo-user
x-demo-user-email: mariam@example.com
x-demo-user-role: user
```

For admin route testing:

```text
x-demo-user-role: admin
```

## Frontend environment

Add this to the frontend `.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

## Database phase

When the Supabase database is created, add these values to backend `.env`:

```env
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Never put the service role key in the frontend.
