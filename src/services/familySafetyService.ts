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
  async getSafetyTips(): Promise<string[]> {
    try {
      const data = await api.get<{ numbers: any[]; safetyTips: string[]; healthTips: string[] }>("/tourism/safety?type=emergency");
      return data.safetyTips;
    } catch {
      return [];
    }
  },

  // ─── Health Tips ────────────────────────────────────────
  async getHealthTips(): Promise<string[]> {
    try {
      const data = await api.get<{ numbers: any[]; safetyTips: string[]; healthTips: string[] }>("/tourism/safety?type=emergency");
      return data.healthTips;
    } catch {
      return [];
    }
  },

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
  async getSafeZones(userId: string): Promise<SafeZone[]> {
    const stored = localStorage.getItem(`nexus-safe-zones-${userId}`);
    if (stored) return JSON.parse(stored);
    return [];
  },

  async saveSafeZone(userId: string, zone: SafeZone): Promise<void> {
    const zones = await this.getSafeZones(userId);
    zones.push(zone);
    localStorage.setItem(`nexus-safe-zones-${userId}`, JSON.stringify(zones));
  },

  async deleteSafeZone(zoneId: string): Promise<void> {
    // In production, delete from backend
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
  async sendSOS(alert: Omit<SOSAlert, "id" | "status" | "createdAt">): Promise<SOSAlert> {
    const fullAlert: SOSAlert = {
      ...alert,
      id: crypto.randomUUID(),
      status: "active",
      createdAt: new Date().toISOString(),
    };

    // In production, send SMS/email/push to emergency contacts
    if (typeof window !== "undefined") {
      // Send to stored emergency contacts
      const contacts = await this.getEmergencyContacts(alert.userId);
      contacts.forEach((contact) => {
        // SMS/messaging integration placeholder
        console.log(`SOS sent to ${contact.name} at ${contact.phone}`);
      });
    }

    return fullAlert;
  },

  async resolveSOS(alertId: string): Promise<void> {
    // In production, update backend
  },

  // ─── Emergency Contacts ─────────────────────────────────
  async getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
    const stored = localStorage.getItem(`nexus-emergency-contacts-${userId}`);
    if (stored) return JSON.parse(stored);
    return [
      { id: "ec1", name: "Home", phone: "+92-XXX-XXXXXXX", relationship: "Family", isPrimary: true },
    ];
  },

  async saveEmergencyContact(contact: EmergencyContact): Promise<void> {
    // In production, sync to backend
  },

  async deleteEmergencyContact(contactId: string): Promise<void> {
    // In production, delete from backend
  },

  // ─── Travel Health Tips ─────────────────────────────────
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
