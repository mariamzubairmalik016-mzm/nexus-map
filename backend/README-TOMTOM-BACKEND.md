# Nexus Map — TomTom Backend Patch

Extract this ZIP inside:

`NEXUS MAP/nexus-map/backend`

## Security warning

The TomTom key shared in chat should be rotated in the TomTom dashboard. Put the replacement key only in `backend/.env`.

Never place it in the frontend or commit it to GitHub.

## Setup

Copy `.env.example` to `.env`:

```bat
copy .env.example .env
```

Add the new key:

```env
TOMTOM_API_KEY=your-new-key
```

Install and run:

```bat
npm install
npm run dev
```

## Backend endpoints

- `GET /api/navigation/search`
- `POST /api/navigation/routes`
- `GET /api/navigation/traffic-incidents`
- `GET /api/navigation/map-tile/:z/:x/:y`
- `GET /api/navigation/traffic-tile/:z/:x/:y`
- `GET /api/community/notes`
- `POST /api/community/notes`

## Features

- Worldwide address, street, locality and POI search
- Traffic-aware routes and alternatives
- Turn-by-turn text instructions
- Live traffic flow map overlay
- Traffic incident markers
- Backend-protected TomTom key
- Community road notes

## Offline maps

This patch does not bulk-download TomTom or public OSM tiles. Real country/city offline packages require a separately licensed offline tile solution or a self-hosted tile server.
