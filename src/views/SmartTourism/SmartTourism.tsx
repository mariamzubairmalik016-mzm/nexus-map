"use client";
import { useState, useMemo, useCallback } from "react";
import {
  Search,
  MapPin,
  Star,
  Sparkles,
  Compass,
  Sun,
  Mountain,
  UtensilsCrossed,
  Camera,
  History,
  Umbrella,
  Snowflake,
  Gem,
  Users,
  DollarSign,
  Heart,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import ReviewPanel from "../../components/tourism/ReviewPanel";
import toast from "react-hot-toast";

import { tourismDiscoveryService } from "../../services/tourismDiscoveryService";
import type {
  TourismPOI,
  TourismCategory,
  TravelMood,
  CityDiscovery,
  BudgetAnalysis,
  RouteComparison,
  RiskScore,
} from "../../types/tourism";
import {
  TRAVEL_MOODS,
  TRAVEL_MOOD_LABELS,
  TOURISM_CATEGORIES,
  TOURISM_CATEGORY_LABELS,
} from "../../types/tourism";

const MOOD_ICONS: Record<string, LucideIcon> = {
  relax: Sun, adventure: Mountain, romantic: Heart,
  family: Users, food: UtensilsCrossed, photography: Camera,
  history: History, beach: Umbrella, snow: Snowflake,
  nature: Mountain, luxury: Gem, budget: DollarSign,
};

const SmartTourism = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMood, setActiveMood] = useState<TravelMood | null>(null);
  const [activeCategory, setActiveCategory] = useState<TourismCategory | null>(null);
  const [results, setResults] = useState<TourismPOI[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<TourismPOI | null>(null);
  const [showBudget, setShowBudget] = useState(false);
  const [budgetParams, setBudgetParams] = useState({
    totalBudget: 100000,
    days: 5,
    travelers: 2,
    destination: "",
    currency: "PKR",
  });
  const [budgetResult, setBudgetResult] = useState<BudgetAnalysis | null>(null);
  const [cityDiscovery, setCityDiscovery] = useState<CityDiscovery | null>(null);

  // Search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() && !activeMood && !activeCategory) {
      toast.error("Search for a city, place, or select a mood");
      return;
    }
    setLoading(true);
    try {
      const data = await tourismDiscoveryService.searchPOI({
        query: searchQuery || undefined,
        category: activeCategory || undefined,
        mood: activeMood || undefined,
        limit: 50,
      });
      setResults(data);

      // Auto city discovery
      if (searchQuery.trim()) {
        const discovery = await tourismDiscoveryService.getCityDiscovery(searchQuery.trim());
        setCityDiscovery(discovery);
      } else {
        setCityDiscovery(null);
      }
    } catch {
      toast.error("Failed to search destinations");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeMood, activeCategory]);

  // Budget analysis
  const handleBudgetAnalysis = () => {
    const result = tourismDiscoveryService.calculateBudget(
      budgetParams.totalBudget,
      budgetParams.days,
      budgetParams.travelers,
      budgetParams.destination || "Your destination",
      budgetParams.currency
    );
    setBudgetResult(result);
    setShowBudget(true);
  };

  return (
    <section className="nexus-page nexus-page-body">
      <div className="nexus-container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="nexus-eyebrow">Smart Tourism Discovery</p>
          <h1 className="text-hero-display mt-4 text-5xl sm:text-6xl">
            Discover Your{" "}
            <span className="nexus-gradient-text">Next Adventure</span>
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-slate-400">
            Search by mood, category, or destination. Get personalized recommendations, budget analysis, and hidden gems.
          </p>
        </motion.div>

        {/* Search */}
        <div className="mx-auto mt-10 flex max-w-3xl gap-3">
          <div className="nexus-card-elevated flex flex-1 items-center gap-3 px-4">
            <Search className="text-cyan-400" size={20} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by city — Karachi, Hunza, Dubai..."
              className="min-w-0 flex-1 bg-transparent py-4 outline-none"
            />
          </div>
          <button onClick={handleSearch} className="nexus-button-primary px-6 py-4">
            <Sparkles size={18} /> Discover
          </button>
        </div>

        {/* Moods */}
        <div className="mt-8">
          <p className="mb-4 text-sm font-semibold text-slate-400">TRAVEL BY MOOD</p>
          <div className="flex flex-wrap gap-2">
            {TRAVEL_MOODS.map((mood) => {
              const Icon = MOOD_ICONS[mood] || Compass;
              return (
                <button
                  key={mood}
                  onClick={() => {
                    setActiveMood(activeMood === mood ? null : mood);
                    setActiveCategory(null);
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                    activeMood === mood
                      ? "border-purple-400/30 bg-gradient-to-r from-purple-400/15 to-pink-600/10 text-purple-300 shadow-[inset_0_1px_0_rgba(168,85,247,0.1)]"
                      : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.12] hover:text-white"
                  }`}
                >
                  <Icon size={16} />
                  {TRAVEL_MOOD_LABELS[mood]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Categories */}
        <div className="mt-4">
          <p className="mb-4 text-sm font-semibold text-slate-400">BROWSE BY CATEGORY</p>
          <div className="flex flex-wrap gap-2">
            {TOURISM_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(activeCategory === cat ? null : cat);
                  setActiveMood(null);
                }}
                className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200 ${
                  activeCategory === cat
                    ? "border-cyan-400/30 bg-gradient-to-r from-cyan-400/15 to-blue-600/10 text-cyan-300"
                    : "border-white/[0.05] bg-white/[0.02] text-slate-500 hover:border-white/[0.1] hover:text-slate-300"
                }`}
              >
                {TOURISM_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Budget Analyzer Toggle */}
        <div className="mt-6">
          <button
            onClick={() => setShowBudget(!showBudget)}
            className="nexus-button-glossy"
          >
            <DollarSign size={18} />
            {showBudget ? "Hide Budget Analyzer" : "Smart Budget Analyzer"}
          </button>
        </div>

        {/* Budget Analyzer */}
        {showBudget && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="nexus-card-elevated mt-4 p-6"
          >
            <h3 className="text-xl font-bold text-white">Smart Budget Analyzer</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="mb-2 block text-sm text-slate-400">Total Budget</label>
                <input
                  type="number"
                  value={budgetParams.totalBudget}
                  onChange={(e) => setBudgetParams({ ...budgetParams, totalBudget: Number(e.target.value) })}
                  className="nexus-input"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-400">Days</label>
                <input
                  type="number"
                  value={budgetParams.days}
                  onChange={(e) => setBudgetParams({ ...budgetParams, days: Number(e.target.value) })}
                  className="nexus-input"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-400">Travelers</label>
                <input
                  type="number"
                  value={budgetParams.travelers}
                  onChange={(e) => setBudgetParams({ ...budgetParams, travelers: Number(e.target.value) })}
                  className="nexus-input"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-400">Destination</label>
                <input
                  value={budgetParams.destination}
                  onChange={(e) => setBudgetParams({ ...budgetParams, destination: e.target.value })}
                  className="nexus-input"
                  placeholder="e.g. Hunza"
                />
              </div>
              <div className="flex items-end">
                <button onClick={handleBudgetAnalysis} className="nexus-button-primary w-full">
                  Analyze
                </button>
              </div>
            </div>

            {budgetResult && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-white">{budgetResult.score}/100</div>
                  <div>
                    <p className="text-lg font-semibold text-white">Budget Score: {budgetResult.scoreLabel}</p>
                    <p className="text-sm text-slate-400">
                      Total: {budgetResult.currency} {budgetResult.totalEstimated.toLocaleString()} · Daily avg: {budgetResult.currency} {budgetResult.dailyAverage.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {budgetResult.breakdown.map((item) => (
                    <div key={item.category} className="rounded-2xl border border-white/[0.06] bg-slate-950/50 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <span className="text-xs text-slate-500">{item.percentage}%</span>
                      </div>
                      <p className="mt-1 text-lg font-bold text-white">
                        {budgetResult.currency} {item.estimatedCost.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{item.tips[0]}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-8 flex items-center justify-center py-20">
            <div className="animate-spin h-10 w-10 rounded-full border-2 border-cyan-400 border-t-transparent" />
          </div>
        )}

        {/* City Discovery */}
        {cityDiscovery && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="nexus-card-cinematic mt-8 p-6"
          >
            <h2 className="text-2xl font-bold text-white">
              Discovering {cityDiscovery.city}, {cityDiscovery.country}
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cityDiscovery.famousPlaces.length > 0 && (
                <div className="rounded-2xl border border-white/[0.06] bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-wider text-cyan-400">Famous Places</p>
                  <p className="mt-2 text-lg font-bold text-white">{cityDiscovery.famousPlaces.length}</p>
                  <p className="text-xs text-slate-400">Must-visit attractions</p>
                </div>
              )}
              {cityDiscovery.historicalSites.length > 0 && (
                <div className="rounded-2xl border border-white/[0.06] bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-wider text-purple-400">Historical Sites</p>
                  <p className="mt-2 text-lg font-bold text-white">{cityDiscovery.historicalSites.length}</p>
                  <p className="text-xs text-slate-400">Rich cultural heritage</p>
                </div>
              )}
              <div className="rounded-2xl border border-white/[0.06] bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wider text-emerald-400">Local Food</p>
                <p className="mt-2 text-lg font-bold text-white">{cityDiscovery.localFood.length}</p>
                <p className="text-xs text-slate-400">Must-try dishes</p>
              </div>
            </div>

            {cityDiscovery.localFood.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-semibold text-slate-400">Local Food Specialties</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {cityDiscovery.localFood.map((food) => (
                    <span key={food} className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-300">
                      {food}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {cityDiscovery.shoppingStreets.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-semibold text-slate-400">Shopping Streets</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {cityDiscovery.shoppingStreets.map((street) => (
                    <span key={street} className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-300">
                      {street}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Results */}
        {results.length > 0 && !loading && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-white">
              {results.length} {results.length === 1 ? "Place" : "Places"} Found
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((poi) => (
                <motion.article
                  key={poi.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="nexus-card-elevated overflow-hidden p-0 group cursor-pointer"
                  onClick={() => setSelectedPoi(poi === selectedPoi ? null : poi)}
                >
                  <div className="relative aspect-[16/9] bg-gradient-to-br from-cyan-500/10 to-purple-600/10">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <span className="rounded-full border border-white/[0.08] bg-slate-950/70 px-2.5 py-1 text-xs text-slate-300 backdrop-blur-sm">
                        {TOURISM_CATEGORY_LABELS[poi.category]}
                      </span>
                    </div>
                    {poi.priceLevel && (
                      <div className="absolute top-3 right-3 rounded-full bg-slate-950/70 px-2.5 py-1 text-xs text-yellow-300 backdrop-blur-sm">
                        {"$".repeat(poi.priceLevel)}
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-bold text-white">{poi.name}</h3>
                      {/* Live places carry no rating, and printing a bare "0"
                          reads as "rated zero" rather than "not yet rated". */}
                      {poi.rating > 0 && (
                        <div className="flex shrink-0 items-center gap-1 text-sm text-yellow-300">
                          <Star size={14} fill="currentColor" aria-hidden="true" />
                          {poi.rating}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-400 line-clamp-2">{poi.shortDescription || poi.description}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin size={12} />
                      {poi.city}, {poi.country}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Link
                        href={`/map?place=${encodeURIComponent(poi.name)}&lat=${poi.latitude}&lng=${poi.longitude}`}
                        className="nexus-button-glossy flex-1 text-xs py-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MapPin size={14} /> View on Map
                      </Link>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>

            {/* Reviews for whichever place is open. Selecting a card was
                previously state with nothing attached to it — the click
                toggled `selectedPoi` and nothing rendered. */}
            {selectedPoi && (
              <div className="mt-8">
                <ReviewPanel placeId={selectedPoi.id} placeName={selectedPoi.name} />
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && results.length === 0 && !cityDiscovery && (
          <div className="mt-16 text-center">
            <Compass className="mx-auto text-slate-600" size={48} />
            <h2 className="mt-4 text-2xl font-bold text-white">Start Your Discovery</h2>
            <p className="mt-2 text-slate-400">
              Search a destination, select a mood, or browse by category to find amazing places.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default SmartTourism;
