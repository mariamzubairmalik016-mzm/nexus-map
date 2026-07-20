const items = [
  { value: "195+", label: "Countries" },
  { value: "120M+", label: "Places" },
  { value: "24/7", label: "AI Help" },
];

const HeroStats = () => (
  <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
    {items.map((item) => (
      <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[.04] px-3 py-4 text-center backdrop-blur-xl">
        <p className="text-xl font-bold sm:text-2xl">{item.value}</p>
        <p className="mt-1 text-xs text-slate-400 sm:text-sm">{item.label}</p>
      </div>
    ))}
  </div>
);
export default HeroStats;
