# Nexus Map — TomTom Frontend Patch

Extract this ZIP into the frontend root:

`NEXUS MAP/nexus-map`

Keep your destination pictures in:

`public/destinations/`

Required filenames:

- hunza.jpg
- skardu.jpg
- lahore.jpg
- islamabad.jpg
- karachi.jpg
- dubai.jpg
- istanbul.jpg
- tokyo.jpg
- paris.jpg
- bali.jpg

## Install

```bat
npm install
```

No TomTom key belongs in the frontend. The frontend calls the backend proxy.

## Run

```bat
npm run dev
```

## Notes

- Autocomplete searches worldwide streets, towns, villages, cities and POIs.
- The map shows TomTom map tiles and traffic flow tiles through the backend.
- Route alternatives, traffic-aware ETA, instructions and automatic rerouting are included.
- Browser permission is required for GPS tracking.
- Real offline map packages are not included in this patch because they require a licensed/self-hosted offline tile system.
