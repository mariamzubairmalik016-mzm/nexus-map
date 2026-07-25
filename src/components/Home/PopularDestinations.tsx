import { useEffect, useState } from "react";
import { LoaderCircle, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { geoService } from "../../services/geoService";
import { destinationImage } from "../../services/destinationImage";
import DestinationImage from "../ui/DestinationImage";
import type { GeoCity } from "../../types/geo";

const PopularDestinations = () => {
  const [items, setItems] = useState<GeoCity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void geoService
      .getFeaturedCities(6)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="bg-[#020617] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-4xl font-bold sm:text-5xl">
            Popular Destinations
          </h2>
          <p className="mt-3 text-slate-400">
            Featured locations loaded from Supabase.
          </p>
        </div>

        {loading && (
          <div className="flex min-h-60 items-center justify-center">
            <LoaderCircle
              size={42}
              className="animate-spin text-cyan-400"
            />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="mt-10 rounded-[28px] border border-dashed border-white/10 p-10 text-center text-slate-500">
            Run the geo catalog SQL and check Supabase environment
            variables.
          </div>
        )}

        {!loading && (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((place) => (
              <article
                key={place.id}
                className="group overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04]"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <DestinationImage
                    src={destinationImage(place.name, place.image_url)}
                    alt={place.name}
                    className="h-full w-full"
                    imgClassName="group-hover:scale-110"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-300">
                        {place.country_iso2}
                        {place.region_code
                          ? ` · ${place.region_code}`
                          : ""}
                      </p>

                      <h3 className="mt-1 text-2xl font-bold">
                        {place.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 rounded-xl bg-slate-950/70 px-3 py-2 text-yellow-300">
                      <Star size={16} fill="currentColor" />
                      Featured
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <p className="flex items-center gap-2 text-sm capitalize text-slate-400">
                    <MapPin size={16} className="text-cyan-400" />
                    {place.city_type}
                  </p>

                  <Link
                     href={`/map?place=${encodeURIComponent(place.name)}&lat=${place.latitude}&lng=${place.longitude}`}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold"
                  >
                    Explore Location
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularDestinations;
