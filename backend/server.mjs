/**
 * Nexus Map — Lightweight Backend Server
 *
 * Provides TomTom API proxying (tiles, routing, search, traffic) and
 * a health-check endpoint. Runs alongside the Next.js dev server.
 *
 * Environment variables (from .env.local):
 *   TOMTOM_API_KEY   — required for TomTom services
 *   PORT             — defaults to 5000
 *   FRONTEND_URL     — CORS origin, defaults to http://localhost:3000
 */

// Load .env.local so TOMTOM_API_KEY and other vars are available
import { config } from "dotenv";
config({ path: ".env.local" });

import express from "express";
import cors from "cors";

const PORT = parseInt(process.env.PORT || "5000", 10);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY || "";

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// ── Health Check ───────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    service: "Nexus Map Backend",
    status: "healthy",
    tomtom: TOMTOM_API_KEY ? "configured" : "missing key",
    database: process.env.DATABASE_URL ? "configured" : "not configured",
    timestamp: new Date().toISOString(),
  });
});

// ── Map Tile Proxy (OSM) ───────────────────────────────────
app.get("/api/navigation/map-tile/:z/:x/:y", async (req, res) => {
  try {
    const { z, x, y } = req.params;
    const response = await fetch(
      `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
    );
    const buffer = await response.arrayBuffer();
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(buffer));
  } catch {
    res.status(502).json({ success: false, message: "Tile fetch failed" });
  }
});

// ── TomTom Traffic Tile Proxy ──────────────────────────────
app.get("/api/navigation/traffic-tile/:z/:x/:y", async (req, res) => {
  if (!TOMTOM_API_KEY) {
    return res.status(503).json({ success: false, message: "TomTom key not configured" });
  }
  try {
    const { z, x, y } = req.params;
    const response = await fetch(
      `https://api.tomtom.com/traffic/map/4/tile/flow/absolute/${z}/${x}/${y}.png?key=${TOMTOM_API_KEY}`
    );
    const buffer = await response.arrayBuffer();
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=300");
    res.send(Buffer.from(buffer));
  } catch {
    res.status(502).json({ success: false, message: "Traffic tile fetch failed" });
  }
});

// ── TomTom Search Proxy ────────────────────────────────────
app.get("/api/navigation/search", async (req, res) => {
  if (!TOMTOM_API_KEY) {
    return res.status(503).json({ success: false, message: "TomTom key not configured" });
  }
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ success: false, message: "Query parameter 'q' is required" });
    }

    const q = String(query);
    const lat = req.query.lat || "";
    const lon = req.query.lon || "";

    // Build URL without nested template literals
    let url = "https://api.tomtom.com/search/2/search/";
    url += encodeURIComponent(q);
    url += ".json?key=" + TOMTOM_API_KEY;
    url += "&limit=10";
    if (lat) {
      url += "&lat=" + String(lat) + "&lon=" + String(lon);
    }

    const response = await fetch(url);
    const data = await response.json();
    const results = (data.results || []).map(function (r) {
      return {
        id: r.id,
        name: (r.poi && r.poi.name) || (r.address && r.address.freeformAddress) || query,
        displayName: (r.poi && r.poi.name) || (r.address && r.address.freeformAddress) || query,
        address: (r.address && r.address.freeformAddress) || "",
        lat: (r.position && r.position.lat) || 0,
        lng: (r.position && r.position.lon) || 0,
        position: {
          latitude: (r.position && r.position.lat) || 0,
          longitude: (r.position && r.position.lon) || 0,
        },
        provider: "tomtom",
      };
    });
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(502).json({ success: false, message: String(error && error.message ? error.message : error) });
  }
});

// ── TomTom Routes Proxy ────────────────────────────────────
app.post("/api/navigation/routes", async (req, res) => {
  if (!TOMTOM_API_KEY) {
    return res.status(503).json({ success: false, message: "TomTom key not configured" });
  }
  try {
    const body = req.body || {};
    const start = body.start;
    const destination = body.destination;
    const travelMode = body.travelMode || "car";
    const avoidTolls = body.avoidTolls === true;
    const alternatives = typeof body.alternatives === "number" ? body.alternatives : 2;

    if (!start || !destination) {
      return res.status(400).json({ success: false, message: "Start and destination required" });
    }

    let url = "https://api.tomtom.com/routing/1/calculateRoute/";
    url += start.latitude + "," + start.longitude;
    url += ":" + destination.latitude + "," + destination.longitude;
    url += "/json?key=" + TOMTOM_API_KEY;
    url += "&travelMode=" + travelMode;
    url += "&routeType=fastest";
    if (avoidTolls) url += "&avoid=tollRoads";
    url += "&computeTravelTimeFor=all";
    url += "&maxAlternatives=" + alternatives;

    const response = await fetch(url);
    const data = await response.json();
    const routes = (data.routes || []).map(function (r, i) {
      var points = (r.legs && r.legs[0] && r.legs[0].points) || [];
      return {
        id: "route-" + i,
        coordinates: points.map(function (p) { return [p.latitude, p.longitude]; }),
        summary: {
          lengthMeters: (r.summary && r.summary.lengthInMeters) || 0,
          travelTimeSeconds: (r.summary && r.summary.travelTimeInSeconds) || 0,
          trafficDelaySeconds: (r.summary && r.summary.trafficDelayInSeconds) || 0,
        },
        instructions: [],
      };
    });
    res.json({ success: true, data: routes });
  } catch (error) {
    res.status(502).json({ success: false, message: String(error && error.message ? error.message : error) });
  }
});

// ── TomTom Traffic Incidents Proxy ─────────────────────────
app.get("/api/navigation/traffic-incidents", async (req, res) => {
  if (!TOMTOM_API_KEY) {
    return res.status(503).json({ success: false, message: "TomTom key not configured" });
  }
  try {
    const west = req.query.west;
    const south = req.query.south;
    const east = req.query.east;
    const north = req.query.north;

    if (!west || !south || !east || !north) {
      return res.status(400).json({ success: false, message: "Bounding box required (west,south,east,north)" });
    }

    const url = "https://api.tomtom.com/traffic/services/4/incidentDetails/s5/" +
      String(west) + "," + String(south) + "," + String(east) + "," + String(north) +
      "/10/-1/json?key=" + TOMTOM_API_KEY;

    const response = await fetch(url);
    const data = await response.json();
    const incidents = (data.incidents || []).map(function (inc, i) {
      var props = inc.properties || {};
      return {
        id: "incident-" + i,
        type: props.iconCategory || 0,
        severity: props.magnitudeOfDelay || 1,
        latitude: (props.point && props.point.y) || 0,
        longitude: (props.point && props.point.x) || 0,
        description: (props.description && props.description.event) || "Traffic incident",
      };
    });
    res.json({ success: true, data: incidents });
  } catch (error) {
    res.status(502).json({ success: false, message: String(error && error.message ? error.message : error) });
  }
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, function () {
  console.log("\uD83C\uDF10 Nexus Map Backend running at http://localhost:" + PORT);
  console.log("   TomTom: " + (TOMTOM_API_KEY ? "\u2705 configured" : "\u26A0\uFE0F  missing API key"));
  console.log("   CORS origin: " + FRONTEND_URL);
});
