import { RefreshCw } from "lucide-react";

import type { HealthStatus, ServiceHealth } from "../../services/healthChecks";

const META: Record<HealthStatus, { dot: string; label: string; text: string }> = {
  healthy: { dot: "bg-emerald-400", label: "Healthy", text: "text-emerald-300" },
  degraded: { dot: "bg-amber-400", label: "Degraded", text: "text-amber-300" },
  offline: { dot: "bg-red-400", label: "Offline", text: "text-red-300" },
  "not-configured": { dot: "bg-slate-500", label: "Not configured", text: "text-slate-400" },
};

const ServiceHealthGrid = ({
  services,
  loading,
  onRefresh,
}: {
  services: ServiceHealth[];
  loading: boolean;
  onRefresh: () => void;
}) => (
  <div className="nexus-card p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="nexus-eyebrow">Mission control</p>
        <h2 className="mt-1 text-2xl font-bold">System status</h2>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:text-white"
      >
        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        Recheck
      </button>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {services.map((service) => {
        const meta = META[service.status];
        return (
          <div key={service.key} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {service.status === "healthy" && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${meta.dot} opacity-60`} />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${meta.dot}`} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{service.label}</p>
              <p className="truncate text-xs text-slate-500">{service.detail}</p>
            </div>
            <span className={`shrink-0 text-xs font-medium ${meta.text}`}>{meta.label}</span>
          </div>
        );
      })}
    </div>
  </div>
);

export default ServiceHealthGrid;
