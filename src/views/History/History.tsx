import { useEffect, useState } from "react";
import { Clock3, LoaderCircle, MapPin, Navigation, Trash2 } from "lucide-react";

import { offlineDb, type OfflineHistoryItem } from "../../services/offlineDb";
import PageShell from "../../components/layouts/PageShell";
import PageHeader from "../../components/layouts/PageHeader";

const fmtDistance = (km?: number) => {
  if (km == null) return "";
  return km >= 1 ? `${km.toLocaleString()} km` : `${Math.round(km * 1000)} m`;
};

const fmtDuration = (min?: number) => {
  if (min == null) return "";
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const mins = min % 60;
  return `${hours} hr${mins ? ` ${mins} min` : ""}`;
};

const History = () => {
  const [items, setItems] = useState<OfflineHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void offlineDb
      .getHistory()
      .then((history) => setItems(history.sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const remove = async (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    await offlineDb.deleteHistory(id);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Travel activity"
        title="Route history"
        description={
          items.length > 0
            ? `${items.length} ${items.length === 1 ? "route" : "routes"} planned, kept on this device.`
            : undefined
        }
      />

      {loading && (
        <div className="flex min-h-80 items-center justify-center" role="status" aria-label="Loading route history">
          <LoaderCircle size={44} className="animate-spin text-cyan-400" />
        </div>
      )}

      {!loading && items.length > 0 && (
        <ul className="mt-8 space-y-4">
          {items.map((item) => (
            <li key={item.id}>
              <article className="nexus-card p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    {/* Origin and destination are a pair, so they read as one
                        line with an explicit arrow rather than two icons the
                        eye has to infer a direction from. */}
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                      <MapPin className="shrink-0 text-emerald-400" size={17} aria-hidden="true" />
                      <span className="truncate">{item.startName}</span>
                      <span aria-hidden="true" className="text-slate-600">
                        &rarr;
                      </span>
                      <Navigation className="shrink-0 text-cyan-400" size={17} aria-hidden="true" />
                      <span className="truncate">{item.destinationName}</span>
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                      {item.distanceKm != null && (
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtDistance(item.distanceKm)}</span>
                      )}
                      {item.durationMinutes != null && (
                        <span className="flex items-center gap-1" style={{ fontVariantNumeric: "tabular-nums" }}>
                          <Clock3 size={15} aria-hidden="true" />
                          {fmtDuration(item.durationMinutes)}
                        </span>
                      )}
                      <time dateTime={item.createdAt} className="text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </time>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(item.id)}
                    className="nexus-button-danger-quiet nexus-button-sm sm:shrink-0"
                    aria-label={`Delete route from ${item.startName} to ${item.destinationName}`}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {!loading && items.length === 0 && (
        <div className="mt-8 rounded-[var(--r-xl)] border border-dashed border-white/10 p-16 text-center">
          <Navigation className="mx-auto text-slate-600" size={42} aria-hidden="true" />
          <p className="mt-4 font-display text-2xl font-bold">No routes yet</p>
          <p className="mx-auto mt-2 max-w-md text-slate-400">
            Plan a route on the map and it will be saved here — even offline.
          </p>
        </div>
      )}
    </PageShell>
  );
};

export default History;
