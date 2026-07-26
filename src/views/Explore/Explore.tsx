import { useEffect, useMemo, useState } from "react";
import { Heart, LoaderCircle, MapPin, Search, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import toast from "react-hot-toast";

import { geoService } from "../../services/geoService";
import { favoritesService } from "../../services/favoritesService";
import { offlineDb } from "../../services/offlineDb";
import { destinationImage } from "../../services/destinationImage";
import DestinationImage from "../../components/ui/DestinationImage";
import type { GeoCity } from "../../types/geo";
import { useSession } from "next-auth/react";

const categories = ["All", "Nature", "Cities", "Heritage", "Religious", "Adventure"] as const;
type Category = (typeof categories)[number];

const imageFor = (city: GeoCity) => destinationImage(city.name, city.image_url);

// ISO-3166 alpha-2 -> flag emoji (regional indicator symbols).
const countryFlag = (iso2?: string) => {
  if (!iso2 || iso2.length !== 2) return "🌍";
  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
};

const Explore = () => {
  const { data: session } = useSession();
  const user = session?.user;
  const reduce = useReducedMotion();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [country, setCountry] = useState("All");
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await geoService.getCities({
          query,
          category,
          countryIso2: country === "All" ? undefined : country,
          limit: 120,
        });
        if (!cancelled) setCities(data);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load destinations.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const timer = window.setTimeout(() => void load(), 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [category, country, query]);

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    void favoritesService
      .getAll()
      .then((items) => setFavoriteIds(new Set(items.map((item) => item.place_id))))
      .catch(() => setFavoriteIds(new Set()));
  }, [user]);

  // Keep an offline cache of favorited destinations.
  useEffect(() => {
    if (!cities.length) return;
    const favs = cities
      .filter((city) => favoriteIds.has(city.id))
      .map((city) => ({
        id: city.id,
        name: city.name,
        country: city.country_iso2,
        category: city.city_type,
        imageUrl: city.image_url ?? undefined,
        savedAt: new Date().toISOString(),
      }));
    if (favs.length) void offlineDb.saveFavorites(favs);
  }, [cities, favoriteIds]);

  const countries = useMemo(
    () => Array.from(new Set(cities.map((city) => city.country_iso2))).sort(),
    [cities],
  );

  const featured = useMemo(() => cities.find((city) => city.is_featured) ?? null, [cities]);

  const toggleFavorite = async (city: GeoCity) => {
    if (!user) {
      toast.error("Please login to save favorites.");
      return;
    }
    try {
      setSavingId(city.id);
      const currentlySaved = favoriteIds.has(city.id);
      if (currentlySaved) {
        await favoritesService.remove(city.id);
        await offlineDb.deleteFavorite(city.id);
        setFavoriteIds((current) => {
          const next = new Set(current);
          next.delete(city.id);
          return next;
        });
        toast.success("Removed from favorites.");
      } else {
        await favoritesService.add(city.id);
        await offlineDb.saveFavorite({
          id: city.id,
          name: city.name,
          country: city.country_iso2,
          category: city.city_type,
          imageUrl: city.image_url ?? undefined,
          savedAt: new Date().toISOString(),
        });
        setFavoriteIds((current) => new Set(current).add(city.id));
        toast.success("Added to favorites.");
      }
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Unable to update favorite.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="nexus-page px-4 py-14 sm:px-6 lg:px-8">
      <div className="nexus-container">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <p className="nexus-eyebrow">Worldwide destination discovery</p>
          <h1 className="text-hero-display mt-4 text-5xl sm:text-6xl">
            Explore <span className="nexus-gradient-text">real destinations</span>
          </h1>
          <p className="mx-auto mt-4 max-w-3xl leading-7 text-slate-400">
            Search Pakistan, Makkah, Dubai, London, Tokyo and more — every destination is loaded live from your database.
          </p>
        </motion.div>

        {/* Featured destination */}
        {!loading && !error && featured && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="group relative mt-9 overflow-hidden rounded-[30px] border border-white/10"
          >
            <DestinationImage
              src={imageFor(featured)}
              alt={`${featured.name}, ${featured.country_iso2}`}
              className="h-56 w-full sm:h-72"
              imgClassName="group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-300/15 px-3 py-1 text-xs font-semibold text-yellow-200">
                <Sparkles size={14} /> Featured destination
              </span>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                {countryFlag(featured.country_iso2)} {featured.name}
              </h2>
              <Link
                 href={`/map?place=${encodeURIComponent(featured.name)}&lat=${featured.latitude}&lng=${featured.longitude}`}
                className="nexus-button-primary mt-4 w-fit"
              >
                <MapPin size={17} /> Open on Map
              </Link>
            </div>
          </motion.div>
        )}

        {/* Search */}
        <div className="mx-auto mt-9 flex max-w-4xl items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 backdrop-blur">
          <Search className="text-cyan-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search any city or place — Tokyo, Paris, Dubai, Hunza..."
            className="min-w-0 flex-1 bg-transparent py-4 outline-none"
          />
        </div>

        {/* Category filters */}
        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full border px-5 py-2.5 text-sm ${
                item === category
                  ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
                  : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Country filters */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {["All", "PK", ...countries.filter((item) => item !== "PK")].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCountry(item)}
              className={`shrink-0 rounded-xl border px-4 py-2 text-xs ${
                item === country
                  ? "border-purple-400/30 bg-purple-400/10 text-purple-300"
                  : "border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-300"
              }`}
            >
              {item === "All" ? "All Countries" : `${countryFlag(item)} ${item === "PK" ? "Pakistan" : item}`}
            </button>
          ))}
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="nexus-card nexus-shimmer overflow-hidden">
                <div className="aspect-[16/10] w-full bg-white/[0.04]" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-2/3 rounded bg-white/[0.06]" />
                  <div className="h-4 w-1/2 rounded bg-white/[0.05]" />
                  <div className="h-10 w-full rounded-xl bg-white/[0.05]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="mt-10 rounded-[28px] border border-red-400/20 bg-red-400/10 p-8 text-center text-red-300">
            <h2 className="text-xl font-bold">Destinations could not be loaded</h2>
            <p className="mt-3 text-sm">{error}</p>
            <p className="mt-3 text-xs text-red-200/60">
              Check the frontend Supabase URL/anon key and confirm that geo_cities has a public SELECT policy.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && cities.length === 0 && (
          <div className="mt-10 rounded-[28px] border border-dashed border-white/10 p-16 text-center">
            <MapPin className="mx-auto text-slate-600" size={44} />
            <h2 className="mt-4 text-2xl font-bold">No destinations found</h2>
            <p className="mt-2 text-slate-500">Try a different search or filter.</p>
          </div>
        )}

        {/* Destination grid */}
        {!loading && !error && cities.length > 0 && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {cities.map((city, index) => {
              const saved = favoriteIds.has(city.id);
              return (
                <motion.article
                  key={city.id}
                  initial={reduce ? false : { opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className="nexus-card group overflow-hidden"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <DestinationImage
                      src={imageFor(city)}
                      alt={`${city.name}, ${city.country_iso2} — ${city.city_type}`}
                      className="h-full w-full"
                      imgClassName="group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

                    <motion.button
                      type="button"
                      whileTap={reduce ? undefined : { scale: 0.82 }}
                      disabled={savingId === city.id}
                      onClick={() => void toggleFavorite(city)}
                      className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-950/75 p-3 text-red-300 backdrop-blur-xl"
                    >
                      {savingId === city.id ? (
                        <LoaderCircle size={19} className="animate-spin" />
                      ) : (
                        <Heart size={19} fill={saved ? "currentColor" : "none"} />
                      )}
                    </motion.button>

                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-sm uppercase tracking-[0.14em] text-cyan-300">
                        {countryFlag(city.country_iso2)} {city.country_iso2}
                        {city.region_code ? ` · ${city.region_code}` : ""}
                      </p>
                      <h2 className="mt-1 text-2xl font-bold">{city.name}</h2>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-purple-400/10 px-3 py-1 text-xs capitalize text-purple-300">
                        {city.city_type}
                      </span>
                      {city.is_featured && (
                        <span className="flex items-center gap-1 text-sm text-yellow-300">
                          <Star size={16} fill="currentColor" /> Featured
                        </span>
                      )}
                    </div>

                    <p className="mt-4 min-h-12 text-sm leading-6 text-slate-400">
                      {city.description || `Discover ${city.name} and navigate using Nexus Map.`}
                    </p>

                    <Link
                       href={`/map?place=${encodeURIComponent(city.name)}&lat=${city.latitude}&lng=${city.longitude}`}
                      className="nexus-button-primary mt-5 w-full"
                    >
                      <MapPin size={17} /> Open on Map
                    </Link>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default Explore;
