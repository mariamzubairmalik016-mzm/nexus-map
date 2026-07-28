import { useEffect, useState } from "react";
import { Bell, Languages, LocateFixed, Moon, Save, Shield } from "lucide-react";
import toast from "react-hot-toast";

import PageShell from "../../components/layouts/PageShell";
import PageHeader from "../../components/layouts/PageHeader";
import {
  loadSettings,
  saveSettings,
  readGeolocationPermission,
  readNotificationPermission,
  requestNotificationPermission,
  type NexusSettings,
  type PermissionState,
} from "../../services/settingsService";

/** How a browser permission reads to a person, and whether it needs attention. */
const permissionLabel = (state: PermissionState) => {
  switch (state) {
    case "granted":
      return { text: "Allowed by this browser", tone: "ok" as const };
    case "denied":
      return { text: "Blocked in browser settings", tone: "bad" as const };
    case "prompt":
      return { text: "Will ask when first needed", tone: "info" as const };
    default:
      return { text: "Not supported in this browser", tone: "info" as const };
  }
};

const toneClass = {
  ok: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  bad: "border-red-400/25 bg-red-400/10 text-red-300",
  info: "border-white/10 bg-white/5 text-slate-400",
};

const Settings = () => {
  const [settings, setSettings] = useState<NexusSettings>({ locationEnabled: true, notificationsEnabled: true });
  const [geoPermission, setGeoPermission] = useState<PermissionState>("unsupported");
  const [notifyPermission, setNotifyPermission] = useState<PermissionState>("unsupported");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // localStorage and the Permissions API are browser-only, so read them after
  // mount rather than during render.
  useEffect(() => {
    setSettings(loadSettings());
    setNotifyPermission(readNotificationPermission());
    void readGeolocationPermission().then(setGeoPermission);
  }, []);

  const update = (patch: Partial<NexusSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  const onToggleNotifications = async (enabled: boolean) => {
    update({ notificationsEnabled: enabled });
    // Turning the switch on is meaningless unless the browser agrees, so ask
    // at the moment the intent is expressed.
    if (enabled && readNotificationPermission() === "prompt") {
      setNotifyPermission(await requestNotificationPermission());
    }
  };

  const onSave = () => {
    setSaving(true);
    try {
      saveSettings(settings);
      setDirty(false);
      toast.success("Settings saved on this device.");
    } catch {
      // Private browsing and full storage both land here. Previously this
      // reported success unconditionally.
      toast.error("Could not save — this browser is blocking local storage.");
    } finally {
      setSaving(false);
    }
  };

  const geo = permissionLabel(geoPermission);
  const notify = permissionLabel(notifyPermission);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Personal preferences"
        title="Settings"
        description="These preferences are stored on this device, not on your account, so each browser you sign in from keeps its own."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* --- Location ---------------------------------------------------- */}
        <article className="nexus-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-[var(--r-md)] bg-cyan-400/10 p-3 text-cyan-400">
                <LocateFixed aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Location</h2>
                <p className="mt-1 text-sm text-slate-400">Use GPS to centre the map and find nearby places.</p>
              </div>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2">
              <span className="sr-only">Use my location</span>
              <input
                type="checkbox"
                checked={settings.locationEnabled}
                onChange={(event) => update({ locationEnabled: event.target.checked })}
                className="h-5 w-5 accent-cyan-500"
              />
            </label>
          </div>
          <p className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClass[geo.tone]}`}>
            {geo.text}
          </p>
          {geoPermission === "denied" && (
            <p className="mt-3 text-sm text-slate-400">
              Nexus Map cannot re-enable this itself. Allow location for this site in your browser&apos;s site
              settings, then reload.
            </p>
          )}
        </article>

        {/* --- Notifications ----------------------------------------------- */}
        <article className="nexus-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-[var(--r-md)] bg-cyan-400/10 p-3 text-cyan-400">
                <Bell aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Notifications</h2>
                <p className="mt-1 text-sm text-slate-400">Route and road-alert updates while you travel.</p>
              </div>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2">
              <span className="sr-only">Enable notifications</span>
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(event) => void onToggleNotifications(event.target.checked)}
                className="h-5 w-5 accent-cyan-500"
              />
            </label>
          </div>
          <p className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClass[notify.tone]}`}>
            {notify.text}
          </p>
        </article>

        {/* --- Read-only facts ---------------------------------------------
            Appearance and Language were toggle-less cards implying control the
            app does not have. Stated as current facts instead of fake
            settings, so nothing here pretends to be adjustable. */}
        <article className="nexus-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-[var(--r-md)] bg-white/5 p-3 text-slate-300">
              <Moon aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Appearance</h2>
              <p className="mt-1 text-sm text-slate-400">
                Nexus Map is dark-only — the map styling and overlays are built for it.
              </p>
            </div>
          </div>
        </article>

        <article className="nexus-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-[var(--r-md)] bg-white/5 p-3 text-slate-300">
              <Languages aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Language</h2>
              <p className="mt-1 text-sm text-slate-400">
                English. Place names come from the map provider in their local form.
              </p>
            </div>
          </div>
        </article>

        <article className="nexus-card p-6 lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className="rounded-[var(--r-md)] bg-white/5 p-3 text-slate-300">
              <Shield aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Privacy</h2>
              <p className="mt-1 text-sm text-slate-400">
                Saved places, route history and favourites are tied to your account. Downloaded map regions and the
                preferences on this page stay on this device and are cleared when you clear site data.
              </p>
            </div>
          </div>
        </article>
      </div>

      <button
        onClick={onSave}
        disabled={!dirty || saving}
        className="nexus-button-primary nexus-button-block mt-7"
      >
        <Save size={18} aria-hidden="true" />
        {saving ? "Saving..." : dirty ? "Save Settings" : "All changes saved"}
      </button>
    </PageShell>
  );
};

export default Settings;
