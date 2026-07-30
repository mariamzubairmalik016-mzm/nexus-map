import { useState } from "react";
import {
  BedDouble,
  Bot,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  Hotel,
  Info,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Sparkles,
  Utensils,
} from "lucide-react";
import toast from "react-hot-toast";

import { generateTripPlan } from "../../services/tripPlannerService";
import { useInternetStatus } from "../../hooks/useInternetStatus";
import type { GeneratedTripPlan } from "../../types/tripPlanner";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const AIPlanner = () => {
  const online = useInternetStatus();
  const searchParams = useSearchParams();
  const autoTriggered = useRef(false);
  const [destination, setDestination] = useState("Hunza Valley");
  const [days, setDays] = useState(4);
  const [budget, setBudget] = useState(80000);
  const [currency, setCurrency] = useState("PKR");
  const [tripType, setTripType] = useState("Family");
  const [transport, setTransport] = useState("Car");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<GeneratedTripPlan | null>(null);

  const handleGenerate = async (overrides?: {
    dest?: string;
    d?: number;
    b?: number;
    c?: string;
    tType?: string;
    trans?: string;
  }) => {
    const activeDest = (overrides?.dest ?? destination).trim();
    const activeDays = overrides?.d ?? days;
    const activeBudget = overrides?.b ?? budget;
    const activeCurrency = overrides?.c ?? currency;
    const activeTripType = overrides?.tType ?? tripType;
    const activeTransport = overrides?.trans ?? transport;

    if (!activeDest) {
      toast.error("Please enter a destination.");
      return;
    }

    if (activeDays < 1 || activeDays > 14) {
      toast.error("Trip days must be between 1 and 14.");
      return;
    }

    if (activeBudget <= 0) {
      toast.error("Please enter a valid budget.");
      return;
    }

    if (!online) {
      toast.error("Trip planning needs an internet connection.");
      return;
    }

    try {
      setLoading(true);

      const generated = await generateTripPlan({
        destination: activeDest,
        days: activeDays,
        budget: activeBudget,
        currency: activeCurrency,
        tripType: activeTripType,
        transport: activeTransport,
      });

      setPlan(generated);
      toast.success("Your personalized trip plan is ready.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to generate trip plan.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const dest = searchParams?.get("destination");
    if (dest && !autoTriggered.current) {
      autoTriggered.current = true;
      setDestination(dest);
      
      const rawDays = searchParams?.get("days");
      const rawBudget = searchParams?.get("budget");
      
      const parsedDays = rawDays ? parseInt(rawDays, 10) : NaN;
      const parsedBudget = rawBudget ? parseInt(rawBudget, 10) : NaN;
      
      const d = !isNaN(parsedDays) ? parsedDays : days;
      const b = !isNaN(parsedBudget) ? parsedBudget : budget;
      
      const tType = searchParams?.get("tripType") || tripType;
      const trans = searchParams?.get("transport") || transport;
      
      if (!isNaN(parsedDays)) setDays(d);
      if (!isNaN(parsedBudget)) setBudget(b);
      if (searchParams?.get("tripType")) setTripType(tType);
      if (searchParams?.get("transport")) setTransport(trans);

      // Give a tiny delay so the UI updates the fields before starting loader
      setTimeout(() => {
        handleGenerate({ dest, d, b, tType, trans });
      }, 500);
    }
  }, [searchParams]);

  const downloadPlan = () => {
    if (!plan) return;

    const lines = [
      `NEXUS MAP AI TRIP PLAN`,
      ``,
      `Destination: ${plan.destination}`,
      `Duration: ${plan.days} days`,
      `Budget: ${plan.currency} ${plan.budget.toLocaleString()}`,
      `Trip Type: ${plan.tripType}`,
      `Transport: ${plan.transport}`,
      `Hotel: ${plan.hotelSuggestion}`,
      `Food: ${plan.foodSuggestion}`,
      ``,
      ...plan.itinerary.flatMap((day) => [
        `DAY ${day.day}: ${day.title}`,
        day.summary,
        ...day.activities.map(
          (activity) =>
            `${activity.time} - ${activity.title}: ${activity.description} (${plan.currency} ${activity.estimatedCost.toLocaleString()})`,
        ),
        `Estimated daily cost: ${plan.currency} ${day.estimatedDailyCost.toLocaleString()}`,
        ``,
      ]),
      `Packing List: ${plan.packingList.join(", ")}`,
      `Safety Tips: ${plan.safetyTips.join(" | ")}`,
      `Estimated Total: ${plan.currency} ${plan.estimatedTotalCost.toLocaleString()}`,
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${plan.destination
      .toLowerCase()
      .replaceAll(" ", "-")}-trip-plan.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="nexus-page nexus-page-body">
      <div className="nexus-container">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-purple-400">
            Intelligent travel planning
          </p>

          <h1 className="mt-5 text-4xl font-bold sm:text-6xl">
            Build your perfect trip with{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
              Nexus AI
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-3xl text-slate-400">
            Every day now gets a different schedule, activities, cost
            estimate, hotel suggestion, food recommendation and safety guide.
          </p>
        </div>

        <div className="mt-12 grid gap-8 xl:grid-cols-[420px_1fr]">
          <div className="self-start rounded-[var(--r-2xl)] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-2xl xl:sticky xl:top-24">
            <div className="flex items-center gap-3">
              <Bot className="text-cyan-400" />
              <h2 className="text-2xl font-bold">Create your journey</h2>
            </div>

            <div className="mt-7 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-400">
                  Destination
                </span>

                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4">
                  <MapPin size={19} className="text-cyan-400" />
                  <input
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent py-4 outline-none"
                    placeholder="Hunza Valley"
                  />
                </div>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label>
                  <span className="mb-2 block text-sm text-slate-400">
                    Days
                  </span>

                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4">
                    <CalendarDays size={18} className="text-cyan-400" />
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={days}
                      onChange={(event) =>
                        setDays(Number(event.target.value))
                      }
                      className="min-w-0 flex-1 bg-transparent py-4 outline-none"
                    />
                  </div>
                </label>

                <label>
                  <span className="mb-2 block text-sm text-slate-400">
                    Budget
                  </span>

                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4">
                    <CircleDollarSign
                      size={18}
                      className="text-purple-400"
                    />
                    <input
                      type="number"
                      min={1}
                      value={budget}
                      onChange={(event) =>
                        setBudget(Number(event.target.value))
                      }
                      className="min-w-0 flex-1 bg-transparent py-4 outline-none"
                    />
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label>
                  <span className="mb-2 block text-sm text-slate-400">
                    Trip type
                  </span>
                  <select
                    value={tripType}
                    onChange={(event) => setTripType(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 outline-none"
                  >
                    <option>Family</option>
                    <option>Solo</option>
                    <option>Couple</option>
                    <option>Friends</option>
                    <option>Business</option>
                    <option>Adventure</option>
                  </select>
                </label>

                <label>
                  <span className="mb-2 block text-sm text-slate-400">
                    Transport
                  </span>
                  <select
                    value={transport}
                    onChange={(event) => setTransport(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 outline-none"
                  >
                    <option>Car</option>
                    <option>Bus</option>
                    <option>Train</option>
                    <option>Flight</option>
                    <option>Motorcycle</option>
                  </select>
                </label>
              </div>

              <label>
                <span className="mb-2 block text-sm text-slate-400">
                  Currency
                </span>
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 outline-none"
                >
                  <option>PKR</option>
                  <option>USD</option>
                  <option>SAR</option>
                  <option>AED</option>
                  <option>GBP</option>
                  <option>EUR</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={loading}
                className="nexus-button-primary nexus-button-block"
              >
                {loading ? (
                  <LoaderCircle className="animate-spin" size={20} />
                ) : (
                  <Sparkles size={20} />
                )}

                {loading ? "Creating personalized plan..." : "Generate AI Plan"}
              </button>
            </div>
          </div>

          <div className="rounded-[var(--r-2xl)] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            {!plan ? (
              <div className="flex min-h-[620px] flex-col items-center justify-center text-center">
                <Sparkles size={54} className="text-purple-400" />
                <h2 className="mt-6 text-3xl font-bold">
                  Your itinerary will appear here
                </h2>
                <p className="mt-3 max-w-xl text-slate-400">
                  Fill the journey form and generate a complete day-by-day
                  plan. Each day will contain different activities.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-cyan-400">
                      Generated itinerary
                    </p>
                    <h2 className="mt-3 text-4xl font-bold">
                      {plan.destination}
                    </h2>
                    <p className="mt-3 text-slate-400">
                      {plan.days}-day {plan.tripType.toLowerCase()} trip within{" "}
                      {plan.currency} {plan.budget.toLocaleString()}.
                    </p>

                    {/* Where the places came from. Plans are not all sourced
                        equally — some destinations have no POI coverage at all
                        — and a template plan should not look researched. */}
                    {plan.placeSource === "generic" ? (
                      <p className="mt-3 inline-flex items-start gap-2 rounded-[var(--r-sm)] border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <span>
                          No place data is available for {plan.destination}, so this is a general template.
                          Times, costs and structure are usable; the stops are not specific venues.
                        </span>
                      </p>
                    ) : plan.placeSource ? (
                      <p className="mt-3 inline-flex items-center gap-2 rounded-[var(--r-sm)] border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
                        <Info size={14} className="shrink-0" aria-hidden="true" />
                        <span>
                          {plan.placeSource === "curated"
                            ? "Stops are from the Nexus Map curated guide for this destination."
                            : plan.placeSource === "mixed"
                              ? "Stops combine the Nexus Map guide with live place data."
                              : "Stops are real places from live search."}
                        </span>
                      </p>
                    ) : null}

                    {/* The feature is named "AI Trip Planner", so it should say
                        when the model did not write anything. The plan is still
                        real either way — only the wording differs. */}
                    {plan.narrativeSource === "generated" && (
                      <p className="mt-2 text-xs text-slate-500">
                        Written by Nexus Map&apos;s planner. AI wording is unavailable right now.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={downloadPlan}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                  >
                    <Download size={17} />
                    Download Plan
                  </button>
                </div>

                <div className="mt-7 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <Hotel className="text-cyan-400" size={21} />
                    <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">
                      Hotel
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {plan.hotelSuggestion}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <Utensils className="text-purple-400" size={21} />
                    <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">
                      Food
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {plan.foodSuggestion}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <CircleDollarSign
                      className="text-emerald-400"
                      size={21}
                    />
                    <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">
                      Estimated total
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {plan.currency}{" "}
                      {plan.estimatedTotalCost.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-7 space-y-5">
                  {plan.itinerary.map((day) => (
                    <article
                      key={day.day}
                      className="rounded-[var(--r-xl)] border border-white/10 bg-slate-950/35 p-5 sm:p-6"
                    >
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div>
                          <p className="text-sm font-semibold text-cyan-400">
                            Day {day.day}
                          </p>
                          <h3 className="mt-1 text-2xl font-bold">
                            {day.title}
                          </h3>
                          <p className="mt-2 text-sm text-slate-400">
                            {day.summary}
                          </p>
                        </div>

                        <div className="rounded-xl bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
                          {plan.currency}{" "}
                          {day.estimatedDailyCost.toLocaleString()}
                        </div>
                      </div>

                      <div className="mt-5 space-y-3">
                        {day.activities.map((activity, index) => (
                          <div
                            key={`${day.day}-${activity.time}-${index}`}
                            className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-[90px_1fr_auto]"
                          >
                            <div className="flex items-center gap-2 text-sm text-cyan-300">
                              <Clock3 size={16} />
                              {activity.time}
                            </div>

                            <div>
                              <p className="font-semibold">
                                {activity.title}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-400">
                                {activity.description}
                              </p>
                            </div>

                            <div className="text-sm text-slate-500">
                              {plan.currency}{" "}
                              {activity.estimatedCost.toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="mt-7 grid gap-5 lg:grid-cols-2">
                  <div className="rounded-[var(--r-lg)] border border-white/10 bg-white/[0.025] p-5">
                    <div className="flex items-center gap-3">
                      <BedDouble className="text-purple-400" />
                      <h3 className="text-xl font-bold">Packing list</h3>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {plan.packingList.map((item) => (
                        <p
                          key={item}
                          className="flex items-center gap-2 text-sm text-slate-300"
                        >
                          <CheckCircle2
                            size={16}
                            className="text-emerald-400"
                          />
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[var(--r-lg)] border border-white/10 bg-white/[0.025] p-5">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="text-cyan-400" />
                      <h3 className="text-xl font-bold">Safety tips</h3>
                    </div>

                    <div className="mt-4 space-y-3">
                      {plan.safetyTips.map((item) => (
                        <p
                          key={item}
                          className="flex items-start gap-2 text-sm leading-6 text-slate-300"
                        >
                          <CheckCircle2
                            size={16}
                            className="mt-1 shrink-0 text-emerald-400"
                          />
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AIPlanner;
