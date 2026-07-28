/**
 * Device-level preferences.
 *
 * The Settings page previously held its toggles in component state and fired
 * `toast.success("Settings saved.")` on click — nothing was written anywhere,
 * so the confirmation was untrue and every value reset on navigation.
 *
 * These are genuinely per-device concerns (does this browser have GPS
 * permission, may this browser raise notifications), so localStorage is the
 * right home for them rather than a user row on the server.
 */

const KEY = "nexus-settings-v1";

export type NexusSettings = {
  locationEnabled: boolean;
  notificationsEnabled: boolean;
};

export const defaultSettings: NexusSettings = {
  locationEnabled: true,
  notificationsEnabled: true,
};

export const loadSettings = (): NexusSettings => {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<NexusSettings>;
    return {
      locationEnabled: parsed.locationEnabled ?? defaultSettings.locationEnabled,
      notificationsEnabled: parsed.notificationsEnabled ?? defaultSettings.notificationsEnabled,
    };
  } catch {
    return defaultSettings;
  }
};

/** Throws if the write fails, so the caller only confirms a real save. */
export const saveSettings = (settings: NexusSettings): void => {
  window.localStorage.setItem(KEY, JSON.stringify(settings));
};

/** What the browser actually granted — not what the app would like. */
export type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

export const readGeolocationPermission = async (): Promise<PermissionState> => {
  if (typeof navigator === "undefined" || !("permissions" in navigator)) return "unsupported";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state as PermissionState;
  } catch {
    return "unsupported";
  }
};

export const readNotificationPermission = (): PermissionState => {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as PermissionState;
};

/** Ask the browser for notification permission. Returns the resulting state. */
export const requestNotificationPermission = async (): Promise<PermissionState> => {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  try {
    return (await Notification.requestPermission()) as PermissionState;
  } catch {
    return "denied";
  }
};
