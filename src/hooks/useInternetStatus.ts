import { useEffect, useState } from "react";

import { networkStatus } from "../services/networkStatus";

// Backed by the single networkStatus source so every component agrees.
export const useInternetStatus = () => {
  // Always default to true on the very first render (SSR/Hydration) to match the server.
  const [online, setOnline] = useState(true);
  
  useEffect(() => {
    // Immediately sync the true client state once mounted
    setOnline(networkStatus.isOnline());
    return networkStatus.subscribe(setOnline);
  }, []);
  
  return online;
};
