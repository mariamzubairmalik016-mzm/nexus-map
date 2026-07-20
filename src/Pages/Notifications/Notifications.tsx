import { useState } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
const initial = [
  { id: 1, title: "Route saved successfully", message: "Karachi to Lahore was added to history.", read: false },
  { id: 2, title: "Weather advisory", message: "Heavy rain is expected near Murree.", read: false },
  { id: 3, title: "Location permission enabled", message: "Nexus Map can use your live GPS.", read: true },
];
const Notifications = () => {
  const [items, setItems] = useState(initial);
  return <section className="min-h-[calc(100vh-80px)] px-4 py-14 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl"><div className="flex items-end justify-between"><div><p className="text-sm uppercase tracking-[.25em] text-cyan-400">Account updates</p><h1 className="mt-3 text-4xl font-bold">Notifications</h1></div><button onClick={() => setItems((current) => current.map((item) => ({ ...item, read: true })))} className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3"><CheckCheck size={18} />Mark all read</button></div><div className="mt-8 space-y-4">{items.map((item) => <article key={item.id} className={`rounded-[24px] border p-5 ${item.read ? "border-white/10 bg-white/[.03]" : "border-cyan-400/20 bg-cyan-400/[.06]"}`}><div className="flex items-start justify-between gap-4"><div className="flex gap-4"><div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-400"><Bell /></div><div><h2 className="font-semibold">{item.title}</h2><p className="mt-2 text-slate-400">{item.message}</p></div></div><button onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))} className="text-red-300"><Trash2 size={18} /></button></div></article>)}</div></div></section>;
};
export default Notifications;
