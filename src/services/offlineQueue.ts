import { offlineDb, type QueuedRequest } from "./offlineDb";

const SYNC_TAG = "nexus-sync-queue";

/**
 * Persist a write request that could not be delivered (offline / server down)
 * so it can be replayed automatically once connectivity returns.
 */
export const queueRequest = async (req: Omit<QueuedRequest, "id" | "createdAt">) => {
  const item: QueuedRequest = {
    ...req,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await offlineDb.enqueue(item);
  await registerBackgroundSync();
  return item;
};

/** Ask the browser to wake the service worker and flush the queue when back online. */
export const registerBackgroundSync = async () => {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    const sync = (registration as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync;
    if (sync?.register) await sync.register(SYNC_TAG);
  } catch {
    // Background Sync unsupported (e.g. Firefox/Safari) — the online-event
    // flush in ConnectionStatus still covers reconnection.
  }
};

let flushing = false;

/** Replay every queued request in order. Keeps items that fail transiently. */
export const flushQueue = async (): Promise<{ flushed: number; remaining: number }> => {
  if (flushing) {
    return { flushed: 0, remaining: await pendingCount() };
  }
  flushing = true;
  let flushed = 0;
  try {
    const items = await offlineDb.getQueue();
    for (const item of items) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers ?? { "Content-Type": "application/json" },
          body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
        });
        if (response.ok) {
          await offlineDb.dequeue(item.id);
          flushed += 1;
        } else if (response.status >= 400 && response.status < 500) {
          // A client error will never succeed on retry — drop it so the queue
          // cannot grow unbounded (error recovery).
          await offlineDb.dequeue(item.id);
        }
        // 5xx: leave in place for the next attempt.
      } catch {
        // Network still unavailable — stop and try again on the next trigger.
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { flushed, remaining: await pendingCount() };
};

export const pendingCount = async () => (await offlineDb.getQueue()).length;
