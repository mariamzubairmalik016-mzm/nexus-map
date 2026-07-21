import { motion } from "framer-motion";
import { CheckCircle2, Clock3, MapPin, Navigation, ShieldCheck, ThumbsUp, X } from "lucide-react";

import {
  ALERT_LABELS,
  SEVERITY_META,
  SOURCE_LABELS,
  type RoadAlert,
} from "../../types/roadAlerts";

const AlertDetailPanel = ({
  alert,
  busy,
  onClose,
  onConfirm,
  onResolve,
  onAvoid,
}: {
  alert: RoadAlert;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onResolve: () => void;
  onAvoid?: () => void;
}) => {
  const sev = SEVERITY_META[alert.severity];
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto absolute right-4 top-4 z-[800] w-[min(360px,calc(100%-2rem))] rounded-[24px] border border-white/10 bg-slate-950/92 p-5 shadow-2xl backdrop-blur-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${sev.dot}`} />
          <p className="text-xs uppercase tracking-wider text-slate-400">{ALERT_LABELS[alert.type]}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <h3 className="mt-2 text-lg font-bold">{alert.title}</h3>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs ${sev.chip}`}>{sev.label}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-slate-400">
          {SOURCE_LABELS[alert.source]}
        </span>
        {alert.isVerified && (
          <span className="inline-flex items-center gap-1 text-xs text-cyan-300">
            <ShieldCheck size={13} /> Verified
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-300">{alert.description}</p>

      <div className="mt-3 space-y-1.5 text-xs text-slate-500">
        <p className="flex items-center gap-2">
          <MapPin size={13} /> {alert.location}
        </p>
        <p className="flex items-center gap-2">
          <Clock3 size={13} /> Updated {new Date(alert.updatedAt).toLocaleTimeString()}
        </p>
        {alert.estimatedDelayMinutes != null && <p>Estimated delay: ~{alert.estimatedDelayMinutes} min</p>}
        {alert.verificationCount > 0 && <p>{alert.verificationCount} community confirmations</p>}
        {alert.alternateRoute && <p className="text-cyan-300">Alternate: {alert.alternateRoute}</p>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={onConfirm}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs disabled:opacity-60"
        >
          <ThumbsUp size={14} /> Still active
        </button>
        <button
          onClick={onResolve}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 py-2.5 text-xs text-emerald-300 disabled:opacity-60"
        >
          <CheckCircle2 size={14} /> Resolved
        </button>
      </div>

      {onAvoid && (
        <button
          onClick={onAvoid}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 text-xs font-semibold text-slate-950"
        >
          <Navigation size={14} /> Recalculate avoiding this alert
        </button>
      )}
    </motion.div>
  );
};

export default AlertDetailPanel;
