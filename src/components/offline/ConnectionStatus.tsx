import { useEffect, useRef, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import toast from "react-hot-toast";

import { useInternetStatus } from "../../hooks/useInternetStatus";
import { flushQueue, pendingCount } from "../../services/offlineQueue";

/**
 * Global connectivity indicator + auto-sync. Shows an offline banner and, when
 * the connection returns, replays any queued offline writes (background sync
 * fallback for browsers without the Sync API).
 */
const ConnectionStatus = () => {
  const online = useInternetStatus();
  const wasOnline = useRef(online);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    pendingCount().then(setPending).catch(() => {});
  }, [online]);

  useEffect(() => {
    if (wasOnline.current && !online) {
      toast("You are offline — your saved data is still available.", { icon: "📴", id: "conn" });
    }
    if (!wasOnline.current && online) {
      void (async () => {
        setSyncing(true);
        const { flushed, remaining } = await flushQueue();
        setSyncing(false);
        setPending(remaining);
        if (flushed > 0) {
          toast.success(`Back online — synced ${flushed} pending ${flushed === 1 ? "change" : "changes"}.`, { id: "conn" });
        } else {
          toast.success("Back online.", { id: "conn" });
        }
      })();
    }
    wasOnline.current = online;
  }, [online]);

  if (online && pending === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4">
      <div
        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-lg backdrop-blur ${
          online
            ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
            : "border-amber-400/30 bg-amber-500/10 text-amber-200"
        }`}
      >
        {online ? <RefreshCw size={15} className={syncing ? "animate-spin" : ""} /> : <WifiOff size={15} />}
        <span>
          {online
            ? syncing
              ? "Syncing offline changes…"
              : `${pending} change${pending === 1 ? "" : "s"} pending sync`
            : "Offline mode — your data is still available"}
        </span>
      </div>
    </div>
  );
};

export default ConnectionStatus;
