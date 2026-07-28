"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  Heart,
  LifeBuoy,
  LoaderCircle,
  MapPin,
  MessageSquare,
  Route,
  Search,
  Star,
  Users,
} from "lucide-react";

import PageShell from "../../components/layouts/PageShell";
import PageHeader from "../../components/layouts/PageHeader";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  city: string | null;
  country: string | null;
  joined_at: string | null;
  saved_places: number | string;
  saved_routes: number | string;
  trips: number | string;
  favorites: number | string;
  alerts: number | string;
  reviews: number | string;
};

type Overview = {
  totals: Record<string, number>;
  users: AdminUser[];
  recent: {
    alerts: Array<{ id: string; type: string; severity: string; description: string | null; status: string; createdAt: string }>;
    reviews: Array<{ id: string; userName: string; placeName: string; rating: number; title: string; createdAt: string }>;
    routes: Array<{ id: string; title: string; originName: string; destinationName: string; createdAt: string }>;
    sos: Array<{ id: string; latitude: number; longitude: number; message: string | null; status: string; createdAt: string }>;
  };
};

/**
 * Admin dashboard.
 *
 * The previous version showed five counts from `/admin/stats` and nothing
 * about users at all — which is why no user data ever appeared here. It now
 * reads `/admin/overview`: who signed up, what each of them has actually done,
 * and the most recent activity across the install.
 */
const AdminDashboard = () => {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/overview")
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !payload.success) {
          // 403 is the common case and needs a different message from a crash.
          setError(
            response.status === 403
              ? "This account is not an admin."
              : response.status === 401
                ? "Sign in with an admin account to view this page."
                : payload.message || "Could not load admin data.",
          );
          return;
        }
        setData(payload.data as Overview);
      })
      .catch(() => !cancelled && setError("Could not reach the server."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = data?.totals;
  const cards = [
    { label: "Users", value: totals?.users, Icon: Users },
    { label: "Saved places", value: totals?.savedPlaces, Icon: Bookmark },
    { label: "Saved routes", value: totals?.savedRoutes, Icon: Route },
    { label: "Trips", value: totals?.trips, Icon: MapPin },
    { label: "Favourites", value: totals?.favorites, Icon: Heart },
    { label: "Road alerts", value: totals?.alerts, Icon: AlertTriangle },
    { label: "Reviews", value: totals?.reviews, Icon: Star },
    { label: "Community tips", value: totals?.tips, Icon: MessageSquare },
    { label: "Searches", value: totals?.searches, Icon: Search },
    { label: "SOS raised", value: totals?.sos, Icon: LifeBuoy },
  ];

  const needle = filter.trim().toLowerCase();
  const people = (data?.users || []).filter(
    (u) =>
      !needle ||
      (u.email || "").toLowerCase().includes(needle) ||
      (u.name || "").toLowerCase().includes(needle),
  );

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Administration"
        title="Admin dashboard"
        description="Everyone using Nexus Map, what they have saved and reported, and the latest activity."
      />

      {loading && (
        <div className="mt-10 flex min-h-64 items-center justify-center" role="status" aria-label="Loading">
          <LoaderCircle size={40} className="animate-spin text-cyan-400" />
        </div>
      )}

      {error && !loading && (
        <p
          role="alert"
          className="mt-10 rounded-[var(--r-md)] border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          {error}
        </p>
      )}

      {data && !loading && (
        <>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map(({ label, value, Icon }) => (
              <article key={label} className="nexus-card flex flex-col justify-between p-5">
                <Icon className="text-cyan-400" size={20} aria-hidden="true" />
                <div className="mt-5">
                  <p className="text-2xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {value ?? 0}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">{label}</p>
                </div>
              </article>
            ))}
          </div>

          {/* ---- Users --------------------------------------------------- */}
          <section className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold">Users</h2>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by name or email"
                className="nexus-input sm:max-w-xs"
              />
            </div>

            {/* The table scrolls inside its own container so the page body
                never scrolls sideways on a phone. */}
            <div className="nexus-card mt-4 overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-slate-500">
                  <tr className="border-b border-white/[0.07]">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 text-right font-medium">Places</th>
                    <th className="px-4 py-3 text-right font-medium">Routes</th>
                    <th className="px-4 py-3 text-right font-medium">Trips</th>
                    <th className="px-4 py-3 text-right font-medium">Alerts</th>
                    <th className="px-4 py-3 text-right font-medium">Reviews</th>
                  </tr>
                </thead>
                <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                  {people.map((u) => (
                    <tr key={u.id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{u.name || u.email.split("@")[0]}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.role === "admin"
                              ? "bg-cyan-400/10 text-cyan-300"
                              : "bg-white/5 text-slate-400"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {[u.city, u.country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">{u.saved_places}</td>
                      <td className="px-4 py-3 text-right">{u.saved_routes}</td>
                      <td className="px-4 py-3 text-right">{u.trips}</td>
                      <td className="px-4 py-3 text-right">{u.alerts}</td>
                      <td className="px-4 py-3 text-right">{u.reviews}</td>
                    </tr>
                  ))}

                  {people.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        No users match “{filter}”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ---- Recent activity ----------------------------------------- */}
          <section className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="nexus-card p-5">
              <h3 className="font-display text-lg font-bold">Latest road alerts</h3>
              <ul className="mt-4 space-y-3">
                {data.recent.alerts.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        a.severity === "critical"
                          ? "bg-red-400"
                          : a.severity === "high"
                            ? "bg-orange-400"
                            : "bg-amber-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="truncate">{a.description || a.type}</p>
                      <p className="text-xs text-slate-500">
                        {a.type} · {a.severity} · {a.status}
                      </p>
                    </div>
                  </li>
                ))}
                {data.recent.alerts.length === 0 && <li className="text-sm text-slate-500">None yet.</li>}
              </ul>
            </article>

            <article className="nexus-card p-5">
              <h3 className="font-display text-lg font-bold">Latest reviews</h3>
              <ul className="mt-4 space-y-3">
                {data.recent.reviews.map((r) => (
                  <li key={r.id} className="text-sm">
                    <p className="truncate">
                      <span className="font-medium">{r.userName}</span> on {r.placeName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {r.rating}★ · {r.title}
                    </p>
                  </li>
                ))}
                {data.recent.reviews.length === 0 && <li className="text-sm text-slate-500">None yet.</li>}
              </ul>
            </article>

            <article className="nexus-card p-5">
              <h3 className="font-display text-lg font-bold">Latest routes</h3>
              <ul className="mt-4 space-y-3">
                {data.recent.routes.map((r) => (
                  <li key={r.id} className="truncate text-sm">
                    {r.originName} <span className="text-slate-600">→</span> {r.destinationName}
                  </li>
                ))}
                {data.recent.routes.length === 0 && <li className="text-sm text-slate-500">None yet.</li>}
              </ul>
            </article>

            <article className="nexus-card p-5">
              <h3 className="font-display text-lg font-bold">SOS alerts</h3>
              <ul className="mt-4 space-y-3">
                {data.recent.sos.map((s) => (
                  <li key={s.id} className="text-sm">
                    <p className="truncate">{s.message || "Emergency alert"}</p>
                    <p className="text-xs text-slate-500">
                      {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)} · {s.status}
                    </p>
                  </li>
                ))}
                {data.recent.sos.length === 0 && (
                  <li className="text-sm text-slate-500">No emergencies raised.</li>
                )}
              </ul>
            </article>
          </section>
        </>
      )}
    </PageShell>
  );
};

export default AdminDashboard;
