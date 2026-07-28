"use client";
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Bell,
  Heart,
  LifeBuoy,
  MapPin,
  Phone,
  Plus,
  Shield,
  ShieldAlert,
  Smartphone,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { familySafetyService } from "../../services/familySafetyService";
import type {
  EmergencyContact,
  HealthFacility,
  WeatherAlert,
  SafeZone,
  SOSAlert,
} from "../../types/tourism";
import { useGeolocation } from "../../hooks/useGeolocation";

const SafetyCenter = () => {
  const geo = useGeolocation();
  const [activeTab, setActiveTab] = useState<"emergency" | "health" | "safety">("emergency");
  const [healthFacilities, setHealthFacilities] = useState<HealthFacility[]>([]);
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [showSOS, setShowSOS] = useState(false);
  const [sosMessage, setSosMessage] = useState("");
  const [sosSending, setSosSending] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [emergencyNumbers, setEmergencyNumbers] = useState<any[]>([]);

  // Emergency numbers (async — loaded from API)
  useEffect(() => {
    familySafetyService.getEmergencyNumbers().then(setEmergencyNumbers).catch(() => {});
  }, []);

  const safetyTips = familySafetyService.getSafetyTips();
  const healthTips = familySafetyService.getHealthTips();

  // Load health facilities
  const loadHealthFacilities = async () => {
    if (!geo.coordinates) {
      toast.error("Enable location to find nearby facilities");
      return;
    }
    const facilities = await familySafetyService.getNearbyHealthFacilities(
      geo.coordinates.latitude,
      geo.coordinates.longitude,
      healthFilter
    );
    setHealthFacilities(facilities);
  };

  // SOS Handler
  const handleSOS = async () => {
    if (!geo.coordinates) {
      toast.error("Enable location for SOS to work");
      return;
    }
    setSosSending(true);
    try {
      await familySafetyService.sendSOS({
        userId: "current-user",
        latitude: geo.coordinates.latitude,
        longitude: geo.coordinates.longitude,
        message: sosMessage || "Emergency! I need help.",
        notifiedContacts: contacts.map((c) => c.id),
      });
      toast.success("SOS sent to your emergency contacts!");
      setShowSOS(false);
      setSosMessage("");
    } catch {
      toast.error("Failed to send SOS. Try calling emergency services directly.");
    } finally {
      setSosSending(false);
    }
  };

  return (
    <section className="nexus-page nexus-page-body">
      <div className="nexus-container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="nexus-eyebrow">Family Safety Center</p>
          <h1 className="text-hero-display mt-4 text-5xl sm:text-6xl">
            <span className="nexus-gradient-text">Stay Safe</span>, Stay Connected
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-slate-400">
            Emergency contacts, nearby health facilities, safety tips, and SOS alerts — all in one place.
          </p>
        </motion.div>

        {/* SOS Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setShowSOS(true)}
            className="group relative inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-red-500 to-red-600 px-8 py-4 text-lg font-bold text-white shadow-[0_0_40px_rgba(239,68,68,0.3)] transition-all duration-300 hover:shadow-[0_0_60px_rgba(239,68,68,0.5)] hover:scale-105"
          >
            <ShieldAlert size={24} className="animate-pulse" />
            SOS Emergency
          </button>
        </div>

        {/* Emergency Numbers */}
        <div className="mt-10">
          <h2 className="text-2xl font-bold text-white">Emergency Numbers</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {emergencyNumbers.map((item) => (
              <a
                key={item.name}
                href={`tel:${item.number}`}
                className="nexus-card-elevated flex items-center gap-3 p-4 cursor-pointer hover:border-red-400/30"
              >
                <div className="rounded-full bg-red-400/10 p-2.5 text-red-300">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{item.name}</p>
                  <p className="text-lg font-bold text-red-300">{item.number}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-10 flex gap-2 border-b border-white/[0.06] pb-2">
          {[
            { id: "emergency", label: "Emergency", icon: Shield },
            { id: "health", label: "Health Facilities", icon: Stethoscope },
            { id: "safety", label: "Safety Tips", icon: AlertTriangle },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`inline-flex items-center gap-2 rounded-t-xl px-5 py-3 text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-white/[0.04] text-cyan-300 border-t border-l border-r border-white/[0.06]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {/* Emergency Tab */}
          {activeTab === "emergency" && (
            <div className="space-y-6">
              {/* SOS Modal */}
              {showSOS && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="nexus-card-cinematic p-6 border-red-400/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="text-red-400" size={28} />
                      <h3 className="text-2xl font-bold text-white">Send SOS Alert</h3>
                    </div>
                    <button onClick={() => setShowSOS(false)} className="text-slate-400 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>
                  <p className="mt-2 text-slate-400">Your location will be shared with your emergency contacts.</p>
                  <textarea
                    value={sosMessage}
                    onChange={(e) => setSosMessage(e.target.value)}
                    placeholder="Optional: Add a message about your emergency..."
                    className="nexus-input mt-4"
                    rows={3}
                  />
                  <div className="mt-4 flex gap-3">
                    <button onClick={handleSOS} disabled={sosSending} className="nexus-button-primary bg-gradient-to-r from-red-500 to-red-600 text-white flex-1 py-4">
                      {sosSending ? "Sending..." : "Send SOS Now"}
                    </button>
                    <button onClick={() => setShowSOS(false)} className="nexus-button-glossy px-6">
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Emergency Contacts */}
              <div>
                <h3 className="text-lg font-semibold text-white">Emergency Contacts</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {contacts.length === 0 && (
                    <div className="nexus-card-elevated p-5 text-center text-slate-400 col-span-full">
                      <Users className="mx-auto" size={32} />
                      <p className="mt-2">No emergency contacts saved yet.</p>
                      <button className="nexus-button-glossy mt-3">
                        <Plus size={16} /> Add Contact
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button className="nexus-card-elevated flex items-center gap-3 p-4 hover:border-cyan-400/20">
                  <LifeBuoy className="text-cyan-400" size={20} />
                  <span className="text-sm font-medium text-white">Share Location</span>
                </button>
                <button className="nexus-card-elevated flex items-center gap-3 p-4 hover:border-emerald-400/20">
                  <Bell className="text-emerald-400" size={20} />
                  <span className="text-sm font-medium text-white">Arrival Alert</span>
                </button>
                <button className="nexus-card-elevated flex items-center gap-3 p-4 hover:border-purple-400/20">
                  <Smartphone className="text-purple-400" size={20} />
                  <span className="text-sm font-medium text-white">Lost Phone Mode</span>
                </button>
                <button className="nexus-card-elevated flex items-center gap-3 p-4 hover:border-amber-400/20">
                  <Heart className="text-amber-400" size={20} />
                  <span className="text-sm font-medium text-white">Medical Info</span>
                </button>
              </div>
            </div>
          )}

          {/* Health Tab */}
          {activeTab === "health" && (
            <div>
              <div className="flex items-center gap-3">
                <select
                  value={healthFilter}
                  onChange={(e) => setHealthFilter(e.target.value)}
                  className="nexus-input max-w-xs"
                >
                  <option value="all">All Facilities</option>
                  <option value="hospital">Hospitals</option>
                  <option value="clinic">Clinics</option>
                  <option value="pharmacy">Pharmacies</option>
                  <option value="blood_bank">Blood Banks</option>
                  <option value="emergency">Emergency Only</option>
                </select>
                <button onClick={loadHealthFacilities} className="nexus-button-primary">
                  <MapPin size={16} /> Find Nearby
                </button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {healthFacilities.map((facility) => (
                  <div key={facility.id} className="nexus-card-elevated p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-cyan-400/10 p-2 text-cyan-300">
                          <Stethoscope size={18} />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{facility.name}</p>
                          <p className="text-xs capitalize text-slate-400">{facility.type}</p>
                        </div>
                      </div>
                      {facility.emergency && (
                        <span className="rounded-full bg-red-400/10 px-2 py-0.5 text-xs text-red-300">Emergency</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{facility.address}</p>
                    {facility.distance && (
                      <p className="text-xs text-slate-500">{Math.round(facility.distance / 1000)} km away</p>
                    )}
                    <a href={`tel:${facility.phone}`} className="nexus-button-glossy mt-3 w-full text-sm py-2.5">
                      <Phone size={14} /> {facility.phone}
                    </a>
                  </div>
                ))}
                {healthFacilities.length === 0 && (
                  <div className="nexus-card-elevated col-span-full p-8 text-center text-slate-400">
                    <Stethoscope className="mx-auto" size={36} />
                    <p className="mt-3">Click "Find Nearby" to discover health facilities near you.</p>
                  </div>
                )}
              </div>

              {/* Health Tips */}
              <div className="nexus-card-elevated mt-6 p-6">
                <h3 className="text-lg font-semibold text-white">Travel Health Tips</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {healthTips.map((tip) => (
                    <p key={tip} className="flex items-start gap-2 text-sm text-slate-300">
                      <Heart size={14} className="mt-0.5 shrink-0 text-cyan-400" />
                      {tip}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Safety Tab */}
          {activeTab === "safety" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="nexus-card-elevated p-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Shield size={18} className="text-emerald-400" />
                  Personal Safety Tips
                </h3>
                <div className="mt-4 space-y-3">
                  {safetyTips.map((tip) => (
                    <p key={tip} className="flex items-start gap-2 text-sm text-slate-300">
                      <Shield size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                      {tip}
                    </p>
                  ))}
                </div>
              </div>

              <div className="nexus-card-elevated p-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-400" />
                  Safe Zones
                </h3>
                <p className="mt-3 text-sm text-slate-400">
                  Set up safe zones for your family members. Get notified when they arrive or leave.
                </p>
                <button className="nexus-button-glossy mt-4">
                  <Plus size={16} /> Add Safe Zone
                </button>
              </div>

              <div className="nexus-card-elevated p-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users size={18} className="text-cyan-400" />
                  Family Tracking
                </h3>
                <p className="mt-3 text-sm text-slate-400">
                  Track family members in real-time and receive arrival notifications.
                </p>
                <button className="nexus-button-primary mt-4">
                  <Users size={16} /> Start Tracking
                </button>
              </div>

              <div className="nexus-card-elevated p-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <LifeBuoy size={18} className="text-purple-400" />
                  Emergency Kit
                </h3>
                <p className="mt-3 text-sm text-slate-400">
                  Prepare a digital emergency kit with documents, medical info, and contacts.
                </p>
                <button className="nexus-button-glossy mt-4">
                  <Plus size={16} /> Prepare Kit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SafetyCenter;
