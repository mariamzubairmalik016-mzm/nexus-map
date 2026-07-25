import { useState } from "react";
import { LocateFixed, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

const AISearch = () => {
  const navigate = useRouter();
  const [query, setQuery] = useState("");

  const submit = () => {
    const value = query.trim();
    navigate(value ? `/map?place=${encodeURIComponent(value)}` : "/map");
  };

  return (
    <section className="bg-[#020617] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[32px] border border-white/10 bg-white/[.04] p-5 text-center shadow-2xl backdrop-blur-3xl sm:p-8">
        <p className="text-sm uppercase tracking-[.28em] text-cyan-400">Intelligent discovery</p>
        <h2 className="mt-3 text-3xl font-bold sm:text-5xl">AI Smart Search</h2>
        <p className="mt-3 text-slate-400">Search countries, cities and nearby services from one intelligent interface.</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4">
            <Search className="text-cyan-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Search Pakistan, Tokyo, hospitals, hotels..." className="min-w-0 flex-1 bg-transparent py-4 outline-none" />
            <LocateFixed className="text-slate-500" size={19} />
          </div>
          <button onClick={submit} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-6 py-4 font-semibold text-slate-950">
            <Sparkles size={18} /> Search
          </button>
        </div>
      </div>
    </section>
  );
};
export default AISearch;
