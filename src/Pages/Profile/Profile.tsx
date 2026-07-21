import { useState, type FormEvent } from "react";
import { Mail, MapPin, Save, UserRound, type LucideIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";

const Profile = () => {
  const { user, profile, updateProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name || "");
  const [city, setCity] = useState(profile?.city || "Karachi");
  const [country, setCountry] = useState(profile?.country || "Pakistan");
  const [bio, setBio] = useState(profile?.bio || "");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await updateProfile({ full_name: name, city, country, bio });
    toast.success("Profile updated.");
  };
  return <section className="min-h-[calc(100vh-80px)] px-4 py-14 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl"><p className="text-sm uppercase tracking-[.25em] text-cyan-400">Personal account</p><h1 className="mt-3 text-4xl font-bold">My Profile</h1><div className="mt-8 grid gap-7 lg:grid-cols-[300px_1fr]"><aside className="rounded-[30px] border border-white/10 bg-white/[.04] p-6 text-center"><div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-400"><UserRound size={58} /></div><h2 className="mt-5 text-2xl font-bold">{profile?.full_name || user?.email}</h2><p className="mt-2 truncate text-sm text-slate-400">{user?.email}</p></aside><form onSubmit={submit} className="rounded-[30px] border border-white/10 bg-white/[.04] p-6"><div className="grid gap-4 md:grid-cols-2">{([{ Icon: UserRound, value: name, setter: setName, label: "Full name" }, { Icon: Mail, value: user?.email || "", setter: () => {}, label: "Email" }, { Icon: MapPin, value: city, setter: setCity, label: "City" }, { Icon: MapPin, value: country, setter: setCountry, label: "Country" }] as Array<{ Icon: LucideIcon; value: string; setter: (v: string) => void; label: string }>).map(({ Icon, value, setter, label }) => <label key={label}><span className="mb-2 block text-sm text-slate-300">{label}</span><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4"><Icon className="text-cyan-400" size={18} /><input value={value} disabled={label === "Email"} onChange={(e) => setter(e.target.value)} className="min-w-0 flex-1 bg-transparent py-4 outline-none" /></div></label>)}</div><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={5} className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 outline-none" /><button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 py-4 font-semibold text-slate-950"><Save size={18} />Save Profile</button></form></div></div></section>;
};
export default Profile;
