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
  EMPTY_SOURCES_META,
  SEVERITY_META,
  SOURCE_BADGE,
  SOURCE_LABELS,
  type AlertSeverity,
  type RoadAlert,
  type RoadAlertType,
  type SourcesMeta,
} from "../../types/roadAlerts";

const DEMO_KEY = "nexus-include-demo";
const DEFAULT_CENTER = { lat: 24.8607, lng: 67.0011 }; // Karachi fallback

const SOURCE_MODES = [
  { key: "all", label: "All Sources" },
  { key: "api", label: "Live/API" },
  { key: "community", label: "Community" },
  { key: "admin", label: "Admin" },
  { key: "cached", label: "Cached" },
  { key: "demo", label: "Demo" },
] as const;

const relativeTime = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

const apiStatusLabel = (s: SourcesMeta["api"]["status"]) =>
  s === "connected" ? "Connected" : s === "error" ? "Error" : s === "not-configured" ? "Not Configured" : "Idle";

const RoadAlerts = () => {
  const { user } = useAuth();
  const geo = useGeolocation();
  const online = useInternetStatus();

  const [alerts, setAlerts] = useState<RoadAlert[]>([]);
  const [meta, setMeta] = useState<SourcesMeta>(EMPTY_SOURCES_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [source, setSource] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [includeDemo, setIncludeDemo] = useState(() => localStorage.getItem(DEMO_KEY) === "true");

  const [showReport, setShowReport] = useState(false);
  const [form, setForm] = useState<{ type: RoadAlertType; description: string; severity: AlertSeverity }>({
    type: "accident",
    description: "",
    severity: "medium",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    localStorage.setItem(DEMO_KEY, String(includeDemo));
  }, [includeDemo]);

  const load = async () => {
    try {
      setError("");
      const lat = geo.coordinates?.latitude ?? DEFAULT_CENTER.lat;
      const lng = geo.coordinates?.longitude ?? DEFAULT_CENTER.lng;
      const result = await roadAlertsService.list({
        severity: filterSeverity || undefined,
        status: filterStatus || undefined,
        source: source === "all" ? undefined : source,
        includeDemo: includeDemo || source === "demo",
        lat,
        lng,
        radiusKm: 10,
      });
      setAlerts(result.alerts);
      setMeta(result.meta);
      setLive(result.live);
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
  }, [source, includeDemo, filterSeverity, filterStatus, geo.coordinates]);

  useEffect(() => {
    if (!online) return;
    const unsubscribe = roadAlertsService.subscribeRealtime(() => void load());
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, source, includeDemo, filterSeverity, filterStatus]);

  const critical = useMemo(
    () => alerts.filter((a) => (a.severity === "critical" || a.severity === "high") && a.status !== "resolved"),
    [alerts],
  );

  const submitReport = async () => {
    if (!user) return toast.error("Please sign in to report a hazard.");
    if (form.description.trim().length < 5) return toast.error("Add a short description (5+ characters).");
    if (!geo.coordinates) return toast.error("Tap “Use my location” first to attach GPS coordinates.");
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
    if (!user) return toast.error("Please sign in to respond to alerts.");
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
            <h1 className="text-hero-display mt-3 text-4xl sm:text-5xl">
              Road <span className="nexus-gradient-text">Alerts & Conditions</span>
            </h1>
            <p className="mt-4 max-w-2xl text-slate-400">
              Real traffic-provider incidents, community reports and admin-verified hazards — from every source, clearly labeled.
            </p>
          </div>
          <button type="button" onClick={() => setShowReport((v) => !v)} className="nexus-button-primary w-fit">
            <TriangleAlert size={18} />
            Report a hazard
          </button>
        </div>

        {/* Source status summary */}
        <div className="nexus-card mt-6 grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Live API", value: `${apiStatusLabel(meta.api.status)}${meta.api.count ? ` · ${meta.api.count}` : ""}`, dot: meta.api.status === "connected" ? "bg-cyan-400" : meta.api.status === "error" ? "bg-red-400" : "bg-slate-500" },
            { label: "Community", value: `${meta.community.count} active`, dot: "bg-violet-400" },
            { label: "Admin", value: `${meta.admin.count} active`, dot: "bg-emerald-400" },
            { label: "Cached", value: `${meta.cached.count} offline`, dot: "bg-amber-400" },
            { label: "Demo", value: meta.demo.enabled ? `${meta.demo.count} shown` : "Disabled", dot: "bg-slate-500" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
              <div className="min-w-0">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="truncate text-sm font-semibold">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Status strip + demo toggle */}
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
              online ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-300"
            }`}
          >
            {online ? <RefreshCw size={14} /> : <WifiOff size={14} />}
            {live ? "Live" : "Offline — showing cached alerts"}
          </span>
          {critical.length > 0 && <span className="text-red-300">{critical.length} high/critical</span>}
          {lastUpdated && (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Clock3 size={13} /> Updated {relativeTime(lastUpdated.toISOString())}
            </span>
          )}
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={includeDemo}
              onChange={(e) => setIncludeDemo(e.target.checked)}
              className="h-4 w-4 accent-cyan-500"
            />
            Include Demo Alerts
          </label>
        </div>

        {/* Report form */}
        {showReport && (
          <div className="nexus-card mt-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-400">Hazard type</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as RoadAlertType }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3.5 outline-none"
                >
                  {ALERT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ALERT_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-400">Severity</span>
                <select
                  value={form.severity}
                  onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as AlertSeverity }))}
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
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Describe the hazard and its exact spot..."
              className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 outline-none"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={geo.getCurrentLocation} className="nexus-button-secondary">
                <LocateFixed size={17} />
                {geo.loading ? "Locating…" : geo.coordinates ? "Location attached" : "Use my location"}
              </button>
              {geo.coordinates && (
                <span className="text-xs text-slate-500">
                  {geo.coordinates.latitude.toFixed(4)}, {geo.coordinates.longitude.toFixed(4)}
                </span>
              )}
              <button type="button" onClick={() => void submitReport()} disabled={submitting} className="nexus-button-primary ml-auto">
                {submitting ? <LoaderCircle size={17} className="animate-spin" /> : <TriangleAlert size={17} />}
                Submit report
              </button>
            </div>
          </div>
        )}

        {/* Source mode */}
        <div className="mt-6 flex flex-wrap gap-2">
          {SOURCE_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setSource(m.key)}
              className={`rounded-full border px-4 py-2 text-xs ${
                source === m.key ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-white/10 bg-white/5 text-slate-400"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Severity + status filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          {["", "critical", "high", "medium", "low"].map((s) => (
            <button
              key={s || "all-sev"}
              type="button"
              onClick={() => setFilterSeverity(s)}
              className={`rounded-full border px-4 py-2 text-xs ${
                filterSeverity === s ? "border-purple-400/30 bg-purple-400/10 text-purple-300" : "border-white/10 bg-white/[0.03] text-slate-500"
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
                filterStatus === s ? "border-blue-400/30 bg-blue-400/10 text-blue-300" : "border-white/10 bg-white/[0.03] text-slate-500"
              }`}
            >
              {s || "All statuses"}
            </button>
          ))}
        </div>

        {loading && (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="nexus-card nexus-shimmer h-28" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="mt-8 rounded-[24px] border border-red-400/20 bg-red-400/10 p-8 text-center text-red-300">
            <AlertTriangle className="mx-auto" size={32} />
            <p className="mt-3">{error}</p>
            <button onClick={() => void load()} className="nexus-button-secondary mx-auto mt-4 w-fit">
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        )}

        {!loading && !error && alerts.length === 0 && (
          <div className="mt-8 rounded-[28px] border border-dashed border-white/10 p-16 text-center">
            <ShieldCheck className="mx-auto text-emerald-400/70" size={44} />
            <p className="mt-4 text-2xl font-bold">All clear</p>
            <p className="mt-2 text-slate-500">
              No road hazards from the selected sources.
              {!includeDemo && " Enable “Include Demo Alerts” to preview sample hazards."}
            </p>
          </div>
        )}

        {!loading && !error && alerts.length > 0 && (
          <div className="mt-8 space-y-4">
            {alerts.map((alert) => {
              const sev = SEVERITY_META[alert.severity];
              const pulse = (alert.severity === "critical" || alert.severity === "high") && alert.status === "active";
              const actionable =
                alert.status !== "resolved" && !alert.id.startsWith("api-") && !alert.id.startsWith("demo-");
              const sourceLabel =
                alert.source === "cached" && alert.originalSource
                  ? `Cached • Originally ${SOURCE_LABELS[alert.originalSource]}`
                  : SOURCE_LABELS[alert.source];
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
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs ${SOURCE_BADGE[alert.source]}`}>
                            {sourceLabel}
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
                        {alert.alternateRoute && <p className="mt-2 text-xs text-cyan-300">Alternate: {alert.alternateRoute}</p>}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={`/map?place=${encodeURIComponent(alert.title)}&lat=${alert.latitude}&lng=${alert.longitude}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200"
                      >
                        <MapPin size={14} /> Map
                      </a>
                      {actionable && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-600">
          Road alerts combine live traffic data, community reports and admin verification — always drive to conditions.
        </p>
      </div>
    </section>
  );
};

export default RoadAlerts;
