import { useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Globe2,
  HardDrive,
  Map,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

type Item = {
  id: number;
  location: string;
  scope: string;
  size: number;
  progress: number;
  status: "downloading" | "downloaded";
  latitude: number;
  longitude: number;
};

const knownLocations: Record<
  string,
  { latitude: number; longitude: number }
> = {
  karachi: { latitude: 24.8607, longitude: 67.0011 },
  lahore: { latitude: 31.5204, longitude: 74.3587 },
  islamabad: { latitude: 33.6844, longitude: 73.0479 },
  hunza: { latitude: 36.3167, longitude: 74.65 },
  "hunza valley": { latitude: 36.3167, longitude: 74.65 },
  skardu: { latitude: 35.2971, longitude: 75.6333 },
  peshawar: { latitude: 34.0151, longitude: 71.5249 },
  quetta: { latitude: 30.1798, longitude: 66.975 },
  multan: { latitude: 30.1575, longitude: 71.5249 },
  dubai: { latitude: 25.2048, longitude: 55.2708 },
  makkah: { latitude: 21.3891, longitude: 39.8579 },
  london: { latitude: 51.5074, longitude: -0.1278 },
};

const getCoordinates = (location: string) => {
  const clean = location.toLowerCase().trim();

  const direct = knownLocations[clean];
  if (direct) return direct;

  const matchedKey = Object.keys(knownLocations).find((key) =>
    clean.includes(key),
  );

  return matchedKey
    ? knownLocations[matchedKey]
    : { latitude: 30.3753, longitude: 69.3451 };
};

const OfflineMaps = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("City");
  const [items, setItems] = useState<Item[]>([
    {
      id: 1,
      location: "Hunza Valley, Pakistan",
      scope: "District",
      size: 125,
      progress: 100,
      status: "downloaded",
      latitude: 36.3167,
      longitude: 74.65,
    },
  ]);

  const used = useMemo(
    () =>
      items
        .filter((item) => item.status === "downloaded")
        .reduce((sum, item) => sum + item.size, 0),
    [items],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (!query.trim()) {
      toast.error("Enter any country, city or area.");
      return;
    }

    const id = Date.now();
    const size =
      scope === "Country"
        ? 950
        : scope === "Province / State"
          ? 480
          : scope === "District"
            ? 260
            : 140;

    const coordinates = getCoordinates(query);

    setItems((current) => [
      {
        id,
        location: query.trim(),
        scope,
        size,
        progress: 15,
        status: "downloading",
        ...coordinates,
      },
      ...current,
    ]);

    setTimeout(() => {
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, progress: 60 } : item,
        ),
      );
    }, 500);

    setTimeout(() => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, progress: 100, status: "downloaded" }
            : item,
        ),
      );
      toast.success("Offline map pack is ready.");
    }, 1200);

    setQuery("");
  };

  const openMap = (item: Item) => {
    navigate(
      `/map?place=${encodeURIComponent(item.location)}&lat=${item.latitude}&lng=${item.longitude}`,
    );
  };

  return (
    <section className="min-h-[calc(100vh-80px)] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[.25em] text-cyan-400">
              Worldwide offline navigation
            </p>
            <h1 className="mt-3 text-4xl font-bold">
              Download any location
            </h1>
            <p className="mt-4 max-w-2xl text-slate-400">
              Download a location and open that exact area on the map.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <HardDrive className="text-cyan-400" />
            <p className="mt-3">{used} MB used</p>
          </div>
        </div>

        <div className="mt-9 grid gap-7 lg:grid-cols-[420px_1fr]">
          <form
            onSubmit={submit}
            className="rounded-[30px] border border-white/10 bg-white/[.04] p-6"
          >
            <div className="flex items-center gap-3">
              <Globe2 className="text-cyan-400" />
              <h2 className="text-2xl font-bold">
                Custom map download
              </h2>
            </div>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Karachi, Lahore, Hunza, Dubai..."
              className="mt-6 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 outline-none"
            />

            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4"
            >
              <option>City</option>
              <option>District</option>
              <option>Province / State</option>
              <option>Country</option>
            </select>

            <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 py-4 font-semibold text-slate-950">
              <Download size={19} />
              Download this area
            </button>
          </form>

          <div>
            <h2 className="text-3xl font-bold">Your offline maps</h2>

            <div className="mt-6 space-y-4">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[26px] border border-white/10 bg-white/[.04] p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-4">
                      <div className="rounded-2xl bg-purple-400/10 p-3 text-purple-400">
                        <Map />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            {item.location}
                          </h3>

                          {item.status === "downloaded" && (
                            <CheckCircle2
                              className="text-emerald-400"
                              size={17}
                            />
                          )}
                        </div>

                        <p className="mt-1 text-sm text-slate-400">
                          {item.scope} · {item.size} MB
                        </p>

                        {item.status === "downloading" && (
                          <div className="mt-3">
                            <div className="h-2 w-60 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full bg-cyan-500 transition-all"
                                style={{
                                  width: `${item.progress}%`,
                                }}
                              />
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.progress}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {item.status === "downloaded" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openMap(item)}
                          className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950"
                        >
                          <ExternalLink size={17} />
                          Open Map
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setItems((current) =>
                              current.filter(
                                (row) => row.id !== item.id,
                              ),
                            )
                          }
                          className="rounded-xl bg-red-400/10 p-3 text-red-300"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {items.length === 0 && (
              <div className="mt-6 rounded-[28px] border border-dashed border-white/10 p-16 text-center">
                <WifiOff className="mx-auto text-slate-600" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default OfflineMaps;
