import { useEffect, useState } from "react";
import { Heart, LoaderCircle, MapPin, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { offlineDb, type OfflineFavorite } from "../../services/offlineDb";
import { favoritesService } from "../../services/favoritesService";
import { destinationImage } from "../../services/destinationImage";
import DestinationImage from "../../components/ui/DestinationImage";
import PageShell from "../../components/layouts/PageShell";
import PageHeader from "../../components/layouts/PageHeader";

const Favorites = () => {
  const [items, setItems] = useState<OfflineFavorite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void offlineDb
      .getFavorites()
      .then((favs) => setItems(favs.sort((a, b) => b.savedAt.localeCompare(a.savedAt))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const remove = async (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    await offlineDb.deleteFavorite(id);
    try {
      await favoritesService.remove(id);
    } catch {
      // Offline or signed out — the local copy is removed; server stays in sync
      // next time Explore loads.
    }
    toast.success("Removed from favorites.");
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Saved collection"
        title="Your favorite places"
        description={
          items.length > 0
            ? `${items.length} ${items.length === 1 ? "place" : "places"} saved for offline access.`
            : undefined
        }
      />

      {loading && (
        <div className="flex min-h-80 items-center justify-center" role="status" aria-label="Loading favorites">
          <LoaderCircle size={48} className="animate-spin text-cyan-400" />
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((place) => (
            <article key={place.id} className="nexus-card-elevated overflow-hidden">
              <DestinationImage
                src={destinationImage(place.name, place.imageUrl)}
                alt={place.name}
                className="aspect-[16/10] w-full"
              />
              <div className="p-5">
                <h2 className="font-display text-xl font-bold">{place.name}</h2>
                <p className="mt-2 text-sm text-slate-400">
                  {[place.city, place.country].filter(Boolean).join(", ") || "Saved place"}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Link
                    href={`/map?place=${encodeURIComponent(place.name)}`}
                    className="nexus-button-primary nexus-button-sm"
                  >
                    <MapPin size={17} aria-hidden="true" />
                    Map
                  </Link>
                  <button
                    onClick={() => remove(place.id)}
                    className="nexus-button-danger-quiet nexus-button-sm"
                  >
                    <Trash2 size={17} aria-hidden="true" />
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="mt-10 rounded-[var(--r-xl)] border border-dashed border-white/10 p-16 text-center">
          <Heart className="mx-auto text-slate-600" size={42} aria-hidden="true" />
          <p className="mt-4 font-display text-2xl font-bold">No favorites yet</p>
          <p className="mx-auto mt-2 max-w-md text-slate-400">
            Tap the heart on any destination in{" "}
            <Link href="/explore" className="text-cyan-400 underline-offset-4 hover:underline">
              Explore
            </Link>{" "}
            to save it here.
          </p>
        </div>
      )}
    </PageShell>
  );
};

export default Favorites;
