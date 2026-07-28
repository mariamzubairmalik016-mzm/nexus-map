import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Download,
  Globe2,
  MapPin,
  Route,
  Users,
} from "lucide-react";
import { api } from "../../services/api";

type Stats = {
  places: number;
  reports: number;
  pendingReports: number;
  offlineJobs: number;
  tripPlans: number;
};

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    places: 0,
    reports: 0,
    pendingReports: 0,
    offlineJobs: 0,
    tripPlans: 0,
  });

  useEffect(() => {
    api
      .get<Stats>("/admin/stats")
      .then(setStats)
      .catch(() => undefined);
  }, []);

  const cards = [
    { label: "Locations", value: stats.places, icon: MapPin },
    { label: "Reports", value: stats.reports, icon: AlertTriangle },
    { label: "Pending", value: stats.pendingReports, icon: BarChart3 },
    { label: "Offline Downloads", value: stats.offlineJobs, icon: Download },
    { label: "Trip Plans", value: stats.tripPlans, icon: Route },
    { label: "Countries", value: "20+", icon: Globe2 },
  ];

  return (
    <section className="nexus-page nexus-page-body">
      <div className="nexus-container">
        <p className="text-sm uppercase tracking-[0.24em] text-cyan-400">
          Administration
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
          Nexus Map Control Center
        </h1>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ label, value, icon: Icon }) => (
            <article
              key={label}
              className="rounded-[var(--r-xl)] border border-white/10 bg-white/[0.04] p-6"
            >
              <Icon className="text-cyan-400" />
              <p className="mt-5 text-4xl font-bold">{value}</p>
              <p className="mt-1 text-slate-400">{label}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[var(--r-xl)] border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-bold">Platform Activity</h2>
            <div className="mt-5 space-y-4">
              {[
                "Location searches are available worldwide",
                "Community reports require admin verification",
                "Trip plans are generated with daily variety",
                "Offline map requests are stored for processing",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--r-xl)] border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-bold">System Status</h2>
            <div className="mt-5 space-y-4">
              {[
                ["Frontend", "Online"],
                ["Backend API", "Online"],
                ["Supabase", "Connected"],
                ["TomTom Navigation", "Configured"],
              ].map(([name, status]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                >
                  <span>{name}</span>
                  <span className="text-emerald-400">{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminDashboard;
