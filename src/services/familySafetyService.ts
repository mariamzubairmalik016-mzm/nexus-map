import type {
  SafeZone,
  FamilyMember,
  EmergencyContact,
  SOSAlert,
  HealthFacility,
  WeatherAlert,
} from "../types/tourism";

// ─── Mock data ─────────────────────────────────────────────
const MOCK_HEALTH_FACILITIES: HealthFacility[] = [
  { id: "h1", name: "Aga Khan University Hospital", type: "hospital", latitude: 24.8895, longitude: 67.0691, address: "Stadium Road, Karachi", phone: "+92-21-34861111", emergency: true, open24Hours: true },
  { id: "h2", name: "Liaquat National Hospital", type: "hospital", latitude: 24.8754, longitude: 67.0539, address: "National Stadium Road, Karachi", phone: "+92-21-34411222", emergency: true, open24Hours: true },
  { id: "h3", name: "D Watson Pharmacy", type: "pharmacy", latitude: 24.8112, longitude: 67.0340, address: "Clifton, Karachi", phone: "+92-21-35877777", emergency: false, open24Hours: true },
  { id: "h4", name: "Jinnah Postgraduate Medical Centre", type: "hospital", latitude: 24.8719, longitude: 67.0344, address: "Rafiqui Shaheed Road, Karachi", phone: "+92-21-99213000", emergency: true, open24Hours: true },
  { id: "h5", name: "Chiniot General Clinic", type: "clinic", latitude: 24.8301, longitude: 67.0656, address: "Gulshan-e-Iqbal, Karachi", phone: "+92-21-34962715", emergency: false, open24Hours: false },
  { id: "h6", name: "Karachi Blood Bank", type: "blood_bank", latitude: 24.8567, longitude: 67.0238, address: "Saddar, Karachi", phone: "+92-21-35657800", emergency: true, open24Hours: true },
];

const EMERGENCY_NUMBERS = [
  { name: "Police", number: "15", icon: "Shield" },
  { name: "Ambulance", number: "115", icon: "Ambulance" },
  { name: "Fire Brigade", number: "16", icon: "Flame" },
  { name: "Rescue 1122", number: "1122", icon: "LifeBuoy" },
  { name: "Tourist Police", number: "118", icon: "MapPin" },
];

import { api } from "./api";

/** Row shapes as the API returns them — snake-free, ids are uuid strings. */
export type ServerSOSAlert = {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  message: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};

const SAFE_ZONE_KEY = "nexus-safe-zones-v2";

/** Metres between two coordinates (haversine) — used for geofence crossings. */
export const distanceBetween = (
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number => {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export type ServerContact = {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship: string | null;
  isPrimary: number;
  createdAt: string;
};

export const familySafetyService = {
  // ─── Emergency Numbers ──────────────────────────────────
  async getEmergencyNumbers() {
    try {
      const data = await api.get<{ numbers: any[]; safetyTips: string[]; healthTips: string[] }>("/tourism/safety?type=emergency");
      return data.numbers;
    } catch {
      return [];
    }
  },

  // ─── Safety Tips ────────────────────────────────────────
  // ─── Health Tips ────────────────────────────────────────
  // ─── Health Facilities ──────────────────────────────────
  async getNearbyHealthFacilities(
    latitude: number,
    longitude: number,
    type?: string
  ): Promise<HealthFacility[]> {
    try {
      const qp = new URLSearchParams({ type: "health-facilities", lat: String(latitude), lng: String(longitude) });
      if (type) qp.set("facility_type", type);
      return await api.get<HealthFacility[]>(`/tourism/safety?${qp.toString()}`);
    } catch {
      return [];
    }
  },

  // ─── Weather Alerts ─────────────────────────────────────
  async getWeatherAlerts(city: string): Promise<WeatherAlert[]> {
    const alerts: WeatherAlert[] = [
      {
        type: "extreme_heat",
        severity: "high",
        title: "Heatwave Advisory",
        description: "Temperatures expected to reach 42°C. Stay hydrated and avoid midday sun.",
      },
    ];
    return alerts;
  },

  // ─── Safe Zones ─────────────────────────────────────────
  /**
   * Device-local by design. A geofence is only useful while this browser is
   * open and watching GPS — the crossing is detected here, not on a server —
   * so syncing the definitions elsewhere would imply monitoring that isn't
   * happening. `deleteSafeZone` previously did nothing at all, so zones could
   * be created but never removed.
   */
  getSafeZones(): SafeZone[] {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(SAFE_ZONE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? (parsed as SafeZone[]) : [];
    } catch {
      return [];
    }
  },

  saveSafeZones(zones: SafeZone[]): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SAFE_ZONE_KEY, JSON.stringify(zones));
    } catch {
      /* private mode / quota — non-fatal */
    }
  },

  addSafeZone(zone: SafeZone): SafeZone[] {
    const next = [...this.getSafeZones(), zone];
    this.saveSafeZones(next);
    return next;
  },

  deleteSafeZone(zoneId: string): SafeZone[] {
    const next = this.getSafeZones().filter((z) => z.id !== zoneId);
    this.saveSafeZones(next);
    return next;
  },

  // ─── Family Members ─────────────────────────────────────
  async getFamilyMembers(userId: string): Promise<FamilyMember[]> {
    const stored = localStorage.getItem(`nexus-family-${userId}`);
    if (stored) return JSON.parse(stored);
    return [];
  },

  async addFamilyMember(member: FamilyMember): Promise<void> {
    // In production, send invite via email/SMS
  },

  async updateFamilyLocation(
    memberId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    // In production, push to family sharing service
  },

  // ─── SOS ────────────────────────────────────────────────
  /**
   * Everything below talks to `/api/sos` and `/api/emergency-contacts`, which
   * are Postgres-backed. The previous versions resolved local objects and
   * console.logged the recipients, so an SOS updated the screen and nothing
   * else — the most dangerous possible failure for this feature, because the
   * UI reported success.
   */

  /** The caller's open alert (or null) plus their saved contacts. */
  async getSOSStatus(): Promise<{ active: ServerSOSAlert | null; contacts: ServerContact[] }> {
    const data = await api.get<{ active: ServerSOSAlert[]; contacts: ServerContact[] }>("/sos");
    return {
      active: data.active?.[0] ?? null,
      contacts: data.contacts ?? [],
    };
  },

  /**
   * Raise (or re-point) an alert. The server keeps one open alert per user, so
   * pressing this again while an alert is live moves it to the newest
   * coordinates instead of stacking duplicates.
   */
  async raiseSOS(input: { latitude: number; longitude: number; message?: string }): Promise<ServerSOSAlert> {
    return api.post<ServerSOSAlert>("/sos", input);
  },

  /** Stand down — resolves the caller's active alert. */
  async resolveSOS(): Promise<number> {
    const data = await api.patch<{ resolved: number }>("/sos");
    return data.resolved;
  },

  // ─── Emergency Contacts ─────────────────────────────────
  async getEmergencyContacts(): Promise<ServerContact[]> {
    return api.get<ServerContact[]>("/emergency-contacts");
  },

  async saveEmergencyContact(contact: {
    name: string;
    phone: string;
    relationship?: string;
    isPrimary?: boolean;
  }): Promise<ServerContact> {
    return api.post<ServerContact>("/emergency-contacts", contact);
  },

  async deleteEmergencyContact(contactId: string): Promise<void> {
    await api.delete(`/emergency-contacts?id=${encodeURIComponent(contactId)}`);
  },

  // ─── Travel Health Tips ─────────────────────────────────
  /**
   * Static on purpose. An async duplicate of this method used to sit earlier in
   * the same object literal, fetching /tourism/safety — which returns these
   * same strings as a literal array. JavaScript kept the later definition, so
   * the async one never ran; TypeScript resolved the earlier one, which is why
   * SafetyCenter appeared to call .map() on a Promise.
   *
   * General travel advice is editorial content, not data to fetch, so the
   * indirection bought nothing.
   */
  getHealthTips(): string[] {
    return [
      "Drink plenty of water in hot climates",
      "Carry a basic first-aid kit",
      "Know the location of the nearest hospital",
      "Keep emergency numbers saved in your phone",
      "Get travel insurance before international trips",
      "Check vaccination requirements for your destination",
      "Carry necessary medications with prescriptions",
      "Avoid street food if you have a sensitive stomach",
      "Use mosquito repellent in tropical areas",
      "Wear sunscreen even on cloudy days",
    ];
  },

  // ─── Safety Tips ────────────────────────────────────────
  getSafetyTips(): string[] {
    return [
      "Share your live location with family members",
      "Set up safe zones for children",
      "Enable SOS quick access on your phone",
      "Keep your phone charged when traveling",
      "Avoid isolated areas at night",
      "Keep copies of important documents",
      "Register with your embassy when traveling abroad",
      "Use official taxis and ride-sharing services",
      "Keep emergency cash in a separate place",
      "Trust your instincts — if it feels unsafe, leave",
    ];
  },
};
