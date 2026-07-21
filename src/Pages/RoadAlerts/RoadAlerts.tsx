import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LocateFixed,
  MapPin,
  RefreshCw,
  ShieldCheck,
  ThumbsUp,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "../../hooks/useAuth";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useInternetStatus } from "../../hooks/useInternetStatus";
import { roadAlertsService } from "../../services/roadAlertsService";
import {
  ALERT_LABELS,
  ALERT_TYPES,
  SEVERITY_META,
  SOURCE_LABELS,
  type AlertSeverity,
  type RoadAlert,
  type RoadAlertType,
} from "../../types/roadAlerts";

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

const RoadAlerts = () => {
  const { user } = useAuth();
  const geo = useGeolocation();
  const online = useInternetStatus();

  const [alerts, setAlerts] = useState<RoadAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showReport, setShowReport] = useState(false);
  const [form, setForm] = useState<{ type: RoadAlertType; description: string; severity: AlertSeverity }>({
    type: "accident",
    description: "",
    severity: "medium",
  });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      setError("");
      const { alerts: data, live: isLive } = await roadAlertsService.list({
        severity: filterSeverity || undefined,
        status: filterStatus || undefined,
      });
      setAlerts(data);
      setLive(isLive);
      setLastUpdated(new Date());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load road alerts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSeverity, filterStatus]);

  // Polling fallback (Realtime-ready): refresh while online.
  useEffect(() => {
    if (!online) return;
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, filterSeverity, filterStatus]);

  const active = useMemo(() => alerts.filter((a) => a.status !== "resolved"), [alerts]);
  const critical = useMemo(() => active.filter((a) => a.severity === "critical" || a.severity === "high"), [active]);

  const submitReport = async () => {
    if (!user) {
      toast.error("Please sign in to report a hazard.");
      return;
    }
    if (form.description.trim().length < 5) {
      toast.error("Add a short description (5+ characters).");
      return;
    }
    if (!geo.coordinates) {
      toast.error("Tap “Use my location” first to attach GPS coordinates.");
      return;
    }
    try {
      setSubmitting(true);
      await roadAlertsService.report({
        type: form.type,
        description: form.description.trim(),
        severity: form.severity,
        latitude: geo.coordinates.latitude,
        longitude: geo.coordinates.longitude,
      });
      toast.success("Road hazard reported. Thank you!");
      setShowReport(false);
      setForm({ type: "accident", description: "", severity: "medium" });
      await load();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Unable to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  const act = async (id: string, action: "confirm" | "resolve") => {
    if (!user) {
      toast.error("Please sign in to respond to alerts.");
      return;
    }
    try {
      setBusyId(id);
      if (action === "confirm") await roadAlertsService.confirm(id);
      else await roadAlertsService.resolve(id);
      await load();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="nexus-page px-4 py-14 sm:px-6 lg:px-8">
      <div className="nexus-container">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="nexus-eyebrow">Live road intelligence</p>
            <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
              Road <span className="nexus-gradient-text">Alerts & Conditions</span>
            </h1>
            <p className="mt-4 max-w-2xl text-slate-400">
              Community-reported and monitored hazards near you. Confirm what's still active or mark issues resolved.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowReport((value) => !value)}
            className="nexus-button-primary w-fit"
          >
            <TriangleAlert size={18} />
            Report a hazard
          </button>
        </div>

        {/* Status strip */}
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
              online ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-300"
            }`}
          >
            {online ? <RefreshCw size={14} /> : <WifiOff size={14} />}
            {live ? "Live" : "Offline — showing cached alerts"}
          </span>
          <span className="text-slate-500">{active.length} active</span>
          {critical.length > 0 && <span className="text-red-300">{critical.length} high/critical</span>}
          {lastUpdated && (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Clock3 size={13} /> Updated {relativeTime(lastUpdated.toISOString())}
            </span>
          )}
        </div>

        {/* Report form */}
        {showReport && (
          <div className="nexus-card mt-6 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-400">Hazard type</span>
                <select
                  value={form.type}
                  onChange={(event) => setForm((f) => ({ ...f, type: event.target.value as RoadAlertType }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3.5 outline-none"
                >
                  {ALERT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ALERT_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-400">Severity</span>
                <select
                  value={form.severity}
                  onChange={(event) => setForm((f) => ({ ...f, severity: event.target.value as AlertSeverity }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3.5 outline-none"
                >
                  {(["low", "medium", "high", "critical"] as AlertSeverity[]).map((s) => (
                    <option key={s} value={s}>
                      {SEVERITY_META[s].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <textarea
              value={form.description}
              onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
              rows={3}
              placeholder="Describe the hazard and its exact spot..."
              className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 outline-none"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={geo.getCurrentLocation}
                className="nexus-button-secondary"
              >
                <LocateFixed size={17} />
                {geo.loading ? "Locating…" : geo.coordinates ? "Location attached" : "Use my location"}
              </button>
              {geo.coordinates && (
                <span className="text-xs text-slate-500">
                  {geo.coordinates.latitude.toFixed(4)}, {geo.coordinates.longitude.toFixed(4)}
                </span>
              )}
              <button
                type="button"
                onClick={() => void submitReport()}
                disabled={submitting}
                className="nexus-button-primary ml-auto"
              >
                {submitting ? <LoaderCircle size={17} className="animate-spin" /> : <TriangleAlert size={17} />}
                Submit report
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mt-6 flex flex-wrap gap-2">
          {["", "critical", "high", "medium", "low"].map((s) => (
            <button
              key={s || "all-sev"}
              type="button"
              onClick={() => setFilterSeverity(s)}
              className={`rounded-full border px-4 py-2 text-xs ${
                filterSeverity === s ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-white/10 bg-white/5 text-slate-400"
              }`}
            >
              {s ? SEVERITY_META[s as AlertSeverity].label : "All severities"}
            </button>
          ))}
          {["", "active", "monitoring", "resolved"].map((s) => (
            <button
              key={s || "all-status"}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`rounded-full border px-4 py-2 text-xs capitalize ${
                filterStatus === s ? "border-purple-400/30 bg-purple-400/10 text-purple-300" : "border-white/10 bg-white/[0.03] text-slate-500"
              }`}
            >
              {s || "All statuses"}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="nexus-card nexus-shimmer h-28" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="mt-8 rounded-[24px] border border-red-400/20 bg-red-400/10 p-8 text-center text-red-300">
            <AlertTriangle className="mx-auto" size={32} />
            <p className="mt-3">{error}</p>
            <button onClick={() => void load()} className="nexus-button-secondary mx-auto mt-4 w-fit">
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && alerts.length === 0 && (
          <div className="mt-8 rounded-[28px] border border-dashed border-white/10 p-16 text-center">
            <ShieldCheck className="mx-auto text-emerald-400/70" size={44} />
            <p className="mt-4 text-2xl font-bold">All clear</p>
            <p className="mt-2 text-slate-500">No road hazards reported right now.</p>
          </div>
        )}

        {/* List */}
        {!loading && !error && alerts.length > 0 && (
          <div className="mt-8 space-y-4">
            {alerts.map((alert) => {
              const sev = SEVERITY_META[alert.severity];
              const pulse = (alert.severity === "critical" || alert.severity === "high") && alert.status === "active";
              return (
                <article key={alert.id} className="nexus-card p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-4">
                      <div className="relative mt-1">
                        <span className={`block h-3.5 w-3.5 rounded-full ${sev.dot}`} />
                        {pulse && <span className={`absolute inset-0 animate-ping rounded-full ${sev.dot} opacity-60`} />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold">{alert.title}</h3>
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs ${sev.chip}`}>{sev.label}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-slate-400">
                            {SOURCE_LABELS[alert.source]}
                          </span>
                          {alert.isVerified && (
                            <span className="inline-flex items-center gap-1 text-xs text-cyan-300">
                              <ShieldCheck size={13} /> Verified
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{alert.description}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={13} /> {alert.location}
                          </span>
                          <span className="capitalize">{alert.status}</span>
                          {alert.estimatedDelayMinutes != null && <span>~{alert.estimatedDelayMinutes} min delay</span>}
                          <span>{relativeTime(alert.updatedAt)}</span>
                          {alert.verificationCount > 0 && <span>{alert.verificationCount} confirmations</span>}
                        </div>
                        {alert.alternateRoute && (
                          <p className="mt-2 text-xs text-cyan-300">Alternate: {alert.alternateRoute}</p>
                        )}
                      </div>
                    </div>

                    {alert.status !== "resolved" && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          disabled={busyId === alert.id}
                          onClick={() => void act(alert.id, "confirm")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 disabled:opacity-60"
                        >
                          <ThumbsUp size={14} /> Still active
                        </button>
                        <button
                          type="button"
                          disabled={busyId === alert.id}
                          onClick={() => void act(alert.id, "resolve")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300 disabled:opacity-60"
                        >
                          <CheckCircle2 size={14} /> Resolved
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-600">
          Road alerts are community-reported and monitored — always drive to conditions and follow official guidance.
        </p>
      </div>
    </section>
  );
};

export default RoadAlerts;
