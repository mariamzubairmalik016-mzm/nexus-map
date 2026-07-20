# NEXUS MAP — Complete Frontend

## Install

```bat
cd "C:\Users\Mariam Zubair Malik\OneDrive\Desktop\NEXUS MAP\nexus-map"
npm install
npm run dev
```

## Demo login without Supabase

Email: `mariam@example.com`  
Password: `12345678`

For an admin demo, use an email containing the word `admin`, for example:

Email: `admin@example.com`  
Password: `12345678`

## Supabase later

Copy `.env.example` to `.env` and add:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The frontend works in demo/localStorage mode when these values are missing.

## Included pages

- Home
- Explore
- Interactive World Map
- Route Planner
- Community Reports
- Login / Signup / Password Reset
- Dashboard
- Profile
- Favorites
- History
- Notifications
- Worldwide Offline Maps UI
- AI Trip Planner
- Settings
- Admin Dashboard
- 404 page

## Important

This ZIP is a complete replacement frontend. Back up your old `src` folder before replacing it.
