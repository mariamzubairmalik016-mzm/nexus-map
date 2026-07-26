import { useState, type FormEvent } from "react";
import { Mail, MapPin, Save, UserRound, type LucideIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

const Profile = () => {
  const { data: session } = useSession();
  const user = session?.user;
  const profile = { full_name: user?.name, city: "Karachi", country: "Pakistan", bio: "", role: "user" };
  const [name, setName] = useState(profile?.full_name || "");
  const [city, setCity] = useState(profile?.city || "Karachi");
  const [country, setCountry] = useState(profile?.country || "Pakistan");
  const [bio, setBio] = useState(profile?.bio || "");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await new Promise((r) => setTimeout(r, 500));
    toast.success("Profile updated.");
  };

  return (
    <section className="min-h-[calc(100vh-80px)] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="nexus-eyebrow">Personal account</p>
        <h1 className="text-hero-display mt-4 text-5xl">My Profile</h1>

        <div className="mt-10 grid gap-8 lg:grid-cols-[300px_1fr]">
          {/* Avatar card */}
          <aside className="nexus-card-elevated p-8 text-center">
            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/15 to-purple-600/10 text-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.08)]">
              <UserRound size={58} />
            </div>
            <h2 className="mt-6 text-2xl font-bold text-white">
              {profile?.full_name || user?.email?.split("@")[0]}
            </h2>
            <p className="mt-2 truncate text-sm text-slate-400">{user?.email}</p>
          </aside>

          {/* Edit form */}
          <form onSubmit={submit} className="nexus-card-elevated p-8">
            <div className="grid gap-5 md:grid-cols-2">
              {(
                [
                  { Icon: UserRound, value: name, setter: setName, label: "Full name" },
                  { Icon: Mail, value: user?.email || "", setter: () => {}, label: "Email" },
                  { Icon: MapPin, value: city, setter: setCity, label: "City" },
                  { Icon: MapPin, value: country, setter: setCountry, label: "Country" },
                ] as Array<{
                  Icon: LucideIcon;
                  value: string;
                  setter: (v: string) => void;
                  label: string;
                }>
              ).map(({ Icon, value, setter, label }) => (
                <label key={label}>
                  <span className="mb-2 block text-sm font-medium text-slate-300">{label}</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-slate-950/60 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 focus-within:border-cyan-400/30 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.06)]">
                    <Icon className="text-cyan-400" size={18} />
                    <input
                      value={value}
                      disabled={label === "Email"}
                      onChange={(e) => setter(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent py-4 outline-none"
                    />
                  </div>
                </label>
              ))}
            </div>

            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              className="nexus-input mt-5"
            />

            <button className="nexus-button-primary mt-6 w-full py-4">
              <Save size={18} />
              Save Profile
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Profile;
