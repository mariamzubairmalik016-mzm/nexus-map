import { useEffect, useState } from "react";
import { Clock3, LoaderCircle, MapPin, Navigation, Trash2 } from "lucide-react";

import { offlineDb, type OfflineHistoryItem } from "../../services/offlineDb";

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
    <section className="min-h-[calc(100vh-80px)] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-[.25em] text-cyan-400">Travel activity</p>
        <h1 className="mt-3 text-4xl font-bold">Route history</h1>

        {loading && (
          <div className="flex min-h-80 items-center justify-center">
            <LoaderCircle size={44} className="animate-spin text-cyan-400" />
          </div>
        )}

        {!loading && (
          <div className="mt-8 space-y-4">
            {items.map((item) => (
              <article key={item.id} className="rounded-[26px] border border-white/10 bg-white/[.04] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <MapPin className="text-emerald-400" size={17} />
                      {item.startName}
                      <Navigation className="text-red-400" size={17} />
                      {item.destinationName}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-400">
                      {item.distanceKm != null && <span>{fmtDistance(item.distanceKm)}</span>}
                      {item.durationMinutes != null && (
                        <span className="flex items-center gap-1">
                          <Clock3 size={15} />
                          {fmtDuration(item.durationMinutes)}
                        </span>
                      )}
                      <span className="text-slate-600">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(item.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-400/10 px-4 py-3 text-red-300"
                  >
                    <Trash2 size={17} />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="mt-8 rounded-[28px] border border-dashed border-white/10 p-16 text-center">
            <Navigation className="mx-auto text-slate-600" size={42} />
            <p className="mt-4 text-2xl font-bold">No routes yet</p>
            <p className="mt-2 text-slate-500">Plan a route on the map and it will be saved here — even offline.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default History;
