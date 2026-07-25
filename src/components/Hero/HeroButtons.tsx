import { ArrowRight, Download, Map } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const HeroButtons = () => (
  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
    <Link  href="/map" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 font-semibold shadow-lg shadow-cyan-500/20">
      <Map size={19} /> Explore Map <ArrowRight size={18} />
    </Link>
    <Link  href="/offline-maps" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 font-semibold text-slate-200">
      <Download size={19} /> Offline Maps
    </Link>
  </div>
);
export default HeroButtons;
