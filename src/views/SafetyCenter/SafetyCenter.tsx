"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Crosshair,
  Heart,
  LifeBuoy,
  Loader2,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import {
  familySafetyService,
  distanceBetween,
  type ServerContact,
  type ServerSOSAlert,
} from "../../services/familySafetyService";
import { notify } from "../../services/notificationsService";
import type { HealthFacility, SafeZone } from "../../types/tourism";
import { useGeolocation } from "../../hooks/useGeolocation";

/** How often the open-alert state is re-read from the server. */
const SOS_POLL_MS = 15_000;
/** Move this far and the nearby-facility list is refetched. */
const REFRESH_DISTANCE_M = 750;

const relativeTime = (iso: string): string => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

const SafetyCenter = () => {
  const geo = useGeolocation();
  const { startWatching, stopWatching } = geo;
  const [activeTab, setActiveTab] = useState<"emergency" | "health" | "safety">("emergency");

  const [healthFacilities, setHealthFacilities] = useState<HealthFacility[]>([]);
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [healthLoading, setHealthLoading] = useState(false);

  const [showSOS, setShowSOS] = useState(false);
  const [sosMessage, setSosMessage] = useState("");
  const [sosSending, setSosSending] = useState(false);
  const [activeAlert, setActiveAlert] = useState<ServerSOSAlert | null>(null);
  const [standingDown, setStandingDown] = useState(false);

  const [contacts, setContacts] = useState<ServerContact[]>([]);
  const [contactsReady, setContactsReady] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactDraft, setContactDraft] = useState({ name: "", phone: "", relationship: "" });
  const [savingContact, setSavingContact] = useState(false);

  const [emergencyNumbers, setEmergencyNumbers] = useState<any[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [zoneName, setZoneName] = useState("");
  const [zoneRadius, setZoneRadius] = useState(300);

  // Ticks once a second purely so the "active for 4m 12s" readout counts up.
  const [, setClock] = useState(0);

  const coords = geo.coordinates;
  /** Where the facility list was last fetched, so we only refetch on real movement. */
  const lastFetchAt = useRef<{ latitude: number; longitude: number } | null>(null);
  const fetchInFlight = useRef(false);
  const sosUpdateInFlight = useRef(false);
  /** Which zones the user was inside on the previous fix — the edge detector. */
  const insideZones = useRef<Set<string>>(new Set());
  const zonesPrimed = useRef(false);

  // ─── Live GPS ────────────────────────────────────────────
  // The page previously never asked for a position at all, so `geo.coordinates`
  // stayed null and every location-dependent action failed with "Enable
  // location". Tracking starts on mount and stops on unmount.
  useEffect(() => {
    startWatching();
    return () => stopWatching();
  }, [startWatching, stopWatching]);

  useEffect(() => {
    const id = window.setInterval(() => setClock((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    familySafetyService.getEmergencyNumbers().then(setEmergencyNumbers).catch(() => {});
    setSafeZones(familySafetyService.getSafeZones());
  }, []);

  const safetyTips = familySafetyService.getSafetyTips();
  const healthTips = familySafetyService.getHealthTips();

  // ─── Live SOS status ─────────────────────────────────────
  const syncSOS = useCallback(async () => {
    try {
      const { active, contacts: rows } = await familySafetyService.getSOSStatus();
      setActiveAlert(active);
      setContacts(rows);
    } catch {
      // Signed out or offline — leave the last known state rather than
      // flashing "no alert", which would be a dangerous thing to imply.
    } finally {
      setContactsReady(true);
    }
  }, []);

  useEffect(() => {
    void syncSOS();
    const id = window.setInterval(() => void syncSOS(), SOS_POLL_MS);
    return () => window.clearInterval(id);
  }, [syncSOS]);

  // While an alert is open, keep pushing the newest position to it so
  // responders see where the person is now, not where they pressed the button.
  useEffect(() => {
    if (!activeAlert || !coords) return;
    const moved = distanceBetween(
      activeAlert.latitude,
      activeAlert.longitude,
      coords.latitude,
      coords.longitude,
    );
    if (moved < 50 || sosUpdateInFlight.current) return;
    sosUpdateInFlight.current = true;
    familySafetyService
      .raiseSOS({
        latitude: coords.latitude,
        longitude: coords.longitude,
        message: activeAlert.message ?? undefined,
      })
      .then(setActiveAlert)
      .catch(() => {})
      .finally(() => {
        sosUpdateInFlight.current = false;
      });
  }, [activeAlert, coords]);

  // ─── Live nearby facilities ──────────────────────────────
  const loadHealthFacilities = useCallback(
    async (latitude: number, longitude: number, filter: string) => {
      // The GPS watch emits a new fix every second or so, and this request
      // takes 1-2s. Without the in-flight guard — and without claiming the
      // position *before* awaiting — every fix that lands mid-request starts
      // another one, so a single page load fired four identical searches.
      if (fetchInFlight.current) return;
      fetchInFlight.current = true;
      lastFetchAt.current = { latitude, longitude };
      setHealthLoading(true);
      try {
        const facilities = await familySafetyService.getNearbyHealthFacilities(
          latitude,
          longitude,
          filter,
        );
        const withDistance = facilities
          .map((f) => ({
            ...f,
            distance: distanceBetween(latitude, longitude, f.latitude, f.longitude),
          }))
          .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
        setHealthFacilities(withDistance);
      } catch {
        // Let the next movement retry rather than pinning the stale position.
        lastFetchAt.current = null;
        toast.error("Could not load nearby facilities.");
      } finally {
        fetchInFlight.current = false;
        setHealthLoading(false);
      }
    },
    [],
  );

  // Auto-load on first fix, then refetch whenever the user has actually moved.
  useEffect(() => {
    if (!coords) return;
    const previous = lastFetchAt.current;
    const movedFar =
      !previous ||
      distanceBetween(previous.latitude, previous.longitude, coords.latitude, coords.longitude) >
        REFRESH_DISTANCE_M;
    if (movedFar) void loadHealthFacilities(coords.latitude, coords.longitude, healthFilter);
  }, [coords, healthFilter, loadHealthFacilities]);

  // Changing the filter is an explicit request — refetch immediately.
  useEffect(() => {
    if (!coords) return;
    void loadHealthFacilities(coords.latitude, coords.longitude, healthFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthFilter]);

  // ─── Live geofencing ─────────────────────────────────────
  // Real entry/exit detection off the GPS watch. The first fix only primes the
  // "currently inside" set — without that, opening the page inside a zone would
  // immediately announce an arrival that never happened.
  useEffect(() => {
    if (!coords || safeZones.length === 0) return;

    const nowInside = new Set<string>();
    for (const zone of safeZones) {
      const metres = distanceBetween(coords.latitude, coords.longitude, zone.latitude, zone.longitude);
      if (metres <= zone.radius) nowInside.add(zone.id);
    }

    if (!zonesPrimed.current) {
      insideZones.current = nowInside;
      zonesPrimed.current = true;
      return;
    }

    for (const zone of safeZones) {
      const was = insideZones.current.has(zone.id);
      const is = nowInside.has(zone.id);
      if (!was && is && zone.notifyOnEntry) {
        toast.success(`Arrived at ${zone.name}`);
        notify("Arrived at a safe zone", `You entered ${zone.name}.`);
      } else if (was && !is && zone.notifyOnExit) {
        toast(`Left ${zone.name}`, { icon: "🚶" });
        notify("Left a safe zone", `You left ${zone.name}.`);
      }
    }

    insideZones.current = nowInside;
  }, [coords, safeZones]);

  const zonesWithDistance = useMemo(
    () =>
      safeZones.map((zone) => ({
        zone,
        metres: coords
          ? distanceBetween(coords.latitude, coords.longitude, zone.latitude, zone.longitude)
          : null,
      })),
    [safeZones, coords],
  );

  // ─── Actions ─────────────────────────────────────────────
  const handleSOS = async () => {
    if (!coords) {
      toast.error("Waiting for a GPS fix — SOS needs your location.");
      return;
    }
    setSosSending(true);
    try {
      const alert = await familySafetyService.raiseSOS({
        latitude: coords.latitude,
        longitude: coords.longitude,
        message: sosMessage.trim() || undefined,
      });
      setActiveAlert(alert);
      setShowSOS(false);
      setSosMessage("");
      toast.success("SOS raised. It stays active until you stand down.");
      notify("SOS raised", "Your emergency alert is active and sharing your live location.");
      void syncSOS();
    } catch (error) {
      toast.error((error as Error).message || "Could not raise the alert. Call emergency services directly.");
    } finally {
      setSosSending(false);
    }
  };

  const handleStandDown = async () => {
    setStandingDown(true);
    try {
      await familySafetyService.resolveSOS();
      setActiveAlert(null);
      toast.success("Alert stood down.");
      notify("SOS resolved", "Your emergency alert was marked resolved.");
    } catch (error) {
      toast.error((error as Error).message || "Could not stand down the alert.");
    } finally {
      setStandingDown(false);
    }
  };

  const locationLine = coords
    ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
    : null;

  const mapsLink = coords
    ? `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`
    : null;

  /**
   * The app cannot deliver an SMS itself. Rather than claim it did, this hands
   * off to the phone's own messaging app with the text prefilled — the user
   * presses send, so delivery is real and visible to them.
   */
  const messageContact = (contact: ServerContact) => {
    if (!mapsLink) {
      toast.error("Waiting for a GPS fix.");
      return;
    }
    const body = encodeURIComponent(
      `${sosMessage.trim() || "Emergency! I need help."} My location: ${mapsLink}`,
    );
    window.location.href = `sms:${contact.phone}?&body=${body}`;
  };

  const shareLocation = async () => {
    if (!mapsLink || !locationLine) {
      toast.error("Waiting for a GPS fix.");
      return;
    }
    const payload = { title: "My live location", text: `I'm at ${locationLine}`, url: mapsLink };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
      await navigator.clipboard.writeText(mapsLink);
      toast.success("Location link copied to clipboard.");
    } catch {
      // Share sheet dismissed — not an error worth reporting.
    }
  };

  const addContact = async () => {
    if (!contactDraft.name.trim() || !contactDraft.phone.trim()) {
      toast.error("A name and phone number are required.");
      return;
    }
    setSavingContact(true);
    try {
      await familySafetyService.saveEmergencyContact({
        name: contactDraft.name.trim(),
        phone: contactDraft.phone.trim(),
        relationship: contactDraft.relationship.trim() || undefined,
        isPrimary: contacts.length === 0,
      });
      setContactDraft({ name: "", phone: "", relationship: "" });
      setShowContactForm(false);
      toast.success("Contact saved.");
      void syncSOS();
    } catch (error) {
      toast.error((error as Error).message || "Could not save the contact.");
    } finally {
      setSavingContact(false);
    }
  };

  const removeContact = async (contact: ServerContact) => {
    try {
      await familySafetyService.deleteEmergencyContact(contact.id);
      setContacts((current) => current.filter((c) => c.id !== contact.id));
      toast.success(`Removed ${contact.name}.`);
    } catch (error) {
      toast.error((error as Error).message || "Could not remove the contact.");
    }
  };

  const addSafeZone = () => {
    if (!coords) {
      toast.error("Waiting for a GPS fix.");
      return;
    }
    if (!zoneName.trim()) {
      toast.error("Give the zone a name.");
      return;
    }
    const zone: SafeZone = {
      id: crypto.randomUUID(),
      name: zoneName.trim(),
      latitude: coords.latitude,
      longitude: coords.longitude,
      radius: zoneRadius,
      type: "custom",
      notifyOnEntry: true,
      notifyOnExit: true,
    };
    setSafeZones(familySafetyService.addSafeZone(zone));
    // Re-prime so the zone we're standing in doesn't fire an instant arrival.
    zonesPrimed.current = false;
    setZoneName("");
    toast.success(`"${zone.name}" is now being watched.`);
  };

  const removeSafeZone = (zoneId: string) => {
    setSafeZones(familySafetyService.deleteSafeZone(zoneId));
    insideZones.current.delete(zoneId);
  };

  return (
    <section className="nexus-page nexus-page-body">
      <div className="nexus-container">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <p className="nexus-eyebrow">Family Safety Center</p>
          <h1 className="text-hero-display mt-4 text-5xl sm:text-6xl">
            <span className="nexus-gradient-text">Stay Safe</span>, Stay Connected
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-slate-400">
            Live location, emergency contacts, nearby health facilities and SOS alerts — all in one place.
          </p>
        </motion.div>

        {/* Live GPS status — the whole page depends on this, so it is stated
            plainly rather than left for a failed action to reveal. */}
        <div className="mt-8 flex justify-center">
          <div className="nexus-card flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
            {coords ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="font-medium text-white">Live location active</span>
                <span className="tabular-nums text-slate-400">{locationLine}</span>
                {coords.accuracy != null && (
                  <span className="text-slate-500">±{Math.round(coords.accuracy)} m</span>
                )}
              </>
            ) : (
              <>
                <Loader2 size={15} className="animate-spin text-slate-400" />
                <span className="text-slate-300">
                  {geo.error || "Acquiring your location…"}
                </span>
                {geo.error && (
                  <button onClick={() => void geo.getCurrentLocation()} className="nexus-button-sm nexus-button-secondary">
                    Retry
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Active alert banner — persistent, with a live timer, so an open
            alert can never be forgotten about. */}
        {activeAlert && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="nexus-card-premium mt-6 border-[#ff453a]/40 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldAlert size={26} className="animate-pulse text-[#ff453a]" />
                <div>
                  <p className="font-semibold text-white">
                    SOS active for {relativeTime(activeAlert.createdAt)}
                  </p>
                  <p className="text-sm text-slate-400">
                    Sharing {activeAlert.latitude.toFixed(5)}, {activeAlert.longitude.toFixed(5)} — updates as you move.
                  </p>
                </div>
              </div>
              <button onClick={() => void handleStandDown()} disabled={standingDown} className="nexus-button-secondary">
                <ShieldCheck size={16} />
                {standingDown ? "Standing down…" : "I'm safe — stand down"}
              </button>
            </div>

            {contacts.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Alert your contacts
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {contacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => messageContact(contact)}
                      className="nexus-button-sm nexus-button-glossy"
                    >
                      <Phone size={14} /> Text {contact.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* SOS Button */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setShowSOS(true)}
            className="group relative inline-flex items-center gap-3 rounded-full bg-gradient-to-b from-[#ff6a60] to-[#ff453a] px-8 py-4 text-lg font-semibold text-white shadow-[0_12px_40px_rgba(255,69,58,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all duration-300 hover:shadow-[0_16px_50px_rgba(255,69,58,0.5)]"
          >
            <ShieldAlert size={24} className="animate-pulse" />
            {activeAlert ? "Update SOS" : "SOS Emergency"}
          </button>
          <button onClick={() => void shareLocation()} disabled={!coords} className="nexus-button-secondary">
            <Share2 size={16} /> Share live location
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
                className="nexus-card-elevated flex cursor-pointer items-center gap-3 p-4 hover:border-red-400/30"
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
            { id: "safety", label: "Safe Zones & Tips", icon: AlertTriangle },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
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
              {/* SOS composer */}
              {showSOS && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="nexus-card-cinematic border-[#ff453a]/25 p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="text-[#ff453a]" size={28} />
                      <h3 className="text-2xl font-bold text-white">Send SOS Alert</h3>
                    </div>
                    <button onClick={() => setShowSOS(false)} aria-label="Close" className="text-slate-400 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>
                  <p className="mt-2 text-slate-400">
                    {coords
                      ? `Your position (${locationLine}) is attached and keeps updating while the alert is open.`
                      : "Waiting for a GPS fix — the alert needs a location."}
                  </p>
                  <textarea
                    value={sosMessage}
                    onChange={(e) => setSosMessage(e.target.value)}
                    placeholder="Optional: Add a message about your emergency…"
                    className="nexus-input mt-4"
                    rows={3}
                  />
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => void handleSOS()}
                      disabled={sosSending || !coords}
                      className="nexus-button-danger flex-1"
                    >
                      {sosSending ? "Sending…" : activeAlert ? "Update SOS" : "Send SOS Now"}
                    </button>
                    <button onClick={() => setShowSOS(false)} className="nexus-button-glossy px-6">
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Emergency Contacts — real rows from the database */}
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Emergency Contacts</h3>
                  <button onClick={() => setShowContactForm((v) => !v)} className="nexus-button-sm nexus-button-secondary">
                    <Plus size={15} /> Add contact
                  </button>
                </div>

                {showContactForm && (
                  <div className="nexus-card mt-3 grid gap-3 p-4 sm:grid-cols-3">
                    <input
                      value={contactDraft.name}
                      onChange={(e) => setContactDraft({ ...contactDraft, name: e.target.value })}
                      placeholder="Name"
                      className="nexus-input"
                    />
                    <input
                      value={contactDraft.phone}
                      onChange={(e) => setContactDraft({ ...contactDraft, phone: e.target.value })}
                      placeholder="Phone number"
                      type="tel"
                      inputMode="tel"
                      className="nexus-input"
                    />
                    <input
                      value={contactDraft.relationship}
                      onChange={(e) => setContactDraft({ ...contactDraft, relationship: e.target.value })}
                      placeholder="Relationship (optional)"
                      className="nexus-input"
                    />
                    <div className="sm:col-span-3">
                      <button onClick={() => void addContact()} disabled={savingContact} className="nexus-button-primary">
                        {savingContact ? "Saving…" : "Save contact"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="nexus-card-elevated flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-semibold text-white">
                          {contact.name}
                          {contact.isPrimary === 1 && (
                            <span className="rounded-full bg-[#0a84ff]/20 px-2 py-0.5 text-[11px] font-medium text-[#9addff]">
                              Primary
                            </span>
                          )}
                        </p>
                        <p className="truncate text-sm text-slate-400">
                          {contact.phone}
                          {contact.relationship ? ` · ${contact.relationship}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <a href={`tel:${contact.phone}`} aria-label={`Call ${contact.name}`} className="nexus-button-sm nexus-button-glossy">
                          <Phone size={14} />
                        </a>
                        <button
                          onClick={() => void removeContact(contact)}
                          aria-label={`Remove ${contact.name}`}
                          className="nexus-button-sm nexus-button-danger-quiet"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {contactsReady && contacts.length === 0 && (
                    <div className="nexus-card-elevated col-span-full p-5 text-center text-slate-400">
                      <Users className="mx-auto" size={32} />
                      <p className="mt-2">
                        No emergency contacts saved yet. Add one so an SOS has someone to reach.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick actions — only the ones that genuinely do something. */}
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => void shareLocation()}
                  disabled={!coords}
                  className="nexus-card-elevated flex items-center gap-3 p-4 text-left hover:border-cyan-400/20"
                >
                  <Share2 className="text-cyan-400" size={20} />
                  <span>
                    <span className="block text-sm font-medium text-white">Share live location</span>
                    <span className="block text-xs text-slate-400">Send your position to anyone</span>
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("safety")}
                  className="nexus-card-elevated flex items-center gap-3 p-4 text-left hover:border-emerald-400/20"
                >
                  <Bell className="text-emerald-400" size={20} />
                  <span>
                    <span className="block text-sm font-medium text-white">Arrival alerts</span>
                    <span className="block text-xs text-slate-400">
                      {safeZones.length > 0 ? `${safeZones.length} zone(s) being watched` : "Set up a safe zone"}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Health Tab */}
          {activeTab === "health" && (
            <div>
              <div className="flex flex-wrap items-center gap-3">
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
                <button
                  onClick={() => coords && void loadHealthFacilities(coords.latitude, coords.longitude, healthFilter)}
                  disabled={!coords || healthLoading}
                  className="nexus-button-secondary"
                >
                  <RefreshCw size={16} className={healthLoading ? "animate-spin" : ""} />
                  {healthLoading ? "Searching…" : "Refresh"}
                </button>
                {coords && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Crosshair size={13} /> Auto-updates as you move
                  </span>
                )}
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
                    {facility.distance != null && (
                      <p className="text-xs tabular-nums text-slate-500">
                        {facility.distance < 1000
                          ? `${Math.round(facility.distance)} m away`
                          : `${(facility.distance / 1000).toFixed(1)} km away`}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      {/* TomTom does not return a number for every POI. A
                          `tel:` link with nothing after it looks tappable and
                          silently does nothing, which is the wrong failure in
                          an emergency — so say it's unlisted instead. */}
                      {facility.phone ? (
                        <a href={`tel:${facility.phone}`} className="nexus-button-glossy nexus-button-sm flex-1">
                          <Phone size={14} /> {facility.phone}
                        </a>
                      ) : (
                        <span className="flex-1 self-center text-xs text-slate-500">
                          No phone number listed
                        </span>
                      )}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="nexus-button-sm nexus-button-secondary"
                      >
                        <MapPin size={14} /> Directions
                      </a>
                    </div>
                  </div>
                ))}

                {healthFacilities.length === 0 && (
                  <div className="nexus-card-elevated col-span-full p-8 text-center text-slate-400">
                    {healthLoading ? (
                      <>
                        <Loader2 className="mx-auto animate-spin" size={36} />
                        <p className="mt-3">Searching around you…</p>
                      </>
                    ) : (
                      <>
                        <Stethoscope className="mx-auto" size={36} />
                        <p className="mt-3">
                          {coords
                            ? "Nothing found nearby. Try a different facility type."
                            : "Waiting for your location to search nearby."}
                        </p>
                      </>
                    )}
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

          {/* Safe Zones & Tips */}
          {activeTab === "safety" && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Live geofencing */}
              <div className="nexus-card-elevated p-6 lg:col-span-2">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <MapPin size={18} className="text-emerald-400" />
                  Safe Zones
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  A zone is a circle around a point. While this page is open your GPS is watched, and
                  you get an alert the moment you cross in or out of one.
                </p>

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="flex-1 min-w-[200px]">
                    <span className="mb-1 block text-xs font-medium text-slate-400">Zone name</span>
                    <input
                      value={zoneName}
                      onChange={(e) => setZoneName(e.target.value)}
                      placeholder="Home, School, Hotel…"
                      className="nexus-input"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-slate-400">Radius</span>
                    <select
                      value={zoneRadius}
                      onChange={(e) => setZoneRadius(Number(e.target.value))}
                      className="nexus-input"
                    >
                      <option value={100}>100 m</option>
                      <option value={300}>300 m</option>
                      <option value={500}>500 m</option>
                      <option value={1000}>1 km</option>
                    </select>
                  </label>
                  <button onClick={addSafeZone} disabled={!coords} className="nexus-button-primary">
                    <Plus size={16} /> Add at my location
                  </button>
                </div>

                <div className="mt-5 space-y-2">
                  {zonesWithDistance.map(({ zone, metres }) => {
                    const inside = metres != null && metres <= zone.radius;
                    return (
                      <div
                        key={zone.id}
                        className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium text-white">
                            {zone.name}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                inside
                                  ? "bg-emerald-400/15 text-emerald-300"
                                  : "bg-white/10 text-slate-400"
                              }`}
                            >
                              {metres == null ? "waiting for GPS" : inside ? "Inside" : "Outside"}
                            </span>
                          </p>
                          <p className="text-xs tabular-nums text-slate-500">
                            {zone.radius} m radius
                            {metres != null &&
                              ` · ${metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`} from you`}
                          </p>
                        </div>
                        <button
                          onClick={() => removeSafeZone(zone.id)}
                          aria-label={`Remove ${zone.name}`}
                          className="nexus-button-sm nexus-button-danger-quiet"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}

                  {safeZones.length === 0 && (
                    <p className="rounded-[18px] border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-500">
                      No zones yet. Add one at your current location to start getting arrival and
                      departure alerts.
                    </p>
                  )}
                </div>
              </div>

              <div className="nexus-card-elevated p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
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
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <LifeBuoy size={18} className="text-purple-400" />
                  How alerts reach people
                </h3>
                <p className="mt-3 text-sm text-slate-400">
                  Raising an SOS records a live alert that keeps tracking your position and stays open
                  until you stand down. Nexus Map cannot send an SMS on your behalf — the
                  <span className="text-slate-300"> Text </span> buttons open your phone's own
                  messaging app with your location prefilled, so you can see exactly what goes out.
                </p>
                <p className="mt-3 text-sm text-slate-400">
                  For life-threatening emergencies, always call the numbers above first.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SafetyCenter;
