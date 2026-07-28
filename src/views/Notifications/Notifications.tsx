import { useEffect, useState } from "react";
import { Bell, CheckCheck, RefreshCw, Trash2 } from "lucide-react";

import { pendingCount } from "../../services/offlineQueue";
import {
  loadNotifications,
  saveNotifications,
  subscribe,
  type Notification as Note,
} from "../../services/notificationsService";

const Notifications = () => {
  // Empty on the server and on first client render; the store is read after
  // mount so the markup matches and hydration stays clean.
  const [items, setItems] = useState<Note[]>([]);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const sync = () => setItems(loadNotifications());
    sync();
    setReady(true);
    return subscribe(sync);
  }, []);

  /** Write through the store so the Navbar badge updates with the list. */
  const commit = (next: Note[]) => {
    setItems(next);
    saveNotifications(next);
  };

  useEffect(() => {
    void pendingCount().then(setPending).catch(() => {});
  }, []);

  return (
    <section className="nexus-page nexus-page-body">
      <div className="nexus-container">
        <div className="flex items-end justify-between">
          <div>
            <p className="nexus-eyebrow">Account updates</p>
            <h1 className="mt-3 text-4xl font-bold">Notifications</h1>
          </div>
          <button
            onClick={() => commit(items.map((item) => ({ ...item, read: true })))}
            disabled={items.every((item) => item.read)}
            className="nexus-button-secondary nexus-button-sm"
          >
            <CheckCheck size={18} />
            Mark all read
          </button>
        </div>

        {pending > 0 && (
          <div className="mt-6 flex items-center gap-3 rounded-[var(--r-lg)] border border-amber-400/20 bg-amber-400/[.08] p-4 text-amber-200">
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
              className={`rounded-[var(--r-lg)] border p-5 ${
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
                  onClick={() => commit(items.filter((row) => row.id !== item.id))}
                  aria-label={`Dismiss notification: ${item.title}`}
                  className="shrink-0 rounded-[var(--r-sm)] p-2 text-red-300 hover:bg-red-400/10"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))}

          {ready && items.length === 0 && (
            <div className="rounded-[var(--r-lg)] border border-dashed border-white/10 p-14 text-center">
              <p className="font-display text-xl font-bold">Nothing yet</p>
              <p className="mx-auto mt-2 max-w-md text-slate-400">
                Route saves, sync results and road-alert updates will appear here as they happen.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Notifications;
