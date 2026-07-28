import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Construction,
  LoaderCircle,
  MapPin,
  PlusCircle,
  ThumbsUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../../services/api";

type Report = {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: string;
  helpfulCount: number;
  createdAt: string;
};

const CACHE_KEY = "nexus-community-reports";

const readCache = (): Report[] => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
  } catch {
    return [];
  }
};

const writeCache = (reports: Report[]) => localStorage.setItem(CACHE_KEY, JSON.stringify(reports));

const Community = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    category: "traffic",
  });

  const load = () =>
    api
      .get<Report[]>("/reports")
      .then((data) => {
        setReports(data);
        writeCache(data);
      })
      .catch(() => {
        // Offline / server down — fall back to the last cached reports.
        setReports(readCache());
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () =>
    setForm({ title: "", description: "", location: "", category: "traffic" });

  const submit = async () => {
    const draft = { ...form };
    try {
      const created = await api.post<Report>("/reports", draft);
      setReports((current) => {
        const next = [created, ...current];
        writeCache(next);
        return next;
      });
      resetForm();
      toast.success("Community report submitted.");
    } catch (error) {
      const offline =
        !navigator.onLine ||
        (error instanceof Error && /offline|queued/i.test(error.message));
      if (offline) {
        // The write was queued for background sync — show it optimistically.
        const optimistic: Report = {
          id: crypto.randomUUID(),
          ...draft,
          status: "pending sync",
          helpfulCount: 0,
          createdAt: new Date().toISOString(),
        };
        setReports((current) => {
          const next = [optimistic, ...current];
          writeCache(next);
          return next;
        });
        resetForm();
        toast.success("Saved offline — it will sync when you're back online.");
      } else {
        toast.error(error instanceof Error ? error.message : "Unable to submit report.");
      }
    }
  };

  return (
    <section className="nexus-page nexus-page-body">
      <div className="nexus-container">
        <p className="text-sm uppercase tracking-[0.24em] text-purple-400">
          Community intelligence
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
          Report road conditions
        </h1>

        <div className="mt-8 grid gap-7 lg:grid-cols-[420px_1fr]">
          <div className="self-start rounded-[var(--r-xl)] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center gap-3">
              <PlusCircle className="text-cyan-400" />
              <h2 className="text-2xl font-bold">New Report</h2>
            </div>

            <div className="mt-6 space-y-4">
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    title: e.target.value,
                  }))
                }
                placeholder="Road closed near university"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 outline-none"
              />

              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe the issue..."
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 outline-none"
              />

              <input
                value={form.location}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    location: e.target.value,
                  }))
                }
                placeholder="Karachi, Gulshan-e-Iqbal"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 outline-none"
              />

              <select
                value={form.category}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    category: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 outline-none"
              >
                <option value="traffic">Traffic</option>
                <option value="accident">Accident</option>
                <option value="road_block">Road Block</option>
                <option value="construction">Construction</option>
                <option value="flood">Flood</option>
                <option value="broken_road">Broken Road</option>
                <option value="police_check">Police Check</option>
              </select>

              <button
                onClick={() => void submit()}
                className="nexus-button-primary nexus-button-block"
              >
                Submit Report
              </button>
            </div>
          </div>

          <div>
            {loading ? (
              <div className="flex min-h-80 items-center justify-center">
                <LoaderCircle className="animate-spin text-cyan-400" size={44} />
              </div>
            ) : reports.length === 0 ? (
              <div className="rounded-[var(--r-xl)] border border-dashed border-white/10 p-14 text-center text-slate-500">
                No community reports yet.
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <article
                    key={report.id}
                    className="rounded-[var(--r-xl)] border border-white/10 bg-white/[0.04] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-sm text-amber-300">
                          <AlertTriangle size={16} />
                          {report.category}
                        </div>
                        <h2 className="mt-2 text-xl font-bold">
                          {report.title}
                        </h2>
                      </div>
                      <span className="rounded-full bg-purple-400/10 px-3 py-1 text-xs text-purple-300">
                        {report.status}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {report.description}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-2">
                        <MapPin size={15} />
                        {report.location}
                      </span>
                      <span className="flex items-center gap-2">
                        <ThumbsUp size={15} />
                        {report.helpfulCount} helpful
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Community;
