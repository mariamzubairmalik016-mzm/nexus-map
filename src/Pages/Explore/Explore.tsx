import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  LoaderCircle,
  MapPin,
  Search,
  Star,
} from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { geoService } from "../../services/geoService";
import { favoritesService } from "../../services/favoritesService";
import type { GeoCity } from "../../types/geo";
import { useAuth } from "../../hooks/useAuth";

const categories = [
  "All",
  "Nature",
  "Cities",
  "Heritage",
  "Religious",
  "Adventure",
] as const;

type Category = (typeof categories)[number];

const fallbackImage = "/destinations/karachi.jpg";

const Explore = () => {
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [country, setCountry] = useState("All");
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    new Set(),
  );
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
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load destinations.",
          );
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
      .then((items) =>
        setFavoriteIds(new Set(items.map((item) => item.place_id))),
      )
      .catch(() => setFavoriteIds(new Set()));
  }, [user]);

  const countries = useMemo(
    () =>
      Array.from(new Set(cities.map((city) => city.country_iso2))).sort(),
    [cities],
  );

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
        setFavoriteIds((current) => {
          const next = new Set(current);
          next.delete(city.id);
          return next;
        });
        toast.success("Removed from favorites.");
      } else {
        await favoritesService.add(city.id);
        setFavoriteIds((current) => new Set(current).add(city.id));
        toast.success("Added to favorites.");
      }
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update favorite.",
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="min-h-[calc(100vh-80px)] bg-[#020617] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-400">
            Pakistan and worldwide discovery
          </p>

          <h1 className="mt-4 text-4xl font-bold sm:text-6xl">
            Explore real destinations
          </h1>

          <p className="mx-auto mt-4 max-w-3xl leading-7 text-slate-400">
            Destinations are now loaded from your Supabase database.
            Search Pakistan, Makkah, Dubai, London, Tokyo and more.
          </p>
        </div>

        <div className="mx-auto mt-9 flex max-w-4xl items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4">
          <Search className="text-cyan-400" />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Karachi, Murree, Makkah, Dubai..."
            className="min-w-0 flex-1 bg-transparent py-4 outline-none"
          />
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full border px-5 py-2.5 text-sm ${
                item === category
                  ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
                  : "border-white/10 bg-white/5 text-slate-400"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {["All", "PK", ...countries.filter((item) => item !== "PK")].map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCountry(item)}
                className={`shrink-0 rounded-xl border px-4 py-2 text-xs ${
                  item === country
                    ? "border-purple-400/30 bg-purple-400/10 text-purple-300"
                    : "border-white/10 bg-white/[0.03] text-slate-500"
                }`}
              >
                {item === "All"
                  ? "All Countries"
                  : item === "PK"
                    ? "Pakistan"
                    : item}
              </button>
            ),
          )}
        </div>

        {loading && (
          <div className="flex min-h-80 items-center justify-center">
            <LoaderCircle
              size={48}
              className="animate-spin text-cyan-400"
            />
          </div>
        )}

        {error && !loading && (
          <div className="mt-10 rounded-[28px] border border-red-400/20 bg-red-400/10 p-8 text-center text-red-300">
            <h2 className="text-xl font-bold">
              Destinations could not be loaded
            </h2>
            <p className="mt-3 text-sm">{error}</p>
            <p className="mt-3 text-xs text-red-200/60">
              Check the frontend Supabase URL/anon key and confirm that
              geo_cities has a public SELECT policy.
            </p>
          </div>
        )}

        {!loading && !error && cities.length === 0 && (
          <div className="mt-10 rounded-[28px] border border-dashed border-white/10 p-16 text-center">
            <MapPin className="mx-auto text-slate-600" size={44} />
            <h2 className="mt-4 text-2xl font-bold">
              No destinations found
            </h2>
          </div>
        )}

        {!loading && !error && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {cities.map((city) => {
              const saved = favoriteIds.has(city.id);

              return (
                <article
                  key={city.id}
                  className="group overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={city.image_url || fallbackImage}
                      alt={city.name}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                      onError={(event) => {
                        event.currentTarget.src = fallbackImage;
                      }}
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

                    <button
                      type="button"
                      disabled={savingId === city.id}
                      onClick={() => void toggleFavorite(city)}
                      className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-950/75 p-3 text-red-300 backdrop-blur-xl"
                    >
                      {savingId === city.id ? (
                        <LoaderCircle size={19} className="animate-spin" />
                      ) : (
                        <Heart
                          size={19}
                          fill={saved ? "currentColor" : "none"}
                        />
                      )}
                    </button>

                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-sm uppercase tracking-[0.14em] text-cyan-300">
                        {city.country_iso2}
                        {city.region_code
                          ? ` · ${city.region_code}`
                          : ""}
                      </p>

                      <h2 className="mt-1 text-2xl font-bold">
                        {city.name}
                      </h2>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-purple-400/10 px-3 py-1 text-xs capitalize text-purple-300">
                        {city.city_type}
                      </span>

                      {city.is_featured && (
                        <span className="flex items-center gap-1 text-sm text-yellow-300">
                          <Star size={16} fill="currentColor" />
                          Featured
                        </span>
                      )}
                    </div>

                    <p className="mt-4 min-h-12 text-sm leading-6 text-slate-400">
                      {city.description ||
                        `Discover ${city.name} and navigate using Nexus Map.`}
                    </p>

                    <Link
                      to={`/map?place=${encodeURIComponent(city.name)}&lat=${city.latitude}&lng=${city.longitude}`}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 font-semibold text-slate-950"
                    >
                      <MapPin size={17} />
                      Open on Map
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default Explore;
