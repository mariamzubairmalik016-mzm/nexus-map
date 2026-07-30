import { useState } from "react";
import { LocateFixed, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

const AISearch = () => {
  const navigate = useRouter();
  const [query, setQuery] = useState("");

  const submit = () => {
    const value = query.trim();
    navigate.push(value ? `/map?place=${encodeURIComponent(value)}` : "/map");
  };

  return (
    <section className="relative px-4 py-16 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-6xl">
        <div className="nexus-card-cinematic p-6 text-center sm:p-10">
          <p className="nexus-eyebrow">Intelligent discovery</p>
          <h2 className="text-hero-display mt-4 text-[1.75rem] sm:text-4xl md:text-5xl">
            AI Smart Search
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-400">
            Search countries, cities and nearby services from one intelligent interface.
          </p>

          <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/[0.08] bg-slate-950/60 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 focus-within:border-cyan-400/30 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.06)]">
              <Search className="text-cyan-400" size={20} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Search Pakistan, Tokyo, hospitals, hotels..."
                className="min-w-0 flex-1 bg-transparent py-4 outline-none"
              />
              <LocateFixed className="text-slate-500" size={19} />
            </div>
            <button
              onClick={submit}
              className="nexus-button-primary px-7 py-4"
            >
              <Sparkles size={18} />
              Search
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AISearch;
