"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Mail, MapPin, Phone, Save, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

import PageShell from "../../components/layouts/PageShell";
import PageHeader from "../../components/layouts/PageHeader";

type ProfileData = {
  fullName: string;
  email: string;
  city: string;
  country: string;
  phone: string;
  bio: string;
  role: string;
};

const EMPTY: ProfileData = {
  fullName: "",
  email: "",
  city: "",
  country: "",
  phone: "",
  bio: "",
  role: "user",
};

/**
 * Profile editor.
 *
 * This page used to be entirely cosmetic: city and country were the hardcoded
 * strings "Karachi" and "Pakistan", and saving was a 500 ms `setTimeout`
 * followed by a success toast. Nothing was read from or written to the
 * database. It now loads from /api/profile and saves with PATCH.
 */
const Profile = () => {
  const { data: session, update: updateSession } = useSession();
  const [form, setForm] = useState<ProfileData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/profile")
      .then((res) => res.json())
      .then((payload) => {
        if (cancelled) return;
        if (payload?.success) setForm({ ...EMPTY, ...payload.data });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (key: keyof ProfileData) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (form.fullName.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          city: form.city.trim(),
          country: form.country.trim(),
          phone: form.phone.trim(),
          bio: form.bio.trim(),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Could not save your profile.");
      }

      // Refresh the session so the navbar shows the new name immediately.
      await updateSession?.();
      toast.success("Profile saved.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save your profile.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "flex items-center gap-3 rounded-[var(--r-md)] border border-white/[0.08] bg-slate-950/60 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 focus-within:border-cyan-400/30 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.06)]";

  const displayName = form.fullName || session?.user?.email?.split("@")[0] || "Explorer";

  return (
    <PageShell>
      <PageHeader eyebrow="Personal account" title="My Profile" />

      {loading ? (
        <div className="mt-10 flex min-h-64 items-center justify-center" role="status" aria-label="Loading profile">
          <LoaderCircle size={40} className="animate-spin text-cyan-400" />
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[300px_1fr]">
          <aside className="nexus-card-elevated p-8 text-center">
            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/15 to-purple-600/10 text-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.08)]">
              <UserRound size={58} aria-hidden="true" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold text-white">{displayName}</h2>
            <p className="mt-2 truncate text-sm text-slate-400">{form.email || session?.user?.email}</p>
            {form.role !== "user" && (
              <span className="mt-4 inline-flex rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold capitalize text-cyan-200">
                {form.role}
              </span>
            )}
          </aside>

          <form onSubmit={submit} className="nexus-card-elevated p-6 sm:p-8" noValidate>
            {error && (
              <p
                role="alert"
                className="mb-5 rounded-[var(--r-md)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              >
                {error}
              </p>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              {(
                [
                  { key: "fullName", label: "Full name", Icon: UserRound, autoComplete: "name" },
                  { key: "phone", label: "Phone", Icon: Phone, autoComplete: "tel" },
                  { key: "city", label: "City", Icon: MapPin, autoComplete: "address-level2" },
                  { key: "country", label: "Country", Icon: MapPin, autoComplete: "country-name" },
                ] as const
              ).map(({ key, label, Icon, autoComplete }) => (
                <label key={key} className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">{label}</span>
                  <div className={fieldClass}>
                    <Icon className="shrink-0 text-cyan-400" size={18} aria-hidden="true" />
                    <input
                      value={form[key]}
                      onChange={(e) => set(key)(e.target.value)}
                      autoComplete={autoComplete}
                      className="min-w-0 flex-1 bg-transparent py-4 outline-none"
                    />
                  </div>
                </label>
              ))}

              {/* Email is the account identity and changing it would orphan the
                  session, so it is shown read-only rather than as a disabled
                  input that looks editable. */}
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-300">Email</span>
                <div className={`${fieldClass} opacity-70`}>
                  <Mail className="shrink-0 text-cyan-400" size={18} aria-hidden="true" />
                  <input
                    value={form.email || session?.user?.email || ""}
                    readOnly
                    aria-describedby="email-note"
                    className="min-w-0 flex-1 cursor-not-allowed bg-transparent py-4 outline-none"
                  />
                </div>
                <span id="email-note" className="mt-2 block text-xs text-slate-500">
                  Your email identifies the account and cannot be changed here.
                </span>
              </label>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium text-slate-300">About you</span>
              <textarea
                value={form.bio}
                onChange={(e) => set("bio")(e.target.value)}
                rows={5}
                maxLength={500}
                placeholder="Where you like to travel, what you are planning next…"
                className="nexus-input"
              />
              <span className="mt-2 block text-xs text-slate-500" style={{ fontVariantNumeric: "tabular-nums" }}>
                {form.bio.length}/500
              </span>
            </label>

            <button disabled={saving} className="nexus-button-primary nexus-button-block mt-6 py-4">
              {saving ? (
                <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
              ) : (
                <Save size={18} aria-hidden="true" />
              )}
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </form>
        </div>
      )}
    </PageShell>
  );
};

export default Profile;
