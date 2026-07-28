/**
 * Notification store — single source of truth for the list and the nav badge.
 *
 * Two problems this replaces:
 *   1. The Navbar badge was the literal `const unreadCount = 2`, so it read
 *      "2 unread" forever, including on a brand-new account.
 *   2. The Notifications page shipped three invented entries — a weather
 *      advisory near Murree, a saved route — presented as things that had
 *      happened. Fabricated history is worse than an empty list.
 *
 * Entries are now only ever created by `notify()` from a real app event.
 */

export type Notification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

const KEY = "nexus-notifications-v2";
const EVENT = "nexus-notifications-changed";

const isBrowser = () => typeof window !== "undefined";

export const loadNotifications = (): Notification[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Notification[]) : [];
  } catch {
    return [];
  }
};

export const saveNotifications = (items: Notification[]): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* private mode / quota — non-fatal */
  }
  // Same-tab listeners: the native `storage` event only fires in *other* tabs,
  // so the badge would not update on the tab that made the change.
  window.dispatchEvent(new CustomEvent(EVENT));
};

export const unreadCount = (): number => loadNotifications().filter((n) => !n.read).length;

/** Record a real event. Called by features when something actually happens. */
export const notify = (title: string, message: string): void => {
  const entry: Notification = {
    // crypto.randomUUID is unavailable on some older mobile browsers.
    id: isBrowser() && crypto.randomUUID ? crypto.randomUUID() : `n-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  };
  saveNotifications([entry, ...loadNotifications()].slice(0, 100));
};

/** Subscribe to changes from this tab and others. Returns an unsubscribe fn. */
export const subscribe = (listener: () => void): (() => void) => {
  if (!isBrowser()) return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
};
