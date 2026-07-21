import { useEffect, useState } from "react";
import { Bell, CheckCheck, RefreshCw, Trash2 } from "lucide-react";

import { pendingCount } from "../../services/offlineQueue";

type Note = { id: string; title: string; message: string; read: boolean };

const KEY = "nexus-notifications";

const seed: Note[] = [
  { id: "n1", title: "Route saved successfully", message: "Your latest route was added to history.", read: false },
  { id: "n2", title: "Weather advisory", message: "Heavy rain is expected near Murree.", read: false },
  { id: "n3", title: "Location permission enabled", message: "Nexus Map can use your live GPS.", read: true },
];

const loadNotes = (): Note[] => {
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? (JSON.parse(stored) as Note[]) : seed;
  } catch {
    return seed;
  }
};

const Notifications = () => {
  const [items, setItems] = useState<Note[]>(loadNotes);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    void pendingCount().then(setPending).catch(() => {});
  }, []);

  return (
    <section className="min-h-[calc(100vh-80px)] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[.25em] text-cyan-400">Account updates</p>
            <h1 className="mt-3 text-4xl font-bold">Notifications</h1>
          </div>
          <button
            onClick={() => setItems((current) => current.map((item) => ({ ...item, read: true })))}
            className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3"
          >
            <CheckCheck size={18} />
            Mark all read
          </button>
        </div>

        {pending > 0 && (
          <div className="mt-6 flex items-center gap-3 rounded-[20px] border border-amber-400/20 bg-amber-400/[.08] p-4 text-amber-200">
            <RefreshCw size={18} />
            <p className="text-sm">
              {pending} offline change{pending === 1 ? "" : "s"} waiting to sync. They will upload automatically when you reconnect.
            </p>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className={`rounded-[24px] border p-5 ${
                item.read ? "border-white/10 bg-white/[.03]" : "border-cyan-400/20 bg-cyan-400/[.06]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-400">
                    <Bell />
                  </div>
                  <div>
                    <h2 className="font-semibold">{item.title}</h2>
                    <p className="mt-2 text-slate-400">{item.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}
                  className="text-red-300"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))}

          {items.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-white/10 p-14 text-center text-slate-500">
              You are all caught up.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Notifications;
